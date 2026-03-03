import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { getTextureSync, preloadSheets } from './TextureManager'
import type { AppearanceData } from './appearances'
import type { Appearance, SpriteInfo, SpriteAnimation } from '../proto/appearances'
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

/** Ref to an animated sprite for in-place texture updates (avoids chunk rebuild). */
interface AnimatedSpriteRef {
  sprite: Sprite
  appearance: Appearance
  item: OtbmItem
  tile: OtbmTile
}

// ── Chunk index ─────────────────────────────────────────────────────

function chunkKeyStr(cx: number, cy: number, z: number): string {
  return `${cx},${cy},${z}`
}

function buildChunkIndex(
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

    // Detect animated items for this chunk
    if (!animatedKeys.has(key)) {
      for (const item of tile.items) {
        const appearance = appearances.objects.get(item.id)
        const info = appearance?.frameGroup?.[0]?.spriteInfo
        if (info?.animation && info.animation.spritePhase.length > 1) {
          animatedKeys.add(key)
          break
        }
      }
    }
  }

  // Pre-sort each chunk's tiles by draw order (Y ascending, then X ascending)
  // so buildChunkSync doesn't need to sort on every build
  for (const arr of index.values()) {
    arr.sort((a, b) => a.y - b.y || a.x - b.x)
  }
  return { index, animatedKeys }
}

// ── LRU chunk cache ─────────────────────────────────────────────────

class ChunkCache {
  private cache = new Map<string, Container>() // insertion-order = LRU order
  private maxSize: number
  onEvict?: (key: string) => void // called when a chunk is destroyed (evicted or replaced)

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
      this.onEvict?.(key)
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
      this.onEvict?.(firstKey)
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
  const phases = info.animation?.spritePhase?.length ?? 1
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
  elapsedMs: number = 0,
  overridePhase?: number,
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

  // Compute animation phase
  let animPhase = overridePhase ?? 0
  if (overridePhase === undefined && info.animation && info.animation.spritePhase.length > 1) {
    animPhase = getAnimationPhase(info.animation, elapsedMs)
  }

  return getSpriteIndex(info, xPattern, yPattern, zPattern, 0, animPhase)
}

// ── Animation phase calculation ─────────────────────────────────────

/** Precompute average durations for an animation (avoids per-frame allocation). */
function getAvgDurations(animation: SpriteAnimation): number[] {
  return animation.spritePhase.map(p => (p.durationMin + p.durationMax) / 2)
}

/** Animation duration cache — keyed by animation object identity. */
const animDurationCache = new WeakMap<SpriteAnimation, { durations: number[], total: number }>()

function getCachedDurations(animation: SpriteAnimation): { durations: number[], total: number } {
  let cached = animDurationCache.get(animation)
  if (!cached) {
    const durations = getAvgDurations(animation)
    const total = durations.reduce((a, b) => a + b, 0)
    cached = { durations, total }
    animDurationCache.set(animation, cached)
  }
  return cached
}

function getAnimationPhase(animation: SpriteAnimation, elapsedMs: number): number {
  const phases = animation.spritePhase
  if (!phases || phases.length <= 1) return 0

  const { durations, total } = getCachedDurations(animation)
  if (total <= 0) return 0

  if (animation.loopType === -1) { // PINGPONG
    // Forward: 0,1,...,n-1; Backward: n-2,...,1 (skip endpoints to avoid double-counting)
    let backwardDuration = 0
    for (let i = phases.length - 2; i >= 1; i--) {
      backwardDuration += durations[i]
    }
    const cycleDuration = total + backwardDuration
    if (cycleDuration <= 0) return 0

    const t = elapsedMs % cycleDuration
    let accum = 0
    // Forward pass
    for (let i = 0; i < phases.length; i++) {
      accum += durations[i]
      if (t < accum) return i
    }
    // Backward pass
    for (let i = phases.length - 2; i >= 1; i--) {
      accum += durations[i]
      if (t < accum) return i
    }
    return 0
  }

  // INFINITE or COUNTED (treat counted as infinite for map viewer)
  const t = elapsedMs % total
  let accum = 0
  for (let i = 0; i < phases.length; i++) {
    accum += durations[i]
    if (t < accum) return i
  }
  return phases.length - 1
}

// ── MapRenderer ─────────────────────────────────────────────────────

export class MapRenderer {
  private app: Application
  private mapContainer: Container
  private appearances: AppearanceData
  private chunkIndex: Map<string, OtbmTile[]>
  private readonly mapData: OtbmMap

