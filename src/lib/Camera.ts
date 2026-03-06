import {
  TILE_SIZE, CHUNK_PX, GROUND_LAYER, ZOOM_LEVELS,
  type FloorViewMode,
} from './constants'

export interface ScreenSize {
  readonly width: number
  readonly height: number
}

export class Camera {
  x = 0 // world pixel position
  y = 0
  private _zoom = 1
  private _floor = GROUND_LAYER
  private _floorViewMode: FloorViewMode = 'single'
  private _showTransparentUpper = false

  // Cached visible floors (recomputed only when floor/mode changes)
  private _visibleFloorsCache: number[] = [GROUND_LAYER]
  private _visibleFloorsDirty = true

  // Reusable range output (avoids per-call allocation)
  private _range = { startX: 0, startY: 0, endX: 0, endY: 0 }

  private screen: ScreenSize
  constructor(screen: ScreenSize) {
    this.screen = screen
  }

  // ── Getters ─────────────────────────────────────────────────────

  get zoom(): number { return this._zoom }
  get floor(): number { return this._floor }
  get floorViewMode(): FloorViewMode { return this._floorViewMode }
  get showTransparentUpper(): boolean { return this._showTransparentUpper }
  get worldX(): number { return Math.floor(this.x / TILE_SIZE) }
  get worldY(): number { return Math.floor(this.y / TILE_SIZE) }

  // ── State mutations (return true if changed) ───────────────────

  setFloor(z: number): boolean {
    if (z < 0 || z > 15 || z === this._floor) return false
    this._floor = z
    this._visibleFloorsDirty = true
    return true
  }

  setFloorViewMode(mode: FloorViewMode): boolean {
    if (mode === this._floorViewMode) return false
    this._floorViewMode = mode
    this._visibleFloorsDirty = true
    return true
  }

  setShowTransparentUpper(v: boolean): boolean {
    if (v === this._showTransparentUpper) return false
    this._showTransparentUpper = v
    return true
  }

  centerOn(x: number, y: number): void {
    const offset = this.getFloorOffset(this._floor)
    this.x = x * TILE_SIZE - this.screen.width / (2 * this._zoom) - offset
    this.y = y * TILE_SIZE - this.screen.height / (2 * this._zoom) - offset
  }

  /** Set zoom to a specific level, keeping the viewport center stable. */
  setZoom(level: number, screenWidth: number, screenHeight: number): void {
    // Find the nearest ZOOM_LEVELS entry
    let bestIdx = 0
    let bestDist = Math.abs(ZOOM_LEVELS[0] - level)
    for (let i = 1; i < ZOOM_LEVELS.length; i++) {
      const dist = Math.abs(ZOOM_LEVELS[i] - level)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }
    const newZoom = ZOOM_LEVELS[bestIdx]
    if (newZoom === this._zoom) return

    // Compute world center before zoom change
    const centerWorldX = this.x + screenWidth / (2 * this._zoom)
    const centerWorldY = this.y + screenHeight / (2 * this._zoom)

    this._zoom = newZoom

    // Restore center after zoom change
    this.x = centerWorldX - screenWidth / (2 * this._zoom)
    this.y = centerWorldY - screenHeight / (2 * this._zoom)
  }

  /** Zoom to the next discrete level, anchoring at a screen point. */
  zoomAt(screenX: number, screenY: number, deltaY: number): void {
    const worldBeforeX = this.x + screenX / this._zoom
    const worldBeforeY = this.y + screenY / this._zoom

    const currentIdx = ZOOM_LEVELS.indexOf(this._zoom)
    let nextIdx: number
    if (currentIdx === -1) {
      nextIdx = ZOOM_LEVELS.findIndex(z => z >= this._zoom)
      if (nextIdx === -1) nextIdx = ZOOM_LEVELS.length - 1
    } else {
      nextIdx = deltaY < 0
        ? Math.min(currentIdx + 1, ZOOM_LEVELS.length - 1)
        : Math.max(currentIdx - 1, 0)
    }
    this._zoom = ZOOM_LEVELS[nextIdx]

    this.x = worldBeforeX - screenX / this._zoom
    this.y = worldBeforeY - screenY / this._zoom
  }

  // ── Floor helpers ──────────────────────────────────────────────

  /** Diagonal pixel offset for a given floor, matching RME's getDrawPosition. */
  getFloorOffset(z: number): number {
    if (z <= GROUND_LAYER) {
      return (GROUND_LAYER - z) * TILE_SIZE
    }
    return (this._floor - z) * TILE_SIZE
  }

  /** List of floors to render, in back-to-front order (highest Z first). Cached. */
  getVisibleFloors(): number[] {
    if (!this._visibleFloorsDirty) return this._visibleFloorsCache

    const floors: number[] = []

    if (this._floorViewMode === 'single') {
      floors.push(this._floor)
    } else {
      let startZ: number
      let endZ: number

      if (this._floor <= GROUND_LAYER) {
        startZ = GROUND_LAYER
        endZ = this._floorViewMode === 'current-below' ? this._floor : 0
      } else {
        startZ = Math.min(15, this._floor + 2)
        endZ = this._floor
      }

      for (let z = startZ; z >= endZ; z--) {
        floors.push(z)
      }
    }

    this._visibleFloorsCache = floors
    this._visibleFloorsDirty = false
    return floors
  }

  // ── Viewport ───────────────────────────────────────────────────

  /**
   * Visible chunk range for a floor at a given pixel offset.
   * Returns a reusable object — consume values before calling again.
   */
  getVisibleRangeForFloor(floorOffset: number) {
    const r = this._range
    r.startX = Math.floor((this.x + floorOffset) / CHUNK_PX) - 1
    r.startY = Math.floor((this.y + floorOffset) / CHUNK_PX) - 1
    r.endX = Math.floor((this.x + floorOffset + this.screen.width / this._zoom) / CHUNK_PX) + 1
    r.endY = Math.floor((this.y + floorOffset + this.screen.height / this._zoom) / CHUNK_PX) + 1
    return r
  }

  /** Screen coordinates to world tile coordinates. */
  getTileAt(screenX: number, screenY: number): { x: number; y: number; z: number } {
    const offset = this.getFloorOffset(this._floor)
    const worldX = Math.floor((this.x + offset + screenX / this._zoom) / TILE_SIZE)
    const worldY = Math.floor((this.y + offset + screenY / this._zoom) / TILE_SIZE)
    return { x: worldX, y: worldY, z: this._floor }
  }

  /** Build a range key string for dirty checking. */
  computeRangeKey(visibleFloors: number[]): string {
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
}
