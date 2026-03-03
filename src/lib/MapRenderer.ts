import { Application, Container, Sprite } from 'pixi.js'
import { getTextureSync, preloadSheets } from './TextureManager'
import type { AppearanceData } from './appearances'
import type { Appearance } from '../proto/appearances'
import type { SpriteInfo } from '../proto/appearances'
import type { OtbmMap, OtbmTile, OtbmItem } from './otbm'

const TILE_SIZE = 32
const CHUNK_SIZE = 32 // tiles per chunk side
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE
const MAX_ELEVATION = 24
const GROUND_LAYER = 7
const CHUNK_CACHE_SIZE = 512 // max cached off-screen chunks (higher for multi-floor)
const CHUNK_BUILD_BUDGET_MS = 4 // max ms per frame for building new chunks
const PREFETCH_RING = 2 // extra chunks around viewport to pre-build
const FLOOR_ABOVE_ALPHA = 0.3 // opacity for the transparent floor above

export type FloorViewMode = 'single' | 'current-below' | 'all'

// Discrete zoom levels where zoom * TILE_SIZE is always an integer (no sub-pixel gaps)
const ZOOM_LEVELS = [
  0.25, 0.375, 0.5, 0.625, 0.75, 0.875,
  1, 1.25, 1.5, 1.75,
  2, 2.5, 3, 4, 5, 6, 8,
]

// ── Chunk index ─────────────────────────────────────────────────────

function chunkKeyStr(cx: number, cy: number, z: number): string {
  return `${cx},${cy},${z}`
}

function buildChunkIndex(tiles: Map<string, OtbmTile>): Map<string, OtbmTile[]> {
  const index = new Map<string, OtbmTile[]>()
  for (const tile of tiles.values()) {
    const cx = Math.floor(tile.x / CHUNK_SIZE)
    const cy = Math.floor(tile.y / CHUNK_SIZE)
    const key = chunkKeyStr(cx, cy, tile.z)
    let arr = index.get(key)
    if (!arr) {
      arr = []
      index.set(key, arr)
    }
    arr.push(tile)
  }
  return index
}

// ── LRU chunk cache ─────────────────────────────────────────────────

class ChunkCache {
  private cache = new Map<string, Container>() // insertion-order = LRU order
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  /** Remove from cache and return it (without destroying). Used to restore to screen. */
  take(key: string): Container | undefined {
    const container = this.cache.get(key)
    if (container) {
      this.cache.delete(key)
    }
    return container
  }

  /** Store a container in the cache. Evicts oldest if over capacity. */
  set(key: string, container: Container): void {
    // If already cached, remove old entry first
    const existing = this.cache.get(key)
    if (existing) {
      if (existing.isCachedAsTexture) existing.cacheAsTexture(false)
      existing.removeChildren()
      existing.destroy()
      this.cache.delete(key)
    }
    this.cache.set(key, container)
    this.evict()
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    for (const container of this.cache.values()) {
      if (container.isCachedAsTexture) container.cacheAsTexture(false)
      container.removeChildren()
      container.destroy()
    }
    this.cache.clear()
  }

  private evict(): void {
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value!
      const container = this.cache.get(firstKey)!
      if (container.isCachedAsTexture) container.cacheAsTexture(false)
      container.removeChildren()
      container.destroy()
      this.cache.delete(firstKey)
    }
  }
}

// ── Sprite index calculation ────────────────────────────────────────

function getSpriteIndex(
  info: SpriteInfo,
  xPattern: number,
  yPattern: number,
  zPattern: number = 0,
  layer: number = 0,
  animPhase: number = 0,
): number {
  const phases = info.animation?.spritesPhase?.length ?? 1
  const index =
    ((((animPhase % Math.max(1, phases)) * Math.max(1, info.patternDepth) + zPattern) *
      Math.max(1, info.patternHeight) +
      yPattern) *
      Math.max(1, info.patternWidth) +
      xPattern) *
      Math.max(1, info.layers) +
    layer
  return info.spriteId[index] ?? info.spriteId[0] ?? 0
}

