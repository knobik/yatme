import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { getTextureSync, preloadSheets } from './TextureManager'
import { getItemSpriteId, type AnimatedSpriteRef } from './SpriteResolver'
import { ChunkCache, chunkKeyStr, buildChunkIndex } from './ChunkManager'
import { Camera } from './Camera'
import { setupMapInput, type InputHost } from './InputHandler'
import {
  TILE_SIZE, CHUNK_SIZE, MAX_ELEVATION, FLOOR_ABOVE_ALPHA,
  CHUNK_CACHE_SIZE, CHUNK_BUILD_BUDGET_MS, PREFETCH_RING,
  type FloorViewMode,
} from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmMap, OtbmTile, OtbmItem } from './otbm'

export { type FloorViewMode } from './constants'

// ── MapRenderer ─────────────────────────────────────────────────────

export class MapRenderer implements InputHost {
  private app: Application
  private mapContainer: Container
  private appearances: AppearanceData
  private chunkIndex: Map<string, OtbmTile[]>
  readonly mapData: OtbmMap
  readonly camera: Camera

  // Chunk management
  private activeChunks = new Map<string, Container>()
  private chunkCache = new ChunkCache(CHUNK_CACHE_SIZE)
  private buildQueue: string[] = []
  private buildQueueReadIdx = 0
  private buildQueueSet = new Set<string>()

  // Floor container management
  private floorContainers = new Map<number, Container>()
  private _lastVisibleFloors: number[] = []

  // Dirty tracking
  private _lastRangeKey = ''
  // Reusable per-frame collections
  private _allVisibleKeys = new Set<string>()
  private _allPrefetchKeys = new Set<string>()
  // Reusable per-tile arrays
  private _ground: OtbmItem[] = []
  private _bottom: OtbmItem[] = []
  private _common: OtbmItem[] = []
  private _top: OtbmItem[] = []
  private _drawOrder: OtbmItem[] = []

  // Animation state
  private _animStartTime: number
  private _animElapsed = 0
  private _animLastUpdate = 0
  private _animatedChunkKeys: Set<string>
  private _chunkAnimSprites = new Map<string, AnimatedSpriteRef[]>()

  // Tile selection
  private _selectedTileX = -1
  private _selectedTileY = -1
  private _selectedTileZ = -1
  private _highlightGraphics: Graphics
  private _highlightContainer: Container
  private _selectionGraphics: Graphics
  private _selectionTiles: { x: number; y: number; z: number }[] = []

  // Lifecycle
  private _cleanupInput: (() => void) | null = null
  private _boundUpdate: () => void

  // Callbacks (InputHost interface + camera change)
  onCameraChange?: (x: number, y: number, zoom: number, floor: number, floorViewMode: FloorViewMode, showTransparentUpper: boolean) => void
  onTileClick?: (tile: OtbmTile | null, worldX: number, worldY: number) => void
  onTilePointerDown?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTilePointerMove?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTilePointerUp?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void

  constructor(app: Application, appearances: AppearanceData, mapData: OtbmMap) {
    this.app = app
    this.appearances = appearances
    this.mapData = mapData

    // Camera (app.screen is a persistent Pixi Rectangle — no allocation on access)
    this.camera = new Camera(this.app.screen)

    // Chunk index
    const { index, animatedKeys } = buildChunkIndex(mapData.tiles, appearances)
    this.chunkIndex = index
    this._animatedChunkKeys = animatedKeys
    this._animStartTime = performance.now()
    this.chunkCache.onEvict = (key) => this._chunkAnimSprites.delete(key)

    // Stage
    this.mapContainer = new Container()
    this.app.stage.addChild(this.mapContainer)

    // Highlight overlay
    this._highlightContainer = new Container()
    this._highlightGraphics = new Graphics()
    this._highlightGraphics.visible = false
    this._selectionGraphics = new Graphics()
    this._selectionGraphics.visible = false
    this._highlightContainer.addChild(this._highlightGraphics)
    this._highlightContainer.addChild(this._selectionGraphics)
    this.mapContainer.addChild(this._highlightContainer)

    // Input
    this._cleanupInput = setupMapInput(
      this.app.canvas as HTMLCanvasElement,
      this,
      () => this.notifyCamera(),
      (x, y, z, tile) => {
        this._selectedTileX = x
        this._selectedTileY = y
        this._selectedTileZ = z
        this.updateHighlight()
        this.onTileClick?.(tile, x, y)
      },
    )

    // Center on first town
    if (mapData.towns.length > 0) {
      const town = mapData.towns[0]
      this.camera.setFloor(town.templeZ)
      this.camera.centerOn(town.templeX, town.templeY)
    }

    this._boundUpdate = () => this.update()
    this.app.ticker.add(this._boundUpdate)
  }

