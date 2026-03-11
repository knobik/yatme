import { Container, Sprite, Graphics, Texture, ImageSource } from 'pixi.js'
import { CHUNK_SIZE } from './constants'
import { chunkKeyStr } from './ChunkManager'
import { colorFromEightBit } from './colorUtils'
import type { Camera } from './Camera'
import type { AppearanceData } from './appearances'
import type { OtbmTile } from './otbm'

// ── Constants ────────────────────────────────────────────────────────

const BM_WIDTH = 200
const BM_HEIGHT = 150
const PADDING = 4
const BORDER_WIDTH = 1
const BG_COLOR = 0x12121a
const BORDER_COLOR = 0x2a2a35
const VIEWPORT_COLOR = 0xd4a549
const VIEWPORT_ALPHA = 0.8
const MARGIN_RIGHT = 12
const MARGIN_BOTTOM = 68

/** Base discrete zoom levels: tiles per minimap pixel. Lower = more zoomed in. */
export const BASE_ZOOM_LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256] as const

// ── Pre-computed color LUT ──────────────────────────────────────────

const COLOR_LUT = new Uint32Array(216)
for (let i = 0; i < 216; i++) {
  const [r, g, b] = colorFromEightBit(i)
  // ABGR for little-endian ImageData (0xAABBGGRR)
  COLOR_LUT[i] = (255 << 24) | (b << 16) | (g << 8) | r
}

// ── MinimapOverlay ──────────────────────────────────────────────────

export class MinimapOverlay {
  private _container: Container
  private _bg: Graphics
  private _bitmapSprite: Sprite
  private _viewportRect: Graphics
  private _zoomLabel: Graphics

  private _canvas: HTMLCanvasElement
  private _ctx: CanvasRenderingContext2D
  private _source: ImageSource | null = null
  private _texture: Texture | null = null
  private _imageData: ImageData | null = null

  private _visible = true
  private _dirty = true
  private _lastFloor = -1
  private _lastViewKey = ''

  // Throttle bitmap generation
  private _lastBitmapTime = -Infinity
  private _bitmapInterval = 100 // ms between bitmap rebuilds

  // Cached view origin (recomputed once per rebuild, reused in updateViewport)
  private _cachedViewMinX = 0
  private _cachedViewMinY = 0

  // Cache viewport rect to avoid redrawing every frame
  private _lastVpKey = ''

  // Map bounds (tile coordinates)
  private _mapWidth = 0
  private _mapHeight = 0
  private _mapMinX = 0
  private _mapMinY = 0

  // Minimap view state
  private _zoomLevels: number[] = [1] // per-instance zoom levels (includes fit-all at the end)
  private _zoomIdx = 0 // index into _zoomLevels
  private _viewCenterX = 0 // tile coordinate the minimap is centered on
  private _viewCenterY = 0

  // Drag state
  private _dragging = false

  // Per-chunk color cache: chunkKey -> Uint8Array(CHUNK_SIZE * CHUNK_SIZE) of automap color indices
  private _chunkColorCache = new Map<string, Uint8Array>()
  private _dirtyChunks = new Set<string>() // chunks needing color recompute

  // Callback for navigation
  onNavigate: ((tileX: number, tileY: number) => void) | null = null