function getItemSpriteId(
  appearance: Appearance,
  item: OtbmItem,
  tile: OtbmTile,
): number | null {
  const info = appearance.frameGroup?.[0]?.spriteInfo
  if (!info || info.spriteId.length === 0) return null

  const flags = appearance.flags
  const pw = Math.max(1, info.patternWidth)
  const ph = Math.max(1, info.patternHeight)
  const pd = Math.max(1, info.patternDepth)

  let xPattern = 0
  let yPattern = 0
  let zPattern = 0

  if (flags?.cumulative && pw === 4 && ph === 2) {
    // Stackable items: pattern based on count
    const count = item.count ?? 1
    if (count <= 0) {
      xPattern = 0; yPattern = 0
    } else if (count < 5) {
      xPattern = count - 1; yPattern = 0
    } else if (count < 10) {
      xPattern = 0; yPattern = 1
    } else if (count < 25) {
      xPattern = 1; yPattern = 1
    } else if (count < 50) {
      xPattern = 2; yPattern = 1
    } else {
      xPattern = 3; yPattern = 1
    }
  } else if (flags?.hang) {
    // Hangable items: pattern based on hook direction
    // Without tile hook info, default to pattern 0 (hanging freely)
    xPattern = 0
  } else if (flags?.liquidcontainer || flags?.liquidpool) {
    // Fluid items: pattern based on fluid type (stored in count)
    const color = item.count ?? 0
    xPattern = (color % 4) % pw
    yPattern = Math.floor(color / 4) % ph
  } else {
    // Regular items: pattern based on tile position
    xPattern = tile.x % pw
    yPattern = tile.y % ph
    zPattern = tile.z % pd
  }

  return getSpriteIndex(info, xPattern, yPattern, zPattern)
}

// ── MapRenderer ─────────────────────────────────────────────────────

export class MapRenderer {
  private app: Application
  private mapContainer: Container
  private appearances: AppearanceData
  private chunkIndex: Map<string, OtbmTile[]>
  mapData: OtbmMap

  // Camera state
  private cameraX = 0 // world pixel position
  private cameraY = 0
  private _zoom = 1
  private _floor = 7
  private _floorViewMode: FloorViewMode = 'single'

  // Interaction state
  private dragging = false
  private dragStartX = 0
  private dragStartY = 0
  private cameraStartX = 0
  private cameraStartY = 0

  // Chunk management
  private activeChunks = new Map<string, Container>() // currently on-screen
  private chunkCache = new ChunkCache(CHUNK_CACHE_SIZE) // off-screen LRU cache
  private buildQueue: string[] = [] // chunks waiting to be built
  private buildQueueReadIdx = 0 // read pointer for build queue (avoids O(n) shift)
  private buildQueueSet = new Set<string>() // fast lookup for queue membership

  // Floor container management
  private floorContainers = new Map<number, Container>()
  private _lastVisibleFloors: number[] = []

  // Dirty tracking — skip expensive chunk management when nothing changed
  private _lastRangeKey = ''
  // Reusable per-frame collections (avoid GC pressure)
  private _allVisibleKeys = new Set<string>()
  private _allPrefetchKeys = new Set<string>()

  // Callbacks for HUD updates
  onCameraChange?: (x: number, y: number, zoom: number, floor: number, floorViewMode: FloorViewMode) => void

  constructor(app: Application, appearances: AppearanceData, mapData: OtbmMap) {
    this.app = app
    this.appearances = appearances
    this.mapData = mapData
    this.chunkIndex = buildChunkIndex(mapData.tiles)

    this.mapContainer = new Container()
    this.app.stage.addChild(this.mapContainer)

    this.setupInput()

    // Center on first town
    if (mapData.towns.length > 0) {
      const town = mapData.towns[0]
      this.cameraX = town.templeX * TILE_SIZE - this.app.screen.width / 2
      this.cameraY = town.templeY * TILE_SIZE - this.app.screen.height / 2
      this._floor = town.templeZ
    }

    this.app.ticker.add(() => this.update())
  }