  // Camera state
  private cameraX = 0 // world pixel position
  private cameraY = 0
  private _zoom = 1
  private _floor = 7
  private _floorViewMode: FloorViewMode = 'single'
  private _showTransparentUpper = false

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
  // Reusable per-tile arrays (avoid allocations in renderTile hot path)
  private _ground: OtbmItem[] = []
  private _bottom: OtbmItem[] = []
  private _common: OtbmItem[] = []
  private _top: OtbmItem[] = []
  private _drawOrder: OtbmItem[] = []

  // Animation state
  private _animStartTime: number
  private _animElapsed = 0
  private _animLastUpdate = 0
  private _animatedChunkKeys: Set<string> // precomputed: which chunk keys have animations
  private _chunkAnimSprites = new Map<string, AnimatedSpriteRef[]>() // active animated sprite refs

  // Tile selection
  private _selectedTileX = -1
  private _selectedTileY = -1
  private _selectedTileZ = -1
  private _highlightGraphics: Graphics
  private _highlightContainer: Container
  private _dragDist = 0

  // Callbacks
  onCameraChange?: (x: number, y: number, zoom: number, floor: number, floorViewMode: FloorViewMode, showTransparentUpper: boolean) => void
  onTileClick?: (tile: OtbmTile | null, worldX: number, worldY: number) => void

