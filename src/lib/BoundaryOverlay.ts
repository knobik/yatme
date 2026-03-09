import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE, CHUNK_SIZE } from './constants'
import { MAP_MAX_WIDTH, MAP_MAX_HEIGHT } from './otbm'
import type { Camera } from './Camera'

const LINE_COLOR = 0xffffff
const LINE_ALPHA = 0.15
const SCREEN_LINE_SPACING = 16 // spacing between diagonal lines in screen pixels
const SCREEN_LINE_WIDTH = 2    // hatch line width in screen pixels

const BORDER_COLOR = 0xd4a549  // accent amber from theme
const BORDER_ALPHA = 0.6
const SCREEN_BORDER_WIDTH = 2  // border width in screen pixels

/**
 * Draws diagonal hatch lines ("no parking" pattern) on tiles outside the
 * valid map range (0–65 000), plus a border outline at the map edge.
 * Redraws only when the visible viewport changes.
 */
export class BoundaryOverlay {
  readonly container: Container
  private _graphics: Graphics
  private _lastKey = ''
  private _lastFloorOffset = NaN

  constructor() {
    this.container = new Container()
    this._graphics = new Graphics()
    this.container.addChild(this._graphics)
  }

  updateContainerOffset(floorOffset: number): void {
    if (floorOffset !== this._lastFloorOffset) {
      this.container.position.set(-floorOffset, -floorOffset)
      this._lastFloorOffset = floorOffset
    }
  }

  update(camera: Camera): void {
    const floorOffset = camera.getFloorOffset(camera.floor)
    const range = camera.getVisibleRangeForFloor(floorOffset)

    // Convert chunk range to tile range — consume immediately (reusable object)
    const startTX = range.startX * CHUNK_SIZE
    const startTY = range.startY * CHUNK_SIZE
    const endTX = (range.endX + 1) * CHUNK_SIZE
    const endTY = (range.endY + 1) * CHUNK_SIZE

    // Skip if nothing is out of bounds
    if (startTX >= 0 && startTY >= 0 && endTX <= MAP_MAX_WIDTH && endTY <= MAP_MAX_HEIGHT) {
      if (this._lastKey !== '') {
        this._graphics.clear()
        this._lastKey = ''
      }
      return
    }

    // Include zoom in dirty key — spacing changes with zoom
    const key = `${startTX},${startTY},${endTX},${endTY},${camera.zoom}`
    if (key === this._lastKey) return
    this._lastKey = key

    const g = this._graphics
    g.clear()

    // Scale to stay constant in screen pixels
    const spacing = SCREEN_LINE_SPACING / camera.zoom
    const strokeWidth = SCREEN_LINE_WIDTH / camera.zoom
    const borderWidth = SCREEN_BORDER_WIDTH / camera.zoom

    // Build up to 4 rectangular out-of-bounds regions
    const regions: { x1: number; y1: number; x2: number; y2: number }[] = []

    if (startTX < 0) {
      regions.push({
        x1: startTX, y1: startTY,
        x2: Math.min(0, endTX), y2: endTY,
      })
    }
    if (endTX > MAP_MAX_WIDTH) {
      regions.push({
        x1: Math.max(MAP_MAX_WIDTH + 1, startTX), y1: startTY,
        x2: endTX, y2: endTY,
      })
    }
    if (startTY < 0) {
      regions.push({
        x1: Math.max(0, startTX), y1: startTY,
        x2: Math.min(MAP_MAX_WIDTH + 1, endTX), y2: Math.min(0, endTY),
      })
    }
    if (endTY > MAP_MAX_HEIGHT) {
      regions.push({
        x1: Math.max(0, startTX), y1: Math.max(MAP_MAX_HEIGHT + 1, startTY),
        x2: Math.min(MAP_MAX_WIDTH + 1, endTX), y2: endTY,
      })
    }

    // Draw hatch lines per region
    for (const r of regions) {
      const px1 = r.x1 * TILE_SIZE
      const py1 = r.y1 * TILE_SIZE
      const px2 = r.x2 * TILE_SIZE
      const py2 = r.y2 * TILE_SIZE
      const w = px2 - px1
      const h = py2 - py1

      if (w <= 0 || h <= 0) continue

      const lineCount = Math.min(Math.ceil((w + h) / spacing), 4096)

      for (let i = 0; i < lineCount; i++) {
        const d = i * spacing

        const x0 = px1 + d - h
        const y0 = py1
        const x1end = px1 + d
        const y1end = py1 + h

        // Clip to region
        const cx0 = Math.max(px1, x0)
        const cy0 = y0 + (cx0 - x0)
        const cx1 = Math.min(px2, x1end)
        const cy1 = y1end - (x1end - cx1)

        if (cx0 >= px2 || cx1 <= px1 || cy0 >= py2 || cy1 <= py1) continue

        g.moveTo(cx0, Math.max(py1, cy0))
        g.lineTo(cx1, Math.min(py2, cy1))
      }
      g.stroke({ width: strokeWidth, color: LINE_COLOR, alpha: LINE_ALPHA })
    }

    // Draw border outline along the map edge (only the segments visible in viewport)
    const mapLeft = 0
    const mapTop = 0
    const mapRight = (MAP_MAX_WIDTH + 1) * TILE_SIZE
    const mapBottom = (MAP_MAX_HEIGHT + 1) * TILE_SIZE

    const vpLeft = startTX * TILE_SIZE
    const vpTop = startTY * TILE_SIZE
    const vpRight = endTX * TILE_SIZE
    const vpBottom = endTY * TILE_SIZE

    // Left edge (x=0)
    if (startTX < 0 && endTX > 0) {
      g.moveTo(mapLeft, Math.max(vpTop, mapTop))
      g.lineTo(mapLeft, Math.min(vpBottom, mapBottom))
    }
    // Right edge (x=MAP_MAX_WIDTH+1)
    if (endTX > MAP_MAX_WIDTH && startTX <= MAP_MAX_WIDTH) {
      g.moveTo(mapRight, Math.max(vpTop, mapTop))
      g.lineTo(mapRight, Math.min(vpBottom, mapBottom))
    }
    // Top edge (y=0)
    if (startTY < 0 && endTY > 0) {
      g.moveTo(Math.max(vpLeft, mapLeft), mapTop)
      g.lineTo(Math.min(vpRight, mapRight), mapTop)
    }
    // Bottom edge (y=MAP_MAX_HEIGHT+1)
    if (endTY > MAP_MAX_HEIGHT && startTY <= MAP_MAX_HEIGHT) {
      g.moveTo(Math.max(vpLeft, mapLeft), mapBottom)
      g.lineTo(Math.min(vpRight, mapRight), mapBottom)
    }
    g.stroke({ width: borderWidth, color: BORDER_COLOR, alpha: BORDER_ALPHA })
  }

  destroy(): void {
    this._graphics.destroy()
    this.container.destroy()
  }
}
