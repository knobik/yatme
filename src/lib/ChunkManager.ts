import { Container, type Sprite } from 'pixi.js'
import { getTextureSync, preloadSheets } from './TextureManager'
import { getItemSpriteId, type AnimatedSpriteRef } from './SpriteResolver'
import { CHUNK_SIZE, CHUNK_CACHE_SIZE, CHUNK_BUILD_BUDGET_MS, PREFETCH_RING } from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmTile } from './otbm'
import type { Camera } from './Camera'
import type { TileRenderer } from './TileRenderer'

// ── Chunk key ───────────────────────────────────────────────────────

export function chunkKeyStr(cx: number, cy: number, z: number): string {
  return `${cx},${cy},${z}`
}

/** Chunk key from tile world coordinates (divides by CHUNK_SIZE internally). */
export function chunkKeyForTile(x: number, y: number, z: number): string {
  return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)},${z}`
}

// ── Chunk index ─────────────────────────────────────────────────────

export function buildChunkIndex(
  tiles: Map<string, OtbmTile>,
  appearances: AppearanceData,
): { index: Map<string, OtbmTile[]>, animatedKeys: Set<string> } {
  const index = new Map<string, OtbmTile[]>()
  const animatedKeys = new Set<string>()

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

    if (!animatedKeys.has(key) && chunkHasAnimatedItems([tile], appearances)) {
      animatedKeys.add(key)
    }
  }

  // Pre-sort each chunk's tiles by draw order (Y ascending, then X ascending)
  for (const arr of index.values()) {
    arr.sort((a, b) => a.y - b.y || a.x - b.x)
  }
  return { index, animatedKeys }
}

// ── Container cleanup ────────────────────────────────────────────────

function destroyContainer(container: Container): void {
  if (container.isCachedAsTexture) container.cacheAsTexture(false)
  container.parent?.removeChild(container)
  container.removeChildren()
  container.destroy()
}

/** Check whether any tile in a chunk contains an animated item. */
function chunkHasAnimatedItems(tiles: OtbmTile[], appearances: AppearanceData): boolean {
  for (const tile of tiles) {
    for (const item of tile.items) {
      const info = appearances.objects.get(item.id)?.frameGroup?.[0]?.spriteInfo
      if (info?.animation && info.animation.spritePhase.length > 1) return true
    }
  }
  return false
}

// ── LRU chunk cache ─────────────────────────────────────────────────

export class ChunkCache {
  private cache = new Map<string, Container>() // insertion-order = LRU order
  private maxSize: number
  onEvict?: (key: string) => void

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
    const existing = this.cache.get(key)
    if (existing) {
      destroyContainer(existing)
      this.cache.delete(key)
      this.onEvict?.(key)
    }
    this.cache.set(key, container)
    this.evict()
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  /** Evict and destroy a specific entry. */
  delete(key: string): void {
    const container = this.cache.get(key)
    if (container) {
      destroyContainer(container)
      this.cache.delete(key)
      this.onEvict?.(key)
    }
  }

  clear(): void {
    for (const container of this.cache.values()) {
      destroyContainer(container)
    }
    this.cache.clear()
  }

  private evict(): void {
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value!
      destroyContainer(this.cache.get(firstKey)!)
      this.cache.delete(firstKey)
      this.onEvict?.(firstKey)
    }
  }
}

// ── Stateful ChunkManager ───────────────────────────────────────────

export interface ChunkManagerDeps {
  appearances: AppearanceData
  tileRenderer: TileRenderer
  camera: Camera
  getFloorContainer: (z: number) => Container
}

export class ChunkManager {
  private appearances: AppearanceData
  private tileRenderer: TileRenderer
  private camera: Camera
  private getFloorContainer: (z: number) => Container

  // Chunk index & active state
  private chunkIndex: Map<string, OtbmTile[]>
  private activeChunks = new Map<string, Container>()
  private chunkCache = new ChunkCache(CHUNK_CACHE_SIZE)

  // Prefetch build queue
  private buildQueue: string[] = []
  private buildQueueReadIdx = 0
  private buildQueueSet = new Set<string>()

  // Dirty tracking
  private _lastRangeKey = ''
  private _allVisibleKeys = new Set<string>()
  private _allPrefetchKeys = new Set<string>()

  // Animation state
  private _animStartTime: number
  private _animElapsed = 0
  private _animLastUpdate = 0
  private _animatedChunkKeys: Set<string>
  private _chunkAnimSprites = new Map<string, AnimatedSpriteRef[]>()

  // Highlight breathing animation
  private _chunkHighlightSprites = new Map<string, Sprite[]>()

  constructor(
    deps: ChunkManagerDeps,
    chunkIndex: Map<string, OtbmTile[]>,
    animatedKeys: Set<string>,
  ) {
    this.appearances = deps.appearances
    this.tileRenderer = deps.tileRenderer
    this.camera = deps.camera
    this.getFloorContainer = deps.getFloorContainer

    this.chunkIndex = chunkIndex
    this._animatedChunkKeys = animatedKeys
    this._animStartTime = performance.now()
    this.chunkCache.onEvict = (key) => {
      this._chunkAnimSprites.delete(key)
      this._chunkHighlightSprites.delete(key)
    }
  }

  /** Called once per frame — handles visibility, build/restore, eviction, animation, prefetch. */
  update(visibleFloors: number[]): void {
    this._animElapsed = performance.now() - this._animStartTime

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
      const floorContainer = this.getFloorContainer(z)
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
          const hlSprites: Sprite[] = []
          const animSprites = this.buildChunkSync(container, tiles, this._animElapsed, hlSprites)
          container.cacheAsTexture({ scaleMode: 'nearest', antialias: false })
          if (animSprites.length > 0) {
            this._chunkAnimSprites.set(key, animSprites)
          }
          if (hlSprites.length > 0) {
            this._chunkHighlightSprites.set(key, hlSprites)
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

    this.updateAnimatedSprites()
    this.updateHighlightBreathing()

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

  /** Invalidate specific chunks, forcing them to rebuild on next frame. */
  invalidateChunks(keys: Set<string>): void {
    for (const key of keys) {
      const active = this.activeChunks.get(key)
      if (active) {
        destroyContainer(active)
        this.activeChunks.delete(key)
      }
      this.chunkCache.delete(key)
      this._chunkAnimSprites.delete(key)
      this._chunkHighlightSprites.delete(key)
    }
    this._lastRangeKey = ''
  }

  /** Update the chunk index when a tile is created or modified. */
  updateChunkIndex(tile: OtbmTile): void {
    const key = chunkKeyForTile(tile.x, tile.y, tile.z)
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
    if (chunkHasAnimatedItems(arr, this.appearances)) {
      this._animatedChunkKeys.add(key)
    }
  }

  /** In-place rebuild of specific active chunks (no destroy/flicker). Used for highlight changes. */
  rebuildChunksForHighlight(chunkKeys: Iterable<string>): void {
    for (const key of chunkKeys) {
      const container = this.activeChunks.get(key)
      if (!container) continue
      const tiles = this.chunkIndex.get(key)
      if (!tiles) continue

      container.removeChildren()
      const hlSprites: Sprite[] = []
      const animSprites = this.buildChunkSync(container, tiles, this._animElapsed, hlSprites)
      if (animSprites.length > 0) {
        this._chunkAnimSprites.set(key, animSprites)
      }
      if (hlSprites.length > 0) {
        this._chunkHighlightSprites.set(key, hlSprites)
      } else {
        this._chunkHighlightSprites.delete(key)
      }
      if (container.isCachedAsTexture) {
        container.updateCacheTexture()
      }
    }
  }

  /** Destroy all active & cached chunks, reset queues. */
  recycleAll(): void {
    for (const container of this.activeChunks.values()) {
      destroyContainer(container)
    }
    this.activeChunks.clear()
    this._chunkAnimSprites.clear()
    this._chunkHighlightSprites.clear()
    this.chunkCache.clear()
    this.buildQueue.length = 0
    this.buildQueueReadIdx = 0
    this.buildQueueSet.clear()
    this._lastRangeKey = ''
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

  // ── Highlight breathing animation ──────────────────────────────

  private updateHighlightBreathing(): void {
    if (this._chunkHighlightSprites.size === 0) return

    // Sine wave: period ~1.5s, alpha oscillates between 0.1 and 0.4
    const alpha = 0.45 + 0.075 * Math.sin(this._animElapsed * 0.004)

    for (const [key, sprites] of this._chunkHighlightSprites) {
      const container = this.activeChunks.get(key)
      if (!container) continue

      for (const s of sprites) s.alpha = alpha

      if (container.isCachedAsTexture) {
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
      const hlSprites: Sprite[] = []
      const animSprites = this.buildChunkSync(container, tiles, this._animElapsed, hlSprites)
      if (animSprites.length > 0) {
        this._chunkAnimSprites.set(key, animSprites)
      }
      if (hlSprites.length > 0) {
        this._chunkHighlightSprites.set(key, hlSprites)
      }
      this.preloadAndRebuild(container, tiles, key)
      this.chunkCache.set(key, container)
    }

    if (this.buildQueueReadIdx >= this.buildQueue.length) {
      this.buildQueue.length = 0
      this.buildQueueReadIdx = 0
    }
  }

  // ── Chunk building ─────────────────────────────────────────────

  private buildChunkSync(
    container: Container,
    tiles: OtbmTile[],
    elapsedMs: number,
    outHighlightSprites?: Sprite[],
  ): AnimatedSpriteRef[] {
    const animSprites: AnimatedSpriteRef[] = []
    const hlSprites = outHighlightSprites ?? []
    for (const tile of tiles) {
      this.tileRenderer.renderTile(container, tile, elapsedMs, animSprites, hlSprites)
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
        const hlSprites: Sprite[] = []
        const animSprites = this.buildChunkSync(container, tiles, elapsed, hlSprites)
        if (animSprites.length > 0) {
          this._chunkAnimSprites.set(chunkKey, animSprites)
        }
        if (hlSprites.length > 0) {
          this._chunkHighlightSprites.set(chunkKey, hlSprites)
        } else {
          this._chunkHighlightSprites.delete(chunkKey)
        }
        if (container.isCachedAsTexture) {
          container.updateCacheTexture()
        }
      })
    }
  }
}