  get zoom(): number { return this._zoom }
  get floor(): number { return this._floor }
  get floorViewMode(): FloorViewMode { return this._floorViewMode }
  get worldX(): number { return Math.floor(this.cameraX / TILE_SIZE) }
  get worldY(): number { return Math.floor(this.cameraY / TILE_SIZE) }

  setFloor(z: number): void {
    if (z < 0 || z > 15) return
    this._floor = z
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setFloorViewMode(mode: FloorViewMode): void {
    if (mode === this._floorViewMode) return
    this._floorViewMode = mode
    this.recycleAllChunks()
    this.notifyCamera()
  }

  centerOn(x: number, y: number): void {
    this.cameraX = x * TILE_SIZE - this.app.screen.width / (2 * this._zoom)
    this.cameraY = y * TILE_SIZE - this.app.screen.height / (2 * this._zoom)
    this.notifyCamera()
  }

  // ── Floor helpers ────────────────────────────────────────────────

  /** Diagonal pixel offset for a given floor, matching RME's getDrawPosition. */
  private getFloorOffset(z: number): number {
    if (z <= GROUND_LAYER) {
      return (GROUND_LAYER - z) * TILE_SIZE
    }
    return (this._floor - z) * TILE_SIZE
  }

  /** List of floors to render, in back-to-front order (highest Z first). */
  private getVisibleFloors(): number[] {
    if (this._floorViewMode === 'single') {
      return [this._floor]
    }

    let startZ: number
    let endZ: number

    if (this._floor <= GROUND_LAYER) {
      // Above ground: startZ = ground (Z=7), endZ = upper limit.
      // Lower Z = higher elevation. 'current-below' stops at current floor,
      // 'all' goes all the way up to Z=0.
      startZ = GROUND_LAYER
      endZ = this._floorViewMode === 'current-below' ? this._floor : 0
    } else {
      // Underground: render from floor+2 down to current floor
      startZ = Math.min(15, this._floor + 2)
      endZ = this._floor
    }

    // Back-to-front: highest Z first (drawn behind), lowest Z last (drawn in front)
    const floors: number[] = []
    for (let z = startZ; z >= endZ; z--) {
      floors.push(z)
    }
    return floors
  }

  // ── Input ───────────────────────────────────────────────────────

  private setupInput(): void {
    const canvas = this.app.canvas as HTMLCanvasElement

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0 || e.button === 1) {
        this.dragging = true
        this.dragStartX = e.clientX
        this.dragStartY = e.clientY
        this.cameraStartX = this.cameraX
        this.cameraStartY = this.cameraY
        canvas.setPointerCapture(e.pointerId)
      }
    })

    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      const dx = e.clientX - this.dragStartX
      const dy = e.clientY - this.dragStartY
      this.cameraX = this.cameraStartX - dx / this._zoom
      this.cameraY = this.cameraStartY - dy / this._zoom
      this.notifyCamera()
    })

    canvas.addEventListener('pointerup', (e) => {
      if (this.dragging) {
        this.dragging = false
        canvas.releasePointerCapture(e.pointerId)
      }
    })

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // World position under cursor before zoom
      const worldBeforeX = this.cameraX + mouseX / this._zoom
      const worldBeforeY = this.cameraY + mouseY / this._zoom

      // Snap to discrete zoom levels to avoid sub-pixel tile gaps
      const currentIdx = ZOOM_LEVELS.indexOf(this._zoom)
      let nextIdx: number
      if (currentIdx === -1) {
        // Find nearest level
        nextIdx = ZOOM_LEVELS.findIndex((z) => z >= this._zoom)
        if (nextIdx === -1) nextIdx = ZOOM_LEVELS.length - 1
      } else {
        nextIdx = e.deltaY < 0
          ? Math.min(currentIdx + 1, ZOOM_LEVELS.length - 1)
          : Math.max(currentIdx - 1, 0)
      }
      this._zoom = ZOOM_LEVELS[nextIdx]

      // Adjust camera so world position under cursor stays the same
      this.cameraX = worldBeforeX - mouseX / this._zoom
      this.cameraY = worldBeforeY - mouseY / this._zoom

      this.notifyCamera()
    }, { passive: false })
  }

  private notifyCamera(): void {
    this.onCameraChange?.(this.worldX, this.worldY, this._zoom, this._floor, this._floorViewMode)
  }

  // ── Viewport range helpers ────────────────────────────────────

  /** Visible chunk range for a floor at a given pixel offset. */
  private getVisibleRangeForFloor(floorOffset: number) {
    const screenW = this.app.screen.width
    const screenH = this.app.screen.height
    return {
      startX: Math.floor((this.cameraX + floorOffset) / CHUNK_PX) - 1,
      startY: Math.floor((this.cameraY + floorOffset) / CHUNK_PX) - 1,
      endX: Math.floor((this.cameraX + floorOffset + screenW / this._zoom) / CHUNK_PX) + 1,
      endY: Math.floor((this.cameraY + floorOffset + screenH / this._zoom) / CHUNK_PX) + 1,
    }
  }

  // ── Floor container management ─────────────────────────────────

  /** Ensure floor containers exist for visible floors with correct positions and alpha. */
  private updateFloorContainers(visibleFloors: number[]): void {
    // Fast path: if the floor set hasn't changed, just update positions and alpha
    const floorsChanged = !this.arraysEqual(this._lastVisibleFloors, visibleFloors)

    if (!floorsChanged) {
      for (const z of visibleFloors) {
        const container = this.floorContainers.get(z)!
        const offset = this.getFloorOffset(z)
        container.position.set(-offset, -offset)
        container.alpha = z < this._floor ? FLOOR_ABOVE_ALPHA : 1.0
      }
      return
    }

    // Slow path: floors changed, rebuild the container hierarchy
    const visibleSet = new Set(visibleFloors)

    // Remove floor containers no longer visible
    for (const [z, container] of this.floorContainers) {
      if (!visibleSet.has(z)) {
        this.mapContainer.removeChild(container)
        container.destroy()
        this.floorContainers.delete(z)
      }
    }

    // Create/update floor containers in draw order (back-to-front)
    for (const z of visibleFloors) {
      let container = this.floorContainers.get(z)
      if (!container) {
        container = new Container()
        this.floorContainers.set(z, container)
      }

      const offset = this.getFloorOffset(z)
      container.position.set(-offset, -offset)
      container.alpha = z < this._floor ? FLOOR_ABOVE_ALPHA : 1.0
    }

    // Re-add to mapContainer in correct Z-order (back-to-front)
    for (const container of this.floorContainers.values()) {
      if (container.parent === this.mapContainer) {
        this.mapContainer.removeChild(container)
      }
    }
    for (const z of visibleFloors) {
      const container = this.floorContainers.get(z)!
      this.mapContainer.addChild(container)
    }

    this._lastVisibleFloors = visibleFloors.slice()
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  // ── Update loop ─────────────────────────────────────────────────

  /** Build a range key string for dirty checking. */
  private computeRangeKey(visibleFloors: number[]): string {
    const screenW = this.app.screen.width
    const screenH = this.app.screen.height
    // Compute the bounding chunk range across all visible floors
    let minSX = Infinity, minSY = Infinity, maxEX = -Infinity, maxEY = -Infinity
    for (const z of visibleFloors) {
      const offset = this.getFloorOffset(z)
      const sx = Math.floor((this.cameraX + offset) / CHUNK_PX) - 1
      const sy = Math.floor((this.cameraY + offset) / CHUNK_PX) - 1
      const ex = Math.floor((this.cameraX + offset + screenW / this._zoom) / CHUNK_PX) + 1
      const ey = Math.floor((this.cameraY + offset + screenH / this._zoom) / CHUNK_PX) + 1
      if (sx < minSX) minSX = sx
      if (sy < minSY) minSY = sy
      if (ex > maxEX) maxEX = ex
      if (ey > maxEY) maxEY = ey
    }
    return `${minSX},${minSY},${maxEX},${maxEY},${this._floor},${this._floorViewMode}`
  }

  private update(): void {
    // Apply camera transform — round to avoid sub-pixel gaps between tiles
    this.mapContainer.position.set(
      Math.round(-this.cameraX * this._zoom),
      Math.round(-this.cameraY * this._zoom),
    )
    this.mapContainer.scale.set(this._zoom)

    const visibleFloors = this.getVisibleFloors()

    // Update floor containers (positions, alpha, z-order)
    this.updateFloorContainers(visibleFloors)

    // Dirty check: only rebuild visible/prefetch key sets and move off-screen
    // chunks when the chunk range changes. The build loop always runs because
    // budget exhaustion may leave visible chunks unbuilt from a prior frame.
    const rangeKey = this.computeRangeKey(visibleFloors)
    const rangeChanged = rangeKey !== this._lastRangeKey

    if (rangeChanged) {
      this._lastRangeKey = rangeKey

      // Reuse per-frame collections
      const allVisibleKeys = this._allVisibleKeys
      allVisibleKeys.clear()

      const allPrefetchKeys = this._allPrefetchKeys
      allPrefetchKeys.clear()

      for (const z of visibleFloors) {
        const offset = this.getFloorOffset(z)
        const { startX, startY, endX, endY } = this.getVisibleRangeForFloor(offset)

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

    // Build/restore visible chunks per floor (always runs — cheap early-continue
    // when chunks already exist, but necessary to finish budget-deferred builds)
    const frameStart = performance.now()
    let budgetExhausted = false

    for (const z of visibleFloors) {
      if (budgetExhausted) break
      const floorContainer = this.floorContainers.get(z)!
      const offset = this.getFloorOffset(z)
      const { startX, startY, endX, endY } = this.getVisibleRangeForFloor(offset)

      for (let cy = startY; cy <= endY; cy++) {
        if (budgetExhausted) break
        for (let cx = startX; cx <= endX; cx++) {
          const key = chunkKeyStr(cx, cy, z)
          if (this.activeChunks.has(key)) continue

          // Restore from cache
          const cached = this.chunkCache.take(key)
          if (cached) {
            cached.cacheAsTexture({ scaleMode: 'nearest', antialias: false })
            floorContainer.addChild(cached)
            this.activeChunks.set(key, cached)
            continue
          }

          // Build new
          const tiles = this.chunkIndex.get(key)
          if (!tiles || tiles.length === 0) continue

          const container = new Container()
          this.buildChunkSync(container, tiles)
          container.cacheAsTexture({ scaleMode: 'nearest', antialias: false })
          floorContainer.addChild(container)
          this.activeChunks.set(key, container)
          this.preloadAndRebuild(container, tiles)

          if (performance.now() - frameStart > CHUNK_BUILD_BUDGET_MS) {
            budgetExhausted = true
            break
          }
        }
      }
    }

    // Queue prefetch chunks and process build queue only when range changed
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

    // Build prefetch chunks with remaining budget
    this.processBuildQueue(frameStart)
  }

  private processBuildQueue(frameStart: number): void {
    while (this.buildQueueReadIdx < this.buildQueue.length) {
      if (performance.now() - frameStart > CHUNK_BUILD_BUDGET_MS) break

      const key = this.buildQueue[this.buildQueueReadIdx++]
      this.buildQueueSet.delete(key)

      // Skip if already active/cached
      if (this.activeChunks.has(key) || this.chunkCache.has(key)) continue
      const tiles = this.chunkIndex.get(key)
      if (!tiles || tiles.length === 0) continue

      // Pre-build into cache (not on screen yet)
      const container = new Container()
      this.buildChunkSync(container, tiles)
      this.preloadAndRebuild(container, tiles)

      // Store in cache for instant retrieval later
      this.chunkCache.set(key, container)
    }

    // Compact when fully drained
    if (this.buildQueueReadIdx >= this.buildQueue.length) {
      this.buildQueue.length = 0
      this.buildQueueReadIdx = 0
    }
  }

  recycleAllChunks(): void {
    // Remove active chunks
    for (const [_key, container] of this.activeChunks) {
      container.cacheAsTexture(false)
      container.parent?.removeChild(container)
      container.removeChildren()
      container.destroy()
    }
    this.activeChunks.clear()
    this.chunkCache.clear()
    this.buildQueue.length = 0
    this.buildQueueReadIdx = 0
    this.buildQueueSet.clear()

    // Destroy floor containers
    for (const [_z, container] of this.floorContainers) {
      this.mapContainer.removeChild(container)
      container.destroy()
    }
    this.floorContainers.clear()
    this._lastVisibleFloors = []
    this._lastRangeKey = ''
  }

  // ── Chunk building ──────────────────────────────────────────────

  private buildChunkSync(container: Container, tiles: OtbmTile[]): void {
    // Sort tiles by draw order: Y ascending, then X ascending.
    const sorted = tiles.slice().sort((a, b) => a.y - b.y || a.x - b.x)
    for (const tile of sorted) {
      this.renderTile(container, tile)
    }
  }

  private preloadAndRebuild(container: Container, tiles: OtbmTile[]): void {
    const spriteIds: number[] = []
    for (const tile of tiles) {
      for (const item of tile.items) {
        const appearance = this.appearances.objects.get(item.id)
        if (!appearance) continue
        const sid = getItemSpriteId(appearance, item, tile)
        if (sid != null && sid !== 0) spriteIds.push(sid)
      }
    }

    if (spriteIds.length > 0) {
      preloadSheets(spriteIds).then(() => {
        container.removeChildren()
        this.buildChunkSync(container, tiles)
        // Update the cached texture with newly loaded sprites
        if (container.isCachedAsTexture) {
          container.updateCacheTexture()
        }
      })
    }
  }

  private renderTile(parent: Container, tile: OtbmTile): void {
    const baseX = tile.x * TILE_SIZE
    const baseY = tile.y * TILE_SIZE

    // Sort items by draw order
    const ground: OtbmItem[] = []
    const bottom: OtbmItem[] = []
    const common: OtbmItem[] = []
    const top: OtbmItem[] = []

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
    // OTClient draws: ground → bottom (forward), common (REVERSE), top
    common.reverse()
    const drawOrder = [...ground, ...bottom, ...common, ...top]

    for (const item of drawOrder) {
      const appearance = this.appearances.objects.get(item.id)
      if (!appearance) continue

      const spriteId = getItemSpriteId(appearance, item, tile)
      if (spriteId == null || spriteId === 0) continue

      const texture = getTextureSync(spriteId)
      if (!texture) continue

      const sprite = new Sprite(texture)
      sprite.roundPixels = true

      // Position: anchor at bottom-right of sprite, offset by elevation and displacement.
      const shift = appearance.flags?.shift
      sprite.x = baseX + TILE_SIZE - texture.width - elevation - (shift?.x ?? 0)
      sprite.y = baseY + TILE_SIZE - texture.height - elevation - (shift?.y ?? 0)

      parent.addChild(sprite)

      // Accumulate elevation
      if (appearance.flags?.height?.elevation) {
        elevation = Math.min(elevation + appearance.flags.height.elevation, MAX_ELEVATION)
      }
    }
  }

  destroy(): void {
    this.app.ticker.remove(this.update, this)
    this.recycleAllChunks()
    this.mapContainer.destroy({ children: true })
  }
}