  constructor(app: Application, appearances: AppearanceData, mapData: OtbmMap) {
    this.app = app
    this.appearances = appearances
    this.mapData = mapData
    const { index, animatedKeys } = buildChunkIndex(mapData.tiles, appearances)
    this.chunkIndex = index
    this._animatedChunkKeys = animatedKeys
    this._animStartTime = performance.now()
    this.chunkCache.onEvict = (key) => this._chunkAnimSprites.delete(key)

    this.mapContainer = new Container()
    this.app.stage.addChild(this.mapContainer)

    // Highlight overlay for selected tile (rendered above all floor containers)
    this._highlightContainer = new Container()
    this._highlightGraphics = new Graphics()
    this._highlightGraphics.visible = false
    this._highlightContainer.addChild(this._highlightGraphics)
    this.mapContainer.addChild(this._highlightContainer)

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
  get showTransparentUpper(): boolean { return this._showTransparentUpper }
  get worldX(): number { return Math.floor(this.cameraX / TILE_SIZE) }
  get worldY(): number { return Math.floor(this.cameraY / TILE_SIZE) }

  setFloor(z: number): void {
    if (z < 0 || z > 15) return
    this._floor = z
    this.deselectTile()
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setFloorViewMode(mode: FloorViewMode): void {
    if (mode === this._floorViewMode) return
    this._floorViewMode = mode
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setShowTransparentUpper(v: boolean): void {
    if (v === this._showTransparentUpper) return
    this._showTransparentUpper = v
    // Only alpha changes — no need to rebuild chunks, just invalidate floor tracking
    // so updateFloorContainers re-applies the correct alpha values next frame
    this._lastVisibleFloors = []
    this.notifyCamera()
  }

  centerOn(x: number, y: number): void {
    this.cameraX = x * TILE_SIZE - this.app.screen.width / (2 * this._zoom)
    this.cameraY = y * TILE_SIZE - this.app.screen.height / (2 * this._zoom)
    this.notifyCamera()
  }

  // ── Tile selection ──────────────────────────────────────────────

  getTileAt(screenX: number, screenY: number): { x: number; y: number; z: number } {
    const offset = this.getFloorOffset(this._floor)
    const worldX = Math.floor((this.cameraX + offset + screenX / this._zoom) / TILE_SIZE)
    const worldY = Math.floor((this.cameraY + offset + screenY / this._zoom) / TILE_SIZE)
    return { x: worldX, y: worldY, z: this._floor }
  }

  deselectTile(): void {
    this._selectedTileX = -1
    this._selectedTileY = -1
    this._selectedTileZ = -1
    this._highlightGraphics.visible = false
    this.onTileClick?.(null, -1, -1)
  }

  private updateHighlight(): void {
    if (this._selectedTileX < 0 || this._selectedTileZ !== this._floor) {
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

    // Position highlight container with the same floor offset
    const offset = this.getFloorOffset(this._floor)
    this._highlightContainer.position.set(-offset, -offset)
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
        this._dragDist = 0
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
      this._dragDist = Math.sqrt(dx * dx + dy * dy)
      this.cameraX = this.cameraStartX - dx / this._zoom
      this.cameraY = this.cameraStartY - dy / this._zoom
      this.notifyCamera()
    })

    canvas.addEventListener('pointerup', (e) => {
      if (this.dragging) {
        const wasClick = this._dragDist < 4
        this.dragging = false
        canvas.releasePointerCapture(e.pointerId)

        if (wasClick && e.button === 0) {
          const rect = canvas.getBoundingClientRect()
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const pos = this.getTileAt(screenX, screenY)
          const key = `${pos.x},${pos.y},${pos.z}`
          const tile = this.mapData.tiles.get(key) ?? null
          this._selectedTileX = pos.x
          this._selectedTileY = pos.y
          this._selectedTileZ = pos.z
          this.updateHighlight()
          this.onTileClick?.(tile, pos.x, pos.y)
        }
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
    this.onCameraChange?.(this.worldX, this.worldY, this._zoom, this._floor, this._floorViewMode, this._showTransparentUpper)
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
        container.alpha = (z < this._floor && this._showTransparentUpper) ? FLOOR_ABOVE_ALPHA : 1.0
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
      container.alpha = (z < this._floor && this._showTransparentUpper) ? FLOOR_ABOVE_ALPHA : 1.0
    }

    // Re-add to mapContainer in correct Z-order (back-to-front)
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
    // Highlight always on top
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

  // ── Update loop ─────────────────────────────────────────────────

  /** Build a range key string for dirty checking. */
  private computeRangeKey(visibleFloors: number[]): string {
    let minSX = Infinity, minSY = Infinity, maxEX = -Infinity, maxEY = -Infinity
    for (const z of visibleFloors) {
      const offset = this.getFloorOffset(z)
      const { startX, startY, endX, endY } = this.getVisibleRangeForFloor(offset)
      if (startX < minSX) minSX = startX
      if (startY < minSY) minSY = startY
      if (endX > maxEX) maxEX = endX
      if (endY > maxEY) maxEY = endY
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

    // Animation elapsed time (consistent across all chunks this frame)
    this._animElapsed = performance.now() - this._animStartTime

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

    // Update selected tile highlight position
    this.updateHighlight()

    // Update animated sprite textures in-place, then re-render affected chunk caches
    this.updateAnimatedSprites()

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

  /** Update animated sprite textures in-place and re-render affected chunk caches. */
  private updateAnimatedSprites(): void {
    if (this._chunkAnimSprites.size === 0) return

    // Throttle to ~100ms intervals (most Tibia animations are 100-500ms per phase)
    const timeSinceUpdate = this._animElapsed - this._animLastUpdate
    if (timeSinceUpdate < 100) return
    this._animLastUpdate = this._animElapsed

    for (const [key, sprites] of this._chunkAnimSprites) {
      // Only update active (on-screen) chunks
      const container = this.activeChunks.get(key)
      if (!container) continue

      // Swap textures on animated sprites, track if anything changed
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

      // Only re-render the cache if at least one sprite changed
      if (changed && container.isCachedAsTexture) {
        container.updateCacheTexture()
      }
    }
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
      const animSprites = this.buildChunkSync(container, tiles, this._animElapsed)
      if (animSprites.length > 0) {
        this._chunkAnimSprites.set(key, animSprites)
      }
      this.preloadAndRebuild(container, tiles, key)

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
    this._chunkAnimSprites.clear()
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

  private buildChunkSync(container: Container, tiles: OtbmTile[], elapsedMs: number): AnimatedSpriteRef[] {
    // Tiles are pre-sorted in buildChunkIndex (Y ascending, then X ascending)
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
        // Collect sprites for ALL animation phases so they're preloaded
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
        // Refresh animation tracking (old sprite refs are stale after rebuild)
        if (animSprites.length > 0) {
          this._chunkAnimSprites.set(chunkKey, animSprites)
        }
        // Update the cached texture (only for static chunks)
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

    // Sort items by draw order — reuse class-level arrays to avoid allocations
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
    // OTClient draws: ground → bottom (forward), common (REVERSE), top
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

      // Position: anchor at bottom-right of sprite, offset by elevation and displacement.
      const shift = appearance.flags?.shift
      sprite.x = baseX + TILE_SIZE - texture.width - elevation - (shift?.x ?? 0)
      sprite.y = baseY + TILE_SIZE - texture.height - elevation - (shift?.y ?? 0)

      parent.addChild(sprite)

      // Track animated sprites for in-place texture updates
      if (animSprites) {
        const info = appearance.frameGroup?.[0]?.spriteInfo
        if (info?.animation && info.animation.spritePhase.length > 1) {
          animSprites.push({ sprite, appearance, item, tile })
        }
      }

      // Accumulate elevation
      if (appearance.flags?.height?.elevation) {
        elevation = Math.min(elevation + appearance.flags.height.elevation, MAX_ELEVATION)
      }
    }
  }

  destroy(): void {
    this.app.ticker.remove(this.update, this)
    this.recycleAllChunks()
    this._highlightGraphics.destroy()
    this._highlightContainer.destroy()
    this.mapContainer.destroy({ children: true })
  }
}