  constructor() {
    this._container = new Container()
    this._container.eventMode = 'static'
    this._container.cursor = 'pointer'
    this._container.sortableChildren = true

    this._bg = new Graphics()
    this._bg.zIndex = 0
    this._container.addChild(this._bg)

    this._canvas = document.createElement('canvas')
    this._canvas.width = BM_WIDTH
    this._canvas.height = BM_HEIGHT
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true })!
    this._bitmapSprite = new Sprite()
    this._bitmapSprite.zIndex = 1
    this._bitmapSprite.x = PADDING + BORDER_WIDTH
    this._bitmapSprite.y = PADDING + BORDER_WIDTH
    this._container.addChild(this._bitmapSprite)

    this._viewportRect = new Graphics()
    this._viewportRect.zIndex = 2
    this._container.addChild(this._viewportRect)

    this._zoomLabel = new Graphics()
    this._zoomLabel.zIndex = 3
    this._container.addChild(this._zoomLabel)

    // Draw static background
    this._drawBackground()

    // Pointer events
    this._container.on('pointerdown', this._onPointerDown, this)
    this._container.on('pointermove', this._onPointerMove, this)
    this._container.on('pointerup', this._onPointerUp, this)
    this._container.on('pointerupoutside', this._onPointerUp, this)
  }

  get container(): Container { return this._container }
  get tilesPerPixel(): number { return this._zoomLevels[this._zoomIdx] }

  setVisible(v: boolean): void {
    this._visible = v
    this._container.visible = v
    if (v) this._dirty = true
  }

  markDirty(): void {
    this._dirty = true
  }

  /** Invalidate specific chunks so their colors are recomputed on next rebuild. */
  invalidateChunks(keys: Iterable<string>): void {
    for (const k of keys) this._dirtyChunks.add(k)
    this._dirty = true
  }

  setMapBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this._mapMinX = minX
    this._mapMinY = minY
    this._mapWidth = maxX - minX
    this._mapHeight = maxY - minY

    if (this._mapWidth <= 0 || this._mapHeight <= 0) return

    // Compute the fit-all tpp (ceil so the entire map fits)
    const fitAllTpp = Math.ceil(Math.max(this._mapWidth / BM_WIDTH, this._mapHeight / BM_HEIGHT, 1))

    // Build zoom levels: all base levels that are smaller than fitAll, plus fitAll at the end
    const levels: number[] = []
    for (const tpp of BASE_ZOOM_LEVELS) {
      if (tpp >= fitAllTpp) break
      levels.push(tpp)
    }
    levels.push(fitAllTpp)
    this._zoomLevels = levels

    // Start at zoom level 3 (4 tpp), clamped to available range
    this._zoomIdx = Math.min(2, levels.length - 1)

    // Center on map center
    this._viewCenterX = minX + this._mapWidth / 2
    this._viewCenterY = minY + this._mapHeight / 2

    this._dirty = true
  }

  /** Check if a screen coordinate falls within the minimap bounds. */
  hitTest(screenX: number, screenY: number): boolean {
    if (!this._visible) return false
    const totalW = BM_WIDTH + (PADDING + BORDER_WIDTH) * 2
    const totalH = BM_HEIGHT + (PADDING + BORDER_WIDTH) * 2
    const lx = screenX - this._container.x
    const ly = screenY - this._container.y
    return lx >= 0 && lx < totalW && ly >= 0 && ly < totalH
  }

  /** Handle scroll wheel zoom. Returns true if zoom changed. */
  handleWheel(deltaY: number): boolean {
    if (!this._visible || this._mapWidth === 0) return false
    if (deltaY > 0) {
      // Zoom out (more tiles per pixel)
      if (this._zoomIdx >= this._zoomLevels.length - 1) return false
      this._zoomIdx++
      this._dirty = true
      return true
    } else {
      // Zoom in (fewer tiles per pixel)
      if (this._zoomIdx <= 0) return false
      this._zoomIdx--
      this._dirty = true
      return true
    }
  }

  // ── Per-frame updates ─────────────────────────────────────────────

  rebuild(
    floor: number,
    chunkIndex: Map<string, OtbmTile[]>,
    appearances: AppearanceData,
  ): void {
    if (!this._visible || this._mapWidth === 0) return

    // Throttle bitmap generation — at most once per _bitmapInterval ms
    const now = performance.now()
    if (now - this._lastBitmapTime < this._bitmapInterval) {
      return
    }

    const floorChanged = floor !== this._lastFloor
    const { viewMinX, viewMinY } = this._getViewOrigin()
    const viewKey = `${this._zoomIdx},${viewMinX},${viewMinY}`
    const viewChanged = viewKey !== this._lastViewKey

    if (!this._dirty && !floorChanged && !viewChanged) return

    // Cache view origin for updateViewport() to reuse
    this._cachedViewMinX = viewMinX
    this._cachedViewMinY = viewMinY

    this._lastFloor = floor
    this._lastViewKey = viewKey
    this._dirty = false
    this._lastBitmapTime = now

    this._generateBitmap(floor, floorChanged, viewMinX, viewMinY, chunkIndex, appearances)
  }

  updateViewport(camera: Camera, screenW: number, screenH: number): void {
    if (!this._visible || this._mapWidth === 0) return

    // Auto-center the minimap view on the main camera position
    if (!this._dragging) {
      const offset = camera.getFloorOffset(camera.floor)
      this._viewCenterX = (camera.x + offset) / 32 + screenW / (camera.zoom * 32) / 2
      this._viewCenterY = (camera.y + offset) / 32 + screenH / (camera.zoom * 32) / 2
    }

    const tpp = this._zoomLevels[this._zoomIdx]
    const viewMinX = this._cachedViewMinX
    const viewMinY = this._cachedViewMinY

    // Compute main camera visible tile range
    const offset = camera.getFloorOffset(camera.floor)
    const tileLeft = (camera.x + offset) / 32
    const tileTop = (camera.y + offset) / 32
    const tileRight = tileLeft + screenW / (camera.zoom * 32)
    const tileBottom = tileTop + screenH / (camera.zoom * 32)

    // Convert to minimap pixel coords
    const x = (tileLeft - viewMinX) / tpp
    const y = (tileTop - viewMinY) / tpp
    const w = (tileRight - tileLeft) / tpp
    const h = (tileBottom - tileTop) / tpp

    // Clamp to bitmap area
    const bx = PADDING + BORDER_WIDTH
    const by = PADDING + BORDER_WIDTH
    const cx = Math.max(0, Math.min(x, BM_WIDTH))
    const cy = Math.max(0, Math.min(y, BM_HEIGHT))
    const cw = Math.max(1, Math.min(w, BM_WIDTH - cx))
    const ch = Math.max(1, Math.min(h, BM_HEIGHT - cy))

    // Only redraw viewport rectangle if it changed
    const vpKey = `${Math.round(cx)},${Math.round(cy)},${Math.round(cw)},${Math.round(ch)}`
    if (vpKey !== this._lastVpKey) {
      this._lastVpKey = vpKey
      this._viewportRect.clear()
      this._viewportRect.setStrokeStyle({ width: 1, color: VIEWPORT_COLOR, alpha: VIEWPORT_ALPHA })
      this._viewportRect.rect(bx + cx, by + cy, cw, ch)
      this._viewportRect.stroke()
    }

    // Position container at bottom-right of screen
    const totalW = BM_WIDTH + (PADDING + BORDER_WIDTH) * 2
    const totalH = BM_HEIGHT + (PADDING + BORDER_WIDTH) * 2
    this._container.x = screenW - totalW - MARGIN_RIGHT
    this._container.y = screenH - totalH - MARGIN_BOTTOM
  }

  // ── View helpers ───────────────────────────────────────────────────

  /** Return the clamped top-left tile coordinate of the minimap view. */
  private _getViewOrigin(): { viewMinX: number; viewMinY: number } {
    const tpp = this._zoomLevels[this._zoomIdx]
    const halfW = BM_WIDTH * tpp / 2
    const halfH = BM_HEIGHT * tpp / 2

    let cx = this._viewCenterX
    let cy = this._viewCenterY

    // Clamp so view stays within map bounds
    if (BM_WIDTH * tpp >= this._mapWidth) {
      cx = this._mapMinX + this._mapWidth / 2
    } else {
      cx = Math.max(this._mapMinX + halfW, Math.min(this._mapMinX + this._mapWidth - halfW, cx))
    }
    if (BM_HEIGHT * tpp >= this._mapHeight) {
      cy = this._mapMinY + this._mapHeight / 2
    } else {
      cy = Math.max(this._mapMinY + halfH, Math.min(this._mapMinY + this._mapHeight - halfH, cy))
    }

    return {
      viewMinX: Math.floor(cx - halfW),
      viewMinY: Math.floor(cy - halfH),
    }
  }

  // ── Bitmap generation ─────────────────────────────────────────────

  private _generateBitmap(
    floor: number,
    floorChanged: boolean,
    viewMinX: number,
    viewMinY: number,
    chunkIndex: Map<string, OtbmTile[]>,
    appearances: AppearanceData,
  ): void {
    const w = BM_WIDTH
    const h = BM_HEIGHT
    const tpp = this._zoomLevels[this._zoomIdx]

    const viewTilesW = w * tpp
    const viewTilesH = h * tpp

    // On floor change, clear the cache — old floor entries use different chunk keys
    // so they won't collide, but pruning keeps memory bounded.
    if (floorChanged) {
      this._chunkColorCache.clear()
    }

    // Update dirty chunk colors in the cache
    const chunkMinX = Math.floor(viewMinX / CHUNK_SIZE)
    const chunkMinY = Math.floor(viewMinY / CHUNK_SIZE)
    const chunkMaxX = Math.floor((viewMinX + viewTilesW - 1) / CHUNK_SIZE)
    const chunkMaxY = Math.floor((viewMinY + viewTilesH - 1) / CHUNK_SIZE)

    for (let cy = chunkMinY; cy <= chunkMaxY; cy++) {
      for (let cx = chunkMinX; cx <= chunkMaxX; cx++) {
        const key = chunkKeyStr(cx, cy, floor)

        // Only recompute if: no cache entry yet, or chunk was explicitly dirtied, or floor changed and not cached
        const needsRecompute = !this._chunkColorCache.has(key) || this._dirtyChunks.has(key)
        if (!needsRecompute && !floorChanged) continue
        if (!needsRecompute) continue // already cached from previous visit to this floor

        const tiles = chunkIndex.get(key)
        if (!tiles) {
          // No tiles — remove any stale cache
          this._chunkColorCache.delete(key)
          continue
        }

        const colors = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)
        const baseX = cx * CHUNK_SIZE
        const baseY = cy * CHUNK_SIZE

        for (const tile of tiles) {
          const color = this._getTileAutomapColor(tile, appearances)
          if (color === 0) continue
          const lx = tile.x - baseX
          const ly = tile.y - baseY
          colors[ly * CHUNK_SIZE + lx] = color
        }

        this._chunkColorCache.set(key, colors)
      }
    }
    this._dirtyChunks.clear()

    // Composite cached chunk colors into the bitmap (reuse ImageData to avoid GC churn)
    if (!this._imageData || this._imageData.width !== w || this._imageData.height !== h) {
      this._imageData = this._ctx.createImageData(w, h)
    }
    const imageData = this._imageData
    const buf32 = new Uint32Array(imageData.data.buffer)
    buf32.fill(0xFF000000) // black

    for (let cy = chunkMinY; cy <= chunkMaxY; cy++) {
      for (let cx = chunkMinX; cx <= chunkMaxX; cx++) {
        const key = chunkKeyStr(cx, cy, floor)
        const colors = this._chunkColorCache.get(key)
        if (!colors) continue

        const baseX = cx * CHUNK_SIZE
        const baseY = cy * CHUNK_SIZE

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const color = colors[ly * CHUNK_SIZE + lx]
            if (color === 0) continue

            const px = Math.floor((baseX + lx - viewMinX) / tpp)
            const py = Math.floor((baseY + ly - viewMinY) / tpp)
            if (px < 0 || px >= w || py < 0 || py >= h) continue

            buf32[py * w + px] = COLOR_LUT[color]
          }
        }
      }
    }

    // Write to canvas
    this._ctx.putImageData(imageData, 0, 0)

    // Upload to PixiJS texture
    if (this._source && this._source.width === w && this._source.height === h) {
      this._source.update()
    } else {
      if (this._texture) this._texture.destroy(true)
      this._source = new ImageSource({
        resource: this._canvas,
        scaleMode: 'nearest',
      })
      this._texture = new Texture({ source: this._source })
    }

    this._bitmapSprite.texture = this._texture!
    this._bitmapSprite.width = w
    this._bitmapSprite.height = h
  }

  /** Get the automap color for a tile (scan items in reverse, first non-zero wins). */
  private _getTileAutomapColor(tile: OtbmTile, appearances: AppearanceData): number {
    for (let i = tile.items.length - 1; i >= 0; i--) {
      const appearance = appearances.objects.get(tile.items[i].id)
      const automap = appearance?.flags?.automap
      if (automap && automap.color > 0 && automap.color < 216) {
        return automap.color
      }
    }
    return 0
  }

  // ── Background ────────────────────────────────────────────────────

  private _drawBackground(): void {
    const totalW = BM_WIDTH + (PADDING + BORDER_WIDTH) * 2
    const totalH = BM_HEIGHT + (PADDING + BORDER_WIDTH) * 2

    this._bg.clear()
    // Border
    this._bg.setFillStyle({ color: BORDER_COLOR })
    this._bg.roundRect(0, 0, totalW, totalH, 3)
    this._bg.fill()
    // Inner background
    this._bg.setFillStyle({ color: BG_COLOR })
    this._bg.roundRect(BORDER_WIDTH, BORDER_WIDTH, totalW - BORDER_WIDTH * 2, totalH - BORDER_WIDTH * 2, 2)
    this._bg.fill()
  }

  // ── Pointer events (click-to-navigate + drag) ─────────────────────

  /** Convert minimap-local pixel to world tile coordinate. */
  private _pixelToTile(bmX: number, bmY: number): { tileX: number; tileY: number } | null {
    if (bmX < 0 || bmX >= BM_WIDTH || bmY < 0 || bmY >= BM_HEIGHT) return null

    const tpp = this._zoomLevels[this._zoomIdx]
    const { viewMinX, viewMinY } = this._getViewOrigin()

    return {
      tileX: Math.floor(viewMinX + bmX * tpp),
      tileY: Math.floor(viewMinY + bmY * tpp),
    }
  }

  /** Navigate from a global screen coordinate. */
  _navigateFromEvent(globalX: number, globalY: number): void {
    const bmX = globalX - this._container.x - PADDING - BORDER_WIDTH
    const bmY = globalY - this._container.y - PADDING - BORDER_WIDTH
    const result = this._pixelToTile(bmX, bmY)
    if (result) this.onNavigate?.(result.tileX, result.tileY)
  }

  private _onPointerDown(e: { stopPropagation(): void; global?: { x: number; y: number }; data?: { global: { x: number; y: number } } }): void {
    e.stopPropagation()
    this._dragging = true
    const global = e.global ?? e.data?.global
    if (global) this._navigateFromEvent(global.x, global.y)
  }

  private _onPointerMove(e: { global?: { x: number; y: number }; data?: { global: { x: number; y: number } } }): void {
    if (!this._dragging) return
    const global = e.global ?? e.data?.global
    if (global) this._navigateFromEvent(global.x, global.y)
  }

  private _onPointerUp(): void {
    this._dragging = false
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  destroy(): void {
    this._container.off('pointerdown', this._onPointerDown, this)
    this._container.off('pointermove', this._onPointerMove, this)
    this._container.off('pointerup', this._onPointerUp, this)
    this._container.off('pointerupoutside', this._onPointerUp, this)
    if (this._texture) this._texture.destroy(true)
    this._bitmapSprite.destroy()
    this._viewportRect.destroy()
    this._zoomLabel.destroy()
    this._bg.destroy()
    this._container.destroy()
    this._texture = null
    this._source = null
  }
}
