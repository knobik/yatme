import { Container, Sprite, Graphics, Texture, ImageSource } from 'pixi.js'
import { CHUNK_SIZE } from './constants'
import { chunkKeyStr } from './ChunkManager'
import { colorFromEightBit } from './colorUtils'
import type { Camera } from './Camera'
import type { AppearanceData } from './appearances'
import type { OtbmTile } from './otbm'

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 200
const DEFAULT_HEIGHT = 150
const DEFAULT_EXPANDED_WIDTH = 400
const DEFAULT_EXPANDED_HEIGHT = 300
const PADDING = 4
const BORDER_WIDTH = 1
const BG_COLOR = 0x12121a
const BORDER_COLOR = 0x2a2a35
const OOB_COLOR = 0xFF0e0e14 // out-of-bounds fill (ABGR: dark desaturated)
const INBOUNDS_COLOR = 0xFF000000 // in-bounds empty (pure black)
const VIEWPORT_COLOR = 0xd4a549
const VIEWPORT_ALPHA = 0.8
const MARGIN_RIGHT = 12
const MARGIN_BOTTOM = 12

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
  // Effective bitmap pixel dimensions (may be smaller than canvas when map doesn't fill an axis)
  private _cachedEffectiveW = 0
  private _cachedEffectiveH = 0

  // Cache viewport rect and background to avoid redrawing every frame
  private _lastVpKey = ''
  private _lastBgW = 0
  private _lastBgH = 0

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

  // Dynamic sizing + hover animation
  private _baseWidth = DEFAULT_WIDTH
  private _baseHeight = DEFAULT_HEIGHT
  private _expandedWidth = DEFAULT_EXPANDED_WIDTH
  private _expandedHeight = DEFAULT_EXPANDED_HEIGHT
  private _currentWidth = DEFAULT_WIDTH
  private _currentHeight = DEFAULT_HEIGHT
  private _targetWidth = DEFAULT_WIDTH
  private _targetHeight = DEFAULT_HEIGHT
  private _expandOnHover = true
  private _hovered = false
  private _animating = false
  private _baseOpacity = 1

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
    this._canvas.width = this._baseWidth
    this._canvas.height = this._baseHeight
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
    this._container.on('pointerenter', this._onPointerEnter, this)
    this._container.on('pointerleave', this._onPointerLeave, this)
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

  // ── Dynamic sizing setters ───────────────────────────────────────

  setBaseSize(width: number): void {
    this._baseWidth = width
    this._baseHeight = Math.round(width * 0.75)
    if (!this._hovered) {
      this._targetWidth = this._baseWidth
      this._targetHeight = this._baseHeight
      this._currentWidth = this._baseWidth
      this._currentHeight = this._baseHeight
      this._resizeCanvas(this._baseWidth, this._baseHeight)
      this._recomputeZoomLevels()
      this._drawBackground()
      this._dirty = true
    }
  }

  setExpandedSize(width: number): void {
    this._expandedWidth = width
    this._expandedHeight = Math.round(width * 0.75)
    if (this._hovered && this._expandOnHover) {
      this._targetWidth = this._expandedWidth
      this._targetHeight = this._expandedHeight
      this._animating = true
    }
  }

  setExpandOnHover(enabled: boolean): void {
    this._expandOnHover = enabled
    if (!enabled && this._hovered) {
      // Snap to base size
      this._targetWidth = this._baseWidth
      this._targetHeight = this._baseHeight
      this._currentWidth = this._baseWidth
      this._currentHeight = this._baseHeight
      this._resizeCanvas(this._baseWidth, this._baseHeight)
      this._drawBackground()
      this._animating = false
      this._dirty = true
    }
  }

  setOpacity(alpha: number): void {
    this._baseOpacity = alpha
    this._container.alpha = this._hovered ? 1 : alpha
  }

  get isAnimating(): boolean { return this._animating }

  /** Lerp current size toward target. Call once per frame from MapRenderer.update(). */
  updateAnimation(): void {
    if (!this._animating) return

    const factor = 0.18
    this._currentWidth += (this._targetWidth - this._currentWidth) * factor
    this._currentHeight += (this._targetHeight - this._currentHeight) * factor

    // Lerp opacity: 1 when hovered, baseOpacity when not
    const targetAlpha = this._hovered ? 1 : this._baseOpacity
    this._container.alpha += (targetAlpha - this._container.alpha) * factor

    // Snap when close
    if (Math.abs(this._currentWidth - this._targetWidth) < 0.5 &&
        Math.abs(this._currentHeight - this._targetHeight) < 0.5) {
      this._currentWidth = this._targetWidth
      this._currentHeight = this._targetHeight
      this._container.alpha = targetAlpha
      this._animating = false

      // Resize canvas to final size (e.g. back to base after collapse) and recompute zoom
      const finalW = Math.round(this._targetWidth)
      const finalH = Math.round(this._targetHeight)
      if (this._canvas.width !== finalW || this._canvas.height !== finalH) {
        this._resizeCanvas(finalW, finalH)
        this._recomputeZoomLevels()
        this._dirty = true
      }
    }

    this._drawBackground()
  }

  private _resizeCanvas(w: number, h: number): void {
    this._canvas.width = w
    this._canvas.height = h
    this._imageData = null // force re-create
    this._source = null
    if (this._texture) {
      this._bitmapSprite.texture = Texture.EMPTY
      this._texture.destroy(true)
      this._texture = null
    }
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

    this._recomputeZoomLevels()

    // Start at zoom level 3 (4 tpp), clamped to available range
    this._zoomIdx = Math.min(2, this._zoomLevels.length - 1)

    // Center on map center
    this._viewCenterX = minX + this._mapWidth / 2
    this._viewCenterY = minY + this._mapHeight / 2

    this._dirty = true
  }

  /** Recompute zoom levels based on current canvas dimensions and map size.
   *  Preserves the current tpp as closely as possible. */
  private _recomputeZoomLevels(): void {
    if (this._mapWidth <= 0 || this._mapHeight <= 0) return

    const prevTpp = this._zoomLevels[this._zoomIdx] ?? 1
    const bmW = this._canvas.width
    const bmH = this._canvas.height
    const fitAllTpp = Math.max(this._mapWidth / bmW, this._mapHeight / bmH, 1)

    // Build zoom levels: all base levels that are smaller than fitAll, plus fitAll at the end
    const levels: number[] = []
    for (const tpp of BASE_ZOOM_LEVELS) {
      if (tpp >= fitAllTpp) break
      levels.push(tpp)
    }
    levels.push(fitAllTpp)
    this._zoomLevels = levels

    // Find the closest zoom level to the previous tpp
    let bestIdx = levels.length - 1
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] >= prevTpp) { bestIdx = i; break }
    }
    this._zoomIdx = bestIdx
  }

  /** Check if a screen coordinate falls within the minimap bounds. */
  hitTest(screenX: number, screenY: number): boolean {
    if (!this._visible) return false
    const w = Math.round(this._currentWidth)
    const h = Math.round(this._currentHeight)
    const totalW = w + (PADDING + BORDER_WIDTH) * 2
    const totalH = h + (PADDING + BORDER_WIDTH) * 2
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
    const { viewMinX, viewMinY, effectiveW, effectiveH } = this._getViewOrigin()
    const viewKey = `${this._zoomIdx},${viewMinX},${viewMinY}`
    const viewChanged = viewKey !== this._lastViewKey

    if (!this._dirty && !floorChanged && !viewChanged) return

    // Cache view origin and effective dims for updateViewport() to reuse
    this._cachedViewMinX = viewMinX
    this._cachedViewMinY = viewMinY
    this._cachedEffectiveW = effectiveW
    this._cachedEffectiveH = effectiveH

    this._lastFloor = floor
    this._lastViewKey = viewKey
    this._dirty = false
    this._lastBitmapTime = now

    this._generateBitmap(floor, floorChanged, viewMinX, viewMinY, chunkIndex, appearances)
  }

  updateViewport(camera: Camera, screenW: number, screenH: number): void {
    if (!this._visible || this._mapWidth === 0) return

    // Always center the minimap on the camera position
    if (!this._dragging) {
      const offset = camera.getFloorOffset(camera.floor)
      this._viewCenterX = (camera.x + offset) / 32 + screenW / (camera.zoom * 32) / 2
      this._viewCenterY = (camera.y + offset) / 32 + screenH / (camera.zoom * 32) / 2
    }

    const tpp = this._zoomLevels[this._zoomIdx]
    const viewMinX = this._cachedViewMinX
    const viewMinY = this._cachedViewMinY
    const effW = this._cachedEffectiveW
    const effH = this._cachedEffectiveH

    // Use screen-space dimensions for viewport rect and positioning
    const dispW = Math.round(this._currentWidth)
    const dispH = Math.round(this._currentHeight)

    // Effective display dimensions (map may not fill the full minimap on one axis)
    const effDispW = Math.round(effW * dispW / this._canvas.width)
    const effDispH = Math.round(effH * dispH / this._canvas.height)
    const mapOffX = Math.round((dispW - effDispW) / 2)
    const mapOffY = Math.round((dispH - effDispH) / 2)

    // Compute main camera visible tile range
    const offset = camera.getFloorOffset(camera.floor)
    const tileLeft = (camera.x + offset) / 32
    const tileTop = (camera.y + offset) / 32
    const tileRight = tileLeft + screenW / (camera.zoom * 32)
    const tileBottom = tileTop + screenH / (camera.zoom * 32)

    // Convert to minimap screen-space coords (scale from effective bitmap to effective display)
    const scaleX = effDispW / effW
    const scaleY = effDispH / effH
    const x = mapOffX + ((tileLeft - viewMinX) / tpp) * scaleX
    const y = mapOffY + ((tileTop - viewMinY) / tpp) * scaleY
    const w = ((tileRight - tileLeft) / tpp) * scaleX
    const h = ((tileBottom - tileTop) / tpp) * scaleY

    // Clamp to effective display area
    const bx = PADDING + BORDER_WIDTH
    const by = PADDING + BORDER_WIDTH
    const cx = Math.max(mapOffX, Math.min(x, mapOffX + effDispW))
    const cy = Math.max(mapOffY, Math.min(y, mapOffY + effDispH))
    const cw = Math.max(1, Math.min(w, mapOffX + effDispW - cx))
    const ch = Math.max(1, Math.min(h, mapOffY + effDispH - cy))

    // Only redraw viewport rectangle if it changed
    const vpKey = `${Math.round(cx)},${Math.round(cy)},${Math.round(cw)},${Math.round(ch)}`
    if (vpKey !== this._lastVpKey) {
      this._lastVpKey = vpKey
      this._viewportRect.clear()
      this._viewportRect.setStrokeStyle({ width: 1, color: VIEWPORT_COLOR, alpha: VIEWPORT_ALPHA })
      this._viewportRect.rect(bx + cx, by + cy, cw, ch)
      this._viewportRect.stroke()
    }

    // Scale bitmap sprite to show only the effective area, centered in display
    this._bitmapSprite.x = PADDING + BORDER_WIDTH + mapOffX
    this._bitmapSprite.y = PADDING + BORDER_WIDTH + mapOffY
    this._bitmapSprite.width = effDispW
    this._bitmapSprite.height = effDispH

    // Position container at bottom-right of screen
    const totalW = dispW + (PADDING + BORDER_WIDTH) * 2
    const totalH = dispH + (PADDING + BORDER_WIDTH) * 2
    this._container.x = screenW - totalW - MARGIN_RIGHT
    this._container.y = screenH - totalH - MARGIN_BOTTOM
  }

  // ── View helpers ───────────────────────────────────────────────────

  /** Return the clamped top-left tile coordinate of the minimap view. */
  private _getViewOrigin(): { viewMinX: number; viewMinY: number; effectiveW: number; effectiveH: number } {
    const tpp = this._zoomLevels[this._zoomIdx]
    const bmW = this._canvas.width
    const bmH = this._canvas.height

    let viewMinX: number
    let viewMinY: number
    let effectiveW: number
    let effectiveH: number

    if (bmW * tpp >= this._mapWidth) {
      // Map fits within bitmap width — center map data within full bitmap
      const usedPixels = Math.ceil(this._mapWidth / tpp)
      const padPixels = Math.floor((bmW - usedPixels) / 2)
      viewMinX = this._mapMinX - padPixels * tpp
      effectiveW = bmW
    } else {
      // Normal pan — center and clamp
      const halfW = bmW * tpp / 2
      const cx = Math.max(this._mapMinX + halfW, Math.min(this._mapMinX + this._mapWidth - halfW, this._viewCenterX))
      viewMinX = Math.floor(cx - halfW)
      effectiveW = bmW
    }

    if (bmH * tpp >= this._mapHeight) {
      // Map fits within bitmap height — center map data within full bitmap
      const usedPixels = Math.ceil(this._mapHeight / tpp)
      const padPixels = Math.floor((bmH - usedPixels) / 2)
      viewMinY = this._mapMinY - padPixels * tpp
      effectiveH = bmH
    } else {
      const halfH = bmH * tpp / 2
      const cy = Math.max(this._mapMinY + halfH, Math.min(this._mapMinY + this._mapHeight - halfH, this._viewCenterY))
      viewMinY = Math.floor(cy - halfH)
      effectiveH = bmH
    }

    return { viewMinX, viewMinY, effectiveW, effectiveH }
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
    const w = this._canvas.width
    const h = this._canvas.height
    const tpp = this._zoomLevels[this._zoomIdx]

    const viewTilesW = w * tpp
    const viewTilesH = h * tpp

    // On floor change, clear the cache — old floor entries use different chunk keys
    // so they won't collide, but pruning keeps memory bounded.
    if (floorChanged) {
      this._chunkColorCache.clear()
    }

    // Clamp visible tile range to actual map bounds to avoid iterating empty space
    const clampedMinX = Math.max(viewMinX, this._mapMinX)
    const clampedMinY = Math.max(viewMinY, this._mapMinY)
    const clampedMaxX = Math.min(viewMinX + viewTilesW - 1, this._mapMinX + this._mapWidth - 1)
    const clampedMaxY = Math.min(viewMinY + viewTilesH - 1, this._mapMinY + this._mapHeight - 1)

    // Update dirty chunk colors in the cache
    const chunkMinX = Math.floor(clampedMinX / CHUNK_SIZE)
    const chunkMinY = Math.floor(clampedMinY / CHUNK_SIZE)
    const chunkMaxX = Math.floor(clampedMaxX / CHUNK_SIZE)
    const chunkMaxY = Math.floor(clampedMaxY / CHUNK_SIZE)

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
    buf32.fill(OOB_COLOR)

    // Paint in-bounds area with map background color
    const ibStartX = Math.max(0, Math.floor((this._mapMinX - viewMinX) / tpp))
    const ibStartY = Math.max(0, Math.floor((this._mapMinY - viewMinY) / tpp))
    const ibEndX = Math.min(w, Math.ceil((this._mapMinX + this._mapWidth - viewMinX) / tpp))
    const ibEndY = Math.min(h, Math.ceil((this._mapMinY + this._mapHeight - viewMinY) / tpp))
    for (let py = ibStartY; py < ibEndY; py++) {
      const rowStart = py * w + ibStartX
      const rowEnd = py * w + ibEndX
      buf32.fill(INBOUNDS_COLOR, rowStart, rowEnd)
    }

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
    const w = Math.round(this._currentWidth)
    const h = Math.round(this._currentHeight)
    if (w === this._lastBgW && h === this._lastBgH) return
    this._lastBgW = w
    this._lastBgH = h
    const totalW = w + (PADDING + BORDER_WIDTH) * 2
    const totalH = h + (PADDING + BORDER_WIDTH) * 2

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

  /** Convert screen-local pixel (relative to bitmap area) to world tile coordinate. */
  private _pixelToTile(screenX: number, screenY: number): { tileX: number; tileY: number } | null {
    const dispW = Math.round(this._currentWidth)
    const dispH = Math.round(this._currentHeight)
    if (screenX < 0 || screenX >= dispW || screenY < 0 || screenY >= dispH) return null

    const tpp = this._zoomLevels[this._zoomIdx]
    const { viewMinX, viewMinY, effectiveW, effectiveH } = this._getViewOrigin()

    // Account for centering offset when map doesn't fill full minimap
    const effDispW = Math.round(effectiveW * dispW / this._canvas.width)
    const effDispH = Math.round(effectiveH * dispH / this._canvas.height)
    const mapOffX = (dispW - effDispW) / 2
    const mapOffY = (dispH - effDispH) / 2

    // Convert from display-space (relative to effective area) to bitmap-space, then to tile-space
    const localX = screenX - mapOffX
    const localY = screenY - mapOffY
    if (localX < 0 || localX >= effDispW || localY < 0 || localY >= effDispH) return null

    const bitmapX = (localX / effDispW) * effectiveW
    const bitmapY = (localY / effDispH) * effectiveH

    return {
      tileX: Math.floor(viewMinX + bitmapX * tpp),
      tileY: Math.floor(viewMinY + bitmapY * tpp),
    }
  }

  /** Navigate from a global screen coordinate. */
  _navigateFromEvent(globalX: number, globalY: number): void {
    const bmX = globalX - this._container.x - PADDING - BORDER_WIDTH
    const bmY = globalY - this._container.y - PADDING - BORDER_WIDTH
    const result = this._pixelToTile(bmX, bmY)
    if (result) {
      // Clamp to map bounds so clicking outside the map area doesn't navigate out of bounds
      const tileX = Math.max(this._mapMinX, Math.min(this._mapMinX + this._mapWidth - 1, result.tileX))
      const tileY = Math.max(this._mapMinY, Math.min(this._mapMinY + this._mapHeight - 1, result.tileY))
      this.onNavigate?.(tileX, tileY)
    }
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

  private _onPointerEnter(): void {
    this._hovered = true
    if (!this._expandOnHover) {
      this._container.alpha = 1
      return
    }
    this._targetWidth = this._expandedWidth
    this._targetHeight = this._expandedHeight
    this._animating = true
    // Immediately resize canvas to expanded resolution and recompute zoom levels
    this._resizeCanvas(this._expandedWidth, this._expandedHeight)
    this._recomputeZoomLevels()
    this._dirty = true
  }

  private _onPointerLeave(): void {
    this._hovered = false
    if (!this._expandOnHover || this._dragging) {
      this._container.alpha = this._baseOpacity
      return
    }
    this._targetWidth = this._baseWidth
    this._targetHeight = this._baseHeight
    this._animating = true
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  destroy(): void {
    this._container.off('pointerdown', this._onPointerDown, this)
    this._container.off('pointermove', this._onPointerMove, this)
    this._container.off('pointerup', this._onPointerUp, this)
    this._container.off('pointerupoutside', this._onPointerUp, this)
    this._container.off('pointerenter', this._onPointerEnter, this)
    this._container.off('pointerleave', this._onPointerLeave, this)
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
