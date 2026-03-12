import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE, CHUNK_SIZE } from './constants'
import { FloorOffsetTracker } from './overlayUtils'
import type { Camera } from './Camera'

const LINE_COLOR = 0xffffff
const LINE_ALPHA = 0.12

/**
 * Draws tile-boundary grid lines across the visible viewport.
 * Redraws only when the visible range or zoom changes (dirty key pattern).
 */
export class GridOverlay {
  readonly container: Container
  private _graphics: Graphics
  private _offsetTracker = new FloorOffsetTracker()
  private _lastKey = ''
  private _visible = false

  constructor() {
    this.container = new Container()
    this._graphics = new Graphics()
    this.container.addChild(this._graphics)
    this.container.visible = false
  }

  setVisible(visible: boolean): void {
    this._visible = visible
    this.container.visible = visible
    if (!visible) {
      this._graphics.clear()
      this._lastKey = ''
    }
  }

  updateContainerOffset(floorOffset: number): void {
    this._offsetTracker.updateContainerOffset(this.container, floorOffset)
  }

  update(camera: Camera): void {
    if (!this._visible) return

    const floorOffset = camera.getFloorOffset(camera.floor)
    const range = camera.getVisibleRangeForFloor(floorOffset)

    const startTX = range.startX * CHUNK_SIZE
    const startTY = range.startY * CHUNK_SIZE
    const endTX = (range.endX + 1) * CHUNK_SIZE
    const endTY = (range.endY + 1) * CHUNK_SIZE

    const key = `${startTX},${startTY},${endTX},${endTY},${camera.zoom}`
    if (key === this._lastKey) return
    this._lastKey = key

    const g = this._graphics
    g.clear()

    const strokeWidth = 1 / camera.zoom

    // Horizontal lines
    for (let y = startTY; y <= endTY; y++) {
      g.moveTo(startTX * TILE_SIZE, y * TILE_SIZE)
      g.lineTo(endTX * TILE_SIZE, y * TILE_SIZE)
    }

    // Vertical lines
    for (let x = startTX; x <= endTX; x++) {
      g.moveTo(x * TILE_SIZE, startTY * TILE_SIZE)
      g.lineTo(x * TILE_SIZE, endTY * TILE_SIZE)
    }

    g.stroke({ width: strokeWidth, color: LINE_COLOR, alpha: LINE_ALPHA })
  }

  destroy(): void {
    this._graphics.destroy()
    this.container.destroy()
  }
}