  // ── Public API (delegates to Camera) ───────────────────────────

  get zoom(): number { return this.camera.zoom }
  get floor(): number { return this.camera.floor }
  get floorViewMode(): FloorViewMode { return this.camera.floorViewMode }
  get showTransparentUpper(): boolean { return this.camera.showTransparentUpper }
  get worldX(): number { return this.camera.worldX }
  get worldY(): number { return this.camera.worldY }

  setFloor(z: number): void {
    if (!this.camera.setFloor(z)) return
    this.deselectTile()
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setFloorViewMode(mode: FloorViewMode): void {
    if (!this.camera.setFloorViewMode(mode)) return
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setShowTransparentUpper(v: boolean): void {
    if (!this.camera.setShowTransparentUpper(v)) return
    this._lastVisibleFloors = []
    this.notifyCamera()
  }

  centerOn(x: number, y: number): void {
    this.camera.centerOn(x, y)
    this.notifyCamera()
  }

  getTileAt(screenX: number, screenY: number): { x: number; y: number; z: number } {
    return this.camera.getTileAt(screenX, screenY)
  }

  // ── Editor support ─────────────────────────────────────────────

  /** Invalidate specific chunks, forcing them to rebuild on next frame. */
  invalidateChunks(keys: Set<string>): void {
    for (const key of keys) {
      const active = this.activeChunks.get(key)
      if (active) {
        active.cacheAsTexture(false)
        active.parent?.removeChild(active)
        active.removeChildren()
        active.destroy()
        this.activeChunks.delete(key)
      }
      this.chunkCache.delete(key)
      this._chunkAnimSprites.delete(key)
    }
    this._lastRangeKey = ''
  }

  /** Update the chunk index when a tile is created or modified. */
  updateChunkIndex(tile: OtbmTile): void {
    const cx = Math.floor(tile.x / CHUNK_SIZE)
    const cy = Math.floor(tile.y / CHUNK_SIZE)
    const key = chunkKeyStr(cx, cy, tile.z)
    let arr = this.chunkIndex.get(key)
    if (!arr) {
      arr = []
      this.chunkIndex.set(key, arr)
    }
    const existing = arr.findIndex(t => t.x === tile.x && t.y === tile.y)
    if (existing >= 0) {
      arr[existing] = tile
    } else {
      arr.push(tile)
      arr.sort((a, b) => a.y - b.y || a.x - b.x)
    }
    // Update animated keys tracking
    let hasAnim = false
    for (const t of arr) {
      for (const item of t.items) {
        const appearance = this.appearances.objects.get(item.id)
        const info = appearance?.frameGroup?.[0]?.spriteInfo
        if (info?.animation && info.animation.spritePhase.length > 1) {
          hasAnim = true
          break
        }
      }
      if (hasAnim) break
    }
    if (hasAnim) this._animatedChunkKeys.add(key)
  }

  /** Set multi-tile selection overlay. */
  updateSelectionOverlay(tiles: { x: number; y: number; z: number }[]): void {
    this._selectionTiles = tiles
    const g = this._selectionGraphics
    g.clear()
    if (tiles.length === 0) {
      g.visible = false
      return
    }
    for (const t of tiles) {
      if (t.z !== this.camera.floor) continue
      const px = t.x * TILE_SIZE
      const py = t.y * TILE_SIZE
      g.rect(px, py, TILE_SIZE, TILE_SIZE)
      g.stroke({ color: 0xd4a549, width: 1, alpha: 0.7 })
      g.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      g.fill({ color: 0xd4a549, alpha: 0.08 })
    }
    g.visible = true
  }

  clearSelectionOverlay(): void {
    this._selectionTiles = []
    this._selectionGraphics.clear()
    this._selectionGraphics.visible = false
  }

  /** Change the canvas cursor style. */
  setCursorStyle(style: string): void {
    (this.app.canvas as HTMLCanvasElement).style.cursor = style
  }

  // ── Tile selection ─────────────────────────────────────────────

  deselectTile(): void {
    this._selectedTileX = -1
    this._selectedTileY = -1
    this._selectedTileZ = -1
    this._highlightGraphics.visible = false
    this.onTileClick?.(null, -1, -1)
  }

  private updateHighlight(): void {
    if (this._selectedTileX < 0 || this._selectedTileZ !== this.camera.floor) {
      this._highlightGraphics.visible = false
      return
    }

    const g = this._highlightGraphics
    g.clear()
    const px = this._selectedTileX * TILE_SIZE
    const py = this._selectedTileY * TILE_SIZE
    g.rect(px, py, TILE_SIZE, TILE_SIZE)
    g.stroke({ color: 0xd4a549, width: 1.5, alpha: 0.9 })
    g.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    g.fill({ color: 0xd4a549, alpha: 0.1 })
    g.visible = true

    const offset = this.camera.getFloorOffset(this.camera.floor)
    this._highlightContainer.position.set(-offset, -offset)

    if (this._selectionTiles.length > 0) {
      this.updateSelectionOverlay(this._selectionTiles)
    }
  }

  // ── Camera notification ────────────────────────────────────────

  private notifyCamera(): void {
    this.onCameraChange?.(
      this.camera.worldX, this.camera.worldY, this.camera.zoom,
      this.camera.floor, this.camera.floorViewMode, this.camera.showTransparentUpper,
    )
  }

  // ── Floor container management ─────────────────────────────────

  private updateFloorContainers(visibleFloors: number[]): void {
    const floorsChanged = !this.arraysEqual(this._lastVisibleFloors, visibleFloors)

    if (!floorsChanged) {
      for (const z of visibleFloors) {
        const container = this.floorContainers.get(z)!
        const offset = this.camera.getFloorOffset(z)
        container.position.set(-offset, -offset)
        container.alpha = (z < this.camera.floor && this.camera.showTransparentUpper) ? FLOOR_ABOVE_ALPHA : 1.0
      }
      return
    }

    const visibleSet = new Set(visibleFloors)

    for (const [z, container] of this.floorContainers) {
      if (!visibleSet.has(z)) {
        this.mapContainer.removeChild(container)
        container.destroy()
        this.floorContainers.delete(z)
      }
    }

    for (const z of visibleFloors) {
      let container = this.floorContainers.get(z)
      if (!container) {
        container = new Container()
        this.floorContainers.set(z, container)
      }
      const offset = this.camera.getFloorOffset(z)
      container.position.set(-offset, -offset)
      container.alpha = (z < this.camera.floor && this.camera.showTransparentUpper) ? FLOOR_ABOVE_ALPHA : 1.0
    }

    for (const container of this.floorContainers.values()) {
      if (container.parent === this.mapContainer) {
        this.mapContainer.removeChild(container)
      }
    }
    if (this._highlightContainer.parent === this.mapContainer) {
      this.mapContainer.removeChild(this._highlightContainer)
    }
    for (const z of visibleFloors) {
      const container = this.floorContainers.get(z)!
      this.mapContainer.addChild(container)
    }
    this.mapContainer.addChild(this._highlightContainer)

    this._lastVisibleFloors = visibleFloors.slice()
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  // ── Update loop ────────────────────────────────────────────────

  private update(): void {
    this.mapContainer.position.set(
      Math.round(-this.camera.x * this.camera.zoom),
      Math.round(-this.camera.y * this.camera.zoom),
    )
    this.mapContainer.scale.set(this.camera.zoom)

    this._animElapsed = performance.now() - this._animStartTime

    const visibleFloors = this.camera.getVisibleFloors()
    this.updateFloorContainers(visibleFloors)

    const rangeKey = this.camera.computeRangeKey(visibleFloors)
    const rangeChanged = rangeKey !== this._lastRangeKey

    if (rangeChanged) {
      this._lastRangeKey = rangeKey

      const allVisibleKeys = this._allVisibleKeys
      allVisibleKeys.clear()
      const allPrefetchKeys = this._allPrefetchKeys
      allPrefetchKeys.clear()

      for (const z of visibleFloors) {
        const offset = this.camera.getFloorOffset(z)
        const { startX, startY, endX, endY } = this.camera.getVisibleRangeForFloor(offset)

        for (let cy = startY - PREFETCH_RING; cy <= endY + PREFETCH_RING; cy++) {
          for (let cx = startX - PREFETCH_RING; cx <= endX + PREFETCH_RING; cx++) {
            const key = chunkKeyStr(cx, cy, z)
            if (cy >= startY && cy <= endY && cx >= startX && cx <= endX) {
              allVisibleKeys.add(key)
            } else {
              allPrefetchKeys.add(key)
            }
          }
        }
      }

      // Move off-screen chunks to LRU cache
      for (const [key, container] of this.activeChunks) {
        if (!allVisibleKeys.has(key)) {
          container.cacheAsTexture(false)
          container.parent?.removeChild(container)
          this.chunkCache.set(key, container)
          this.activeChunks.delete(key)
        }
      }
    }

    // Build/restore visible chunks
    const frameStart = performance.now()
    let budgetExhausted = false

    for (const z of visibleFloors) {
      if (budgetExhausted) break
      const floorContainer = this.floorContainers.get(z)!
      const offset = this.camera.getFloorOffset(z)
      const { startX, startY, endX, endY } = this.camera.getVisibleRangeForFloor(offset)

      for (let cy = startY; cy <= endY; cy++) {
        if (budgetExhausted) break
        for (let cx = startX; cx <= endX; cx++) {
          const key = chunkKeyStr(cx, cy, z)
          if (this.activeChunks.has(key)) continue

          const cached = this.chunkCache.take(key)
          if (cached) {
            cached.cacheAsTexture({ scaleMode: 'nearest', antialias: false })
            floorContainer.addChild(cached)
            this.activeChunks.set(key, cached)
            continue
          }

          const tiles = this.chunkIndex.get(key)
          if (!tiles || tiles.length === 0) continue

          const container = new Container()
          const animSprites = this.buildChunkSync(container, tiles, this._animElapsed)
          container.cacheAsTexture({ scaleMode: 'nearest', antialias: false })
          if (animSprites.length > 0) {
            this._chunkAnimSprites.set(key, animSprites)
          }
          floorContainer.addChild(container)
          this.activeChunks.set(key, container)
          this.preloadAndRebuild(container, tiles, key)

          if (performance.now() - frameStart > CHUNK_BUILD_BUDGET_MS) {
            budgetExhausted = true
            break
          }
        }
      }
    }

    this.updateHighlight()
    this.updateAnimatedSprites()

    if (rangeChanged) {
      for (const key of this._allPrefetchKeys) {
        if (this.activeChunks.has(key) || this.chunkCache.has(key) || this.buildQueueSet.has(key)) continue
        const tiles = this.chunkIndex.get(key)
        if (tiles && tiles.length > 0) {
          this.buildQueue.push(key)
          this.buildQueueSet.add(key)
        }
      }
    }

    this.processBuildQueue(frameStart)
  }

  // ── Animated sprites ───────────────────────────────────────────

  private updateAnimatedSprites(): void {
    if (this._chunkAnimSprites.size === 0) return

    const timeSinceUpdate = this._animElapsed - this._animLastUpdate
    if (timeSinceUpdate < 100) return
    this._animLastUpdate = this._animElapsed

    for (const [key, sprites] of this._chunkAnimSprites) {
      const container = this.activeChunks.get(key)
      if (!container) continue

      let changed = false
      for (const ref of sprites) {
        const spriteId = getItemSpriteId(ref.appearance, ref.item, ref.tile, this._animElapsed)
        if (spriteId == null || spriteId === 0) continue
        const texture = getTextureSync(spriteId)
        if (texture && texture !== ref.sprite.texture) {
          ref.sprite.texture = texture
          changed = true
        }
      }

      if (changed && container.isCachedAsTexture) {
        container.updateCacheTexture()
      }
    }
  }

  // ── Build queue ────────────────────────────────────────────────

  private processBuildQueue(frameStart: number): void {
    while (this.buildQueueReadIdx < this.buildQueue.length) {
      if (performance.now() - frameStart > CHUNK_BUILD_BUDGET_MS) break

      const key = this.buildQueue[this.buildQueueReadIdx++]
      this.buildQueueSet.delete(key)

      if (this.activeChunks.has(key) || this.chunkCache.has(key)) continue
      const tiles = this.chunkIndex.get(key)
      if (!tiles || tiles.length === 0) continue

      const container = new Container()
      const animSprites = this.buildChunkSync(container, tiles, this._animElapsed)
      if (animSprites.length > 0) {
        this._chunkAnimSprites.set(key, animSprites)
      }
      this.preloadAndRebuild(container, tiles, key)
      this.chunkCache.set(key, container)
    }

    if (this.buildQueueReadIdx >= this.buildQueue.length) {
      this.buildQueue.length = 0
      this.buildQueueReadIdx = 0
    }
  }

  recycleAllChunks(): void {
    for (const [_key, container] of this.activeChunks) {
      container.cacheAsTexture(false)
      container.parent?.removeChild(container)
      container.removeChildren()
      container.destroy()
    }
    this.activeChunks.clear()
    this._chunkAnimSprites.clear()
    this.chunkCache.clear()
    this.buildQueue.length = 0
    this.buildQueueReadIdx = 0
    this.buildQueueSet.clear()

    for (const [_z, container] of this.floorContainers) {
      this.mapContainer.removeChild(container)
      container.destroy()
    }
    this.floorContainers.clear()
    this._lastVisibleFloors = []
    this._lastRangeKey = ''
  }

  // ── Chunk building ─────────────────────────────────────────────

  private buildChunkSync(container: Container, tiles: OtbmTile[], elapsedMs: number): AnimatedSpriteRef[] {
    const animSprites: AnimatedSpriteRef[] = []
    for (const tile of tiles) {
      this.renderTile(container, tile, elapsedMs, animSprites)
    }
    return animSprites
  }

  private preloadAndRebuild(container: Container, tiles: OtbmTile[], chunkKey: string): void {
    const spriteIds: number[] = []
    for (const tile of tiles) {
      for (const item of tile.items) {
        const appearance = this.appearances.objects.get(item.id)
        if (!appearance) continue
        const info = appearance.frameGroup?.[0]?.spriteInfo
        if (!info || info.spriteId.length === 0) continue
        const phaseCount = info.animation?.spritePhase?.length ?? 1
        for (let phase = 0; phase < phaseCount; phase++) {
          const sid = getItemSpriteId(appearance, item, tile, 0, phase)
          if (sid != null && sid !== 0) spriteIds.push(sid)
        }
      }
    }

    if (spriteIds.length > 0) {
      preloadSheets(spriteIds).then(() => {
        const elapsed = performance.now() - this._animStartTime
        container.removeChildren()
        const animSprites = this.buildChunkSync(container, tiles, elapsed)
        if (animSprites.length > 0) {
          this._chunkAnimSprites.set(chunkKey, animSprites)
        }
        if (container.isCachedAsTexture) {
          container.updateCacheTexture()
        }
      })
    }
  }

  private renderTile(
    parent: Container,
    tile: OtbmTile,
    elapsedMs: number,
    animSprites?: AnimatedSpriteRef[],
  ): void {
    const baseX = tile.x * TILE_SIZE
    const baseY = tile.y * TILE_SIZE

    const ground = this._ground; ground.length = 0
    const bottom = this._bottom; bottom.length = 0
    const common = this._common; common.length = 0
    const top = this._top; top.length = 0

    for (const item of tile.items) {
      const appearance = this.appearances.objects.get(item.id)
      const flags = appearance?.flags
      if (flags?.bank) {
        ground.push(item)
      } else if (flags?.clip || flags?.bottom) {
        bottom.push(item)
      } else if (flags?.top) {
        top.push(item)
      } else {
        common.push(item)
      }
    }

    let elevation = 0
    common.reverse()
    const drawOrder = this._drawOrder; drawOrder.length = 0
    for (let i = 0; i < ground.length; i++) drawOrder.push(ground[i])
    for (let i = 0; i < bottom.length; i++) drawOrder.push(bottom[i])
    for (let i = 0; i < common.length; i++) drawOrder.push(common[i])
    for (let i = 0; i < top.length; i++) drawOrder.push(top[i])

    for (const item of drawOrder) {
      const appearance = this.appearances.objects.get(item.id)
      if (!appearance) continue

      const spriteId = getItemSpriteId(appearance, item, tile, elapsedMs)
      if (spriteId == null || spriteId === 0) continue

      const texture = getTextureSync(spriteId)
      if (!texture) continue

      const sprite = new Sprite(texture)
      sprite.roundPixels = true

      const shift = appearance.flags?.shift
      sprite.x = baseX + TILE_SIZE - texture.width - elevation - (shift?.x ?? 0)
      sprite.y = baseY + TILE_SIZE - texture.height - elevation - (shift?.y ?? 0)

      parent.addChild(sprite)

      if (animSprites) {
        const info = appearance.frameGroup?.[0]?.spriteInfo
        if (info?.animation && info.animation.spritePhase.length > 1) {
          animSprites.push({ sprite, appearance, item, tile })
        }
      }

      if (appearance.flags?.height?.elevation) {
        elevation = Math.min(elevation + appearance.flags.height.elevation, MAX_ELEVATION)
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────

  destroy(): void {
    this.app.ticker.remove(this._boundUpdate)
    this._cleanupInput?.()
    this.recycleAllChunks()
    this._highlightGraphics.destroy()
    this._selectionGraphics.destroy()
    this._highlightContainer.destroy()
    this.mapContainer.destroy({ children: true })
  }
}
