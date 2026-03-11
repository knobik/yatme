import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE } from './constants'
import { FloorOffsetTracker } from './overlayUtils'
import type { Camera } from './Camera'

const CLIENT_MAP_WIDTH = 18   // tiles
const CLIENT_MAP_HEIGHT = 14  // tiles

const RED = 0xFF0000
const GREEN = 0x00FF00
const DARK_OVERLAY = 0x000000
const DARK_ALPHA = 0.5

const SCREEN_LINE_WIDTH = 2 // constant screen-pixel width

/**
 * Draws a "client box" overlay matching RME's DrawIngameBox — shows what a
 * Tibia client player would see. The red rect is the full 18x14 client area,
 * the green rect is the visible game area (inset 1 tile start, 2 tiles end),
 * and a green square marks the player position.
 */
export class ClientBoxOverlay {
  readonly container: Container
  private _darkGraphics: Graphics
  private _boxGraphics: Graphics
  private _visible = false
  private _lastKey = ''
  private _offsetTracker = new FloorOffsetTracker()

  constructor() {
    this.container = new Container()
    this._darkGraphics = new Graphics()
    this._boxGraphics = new Graphics()
    this.container.addChild(this._darkGraphics)
    this.container.addChild(this._boxGraphics)
  }

  setVisible(v: boolean): void {
    this._visible = v
    this.container.visible = v
    if (!v) {
      this._darkGraphics.clear()
      this._boxGraphics.clear()
      this._lastKey = ''
    }
  }

  get visible(): boolean {
    return this._visible
  }

  updateContainerOffset(floorOffset: number): void {
    this._offsetTracker.updateContainerOffset(this.container, floorOffset)
  }

  update(camera: Camera, floorOffset: number, screenWidth: number, screenHeight: number): void {
    if (!this._visible) {
      if (this._lastKey !== '') {
        this._darkGraphics.clear()
        this._boxGraphics.clear()
        this._lastKey = ''
      }
      return
    }

    // Viewport in world pixels (accounting for floor offset)
    const vpLeftPx = camera.x + floorOffset
    const vpTopPx = camera.y + floorOffset
    const vpRightPx = vpLeftPx + screenWidth / camera.zoom
    const vpBottomPx = vpTopPx + screenHeight / camera.zoom

    // RME: center_x = start_x + screensize_x * zoom / 64
    // In our coordinate system: camera center tile
    const centerTX = Math.floor((vpLeftPx + screenWidth / (2 * camera.zoom)) / TILE_SIZE)
    const centerTY = Math.floor((vpTopPx + screenHeight / (2 * camera.zoom)) / TILE_SIZE)

    const key = `${camera.x},${camera.y},${camera.zoom},${screenWidth},${screenHeight},${floorOffset}`
    if (key === this._lastKey) return
    this._lastKey = key

    // Center the red box on the camera center
    const boxStartTX = centerTX - Math.floor(CLIENT_MAP_WIDTH / 2)
    const boxStartTY = centerTY - Math.floor(CLIENT_MAP_HEIGHT / 2)
    const boxEndTX = boxStartTX + CLIENT_MAP_WIDTH
    const boxEndTY = boxStartTY + CLIENT_MAP_HEIGHT

    // Convert to pixels
    const boxStartPX = boxStartTX * TILE_SIZE
    const boxStartPY = boxStartTY * TILE_SIZE
    const boxEndPX = boxEndTX * TILE_SIZE
    const boxEndPY = boxEndTY * TILE_SIZE

    const lineWidth = SCREEN_LINE_WIDTH / camera.zoom

    // Dark overlay regions (4 rectangles around the box, batched into single fill)
    const dg = this._darkGraphics
    dg.clear()

    // Left side
    if (boxStartPX > vpLeftPx) {
      dg.rect(vpLeftPx, vpTopPx, boxStartPX - vpLeftPx, vpBottomPx - vpTopPx)
    }
    // Right side
    if (boxEndPX < vpRightPx) {
      dg.rect(boxEndPX, vpTopPx, vpRightPx - boxEndPX, vpBottomPx - vpTopPx)
    }
    // Top side (between left and right)
    if (boxStartPY > vpTopPx) {
      const left = Math.max(boxStartPX, vpLeftPx)
      const right = Math.min(boxEndPX, vpRightPx)
      if (right > left) {
        dg.rect(left, vpTopPx, right - left, Math.min(boxStartPY, vpBottomPx) - vpTopPx)
      }
    }
    // Bottom side (between left and right)
    if (boxEndPY < vpBottomPx) {
      const left = Math.max(boxStartPX, vpLeftPx)
      const right = Math.min(boxEndPX, vpRightPx)
      const top = Math.max(boxEndPY, vpTopPx)
      if (right > left) {
        dg.rect(left, top, right - left, vpBottomPx - top)
      }
    }
    dg.fill({ color: DARK_OVERLAY, alpha: DARK_ALPHA })

    // Box outlines
    const bg = this._boxGraphics
    bg.clear()

    const boxW = boxEndPX - boxStartPX
    const boxH = boxEndPY - boxStartPY

    // Red outline — full client area (hidden tiles border)
    bg.rect(boxStartPX, boxStartPY, boxW, boxH)
    bg.stroke({ width: lineWidth, color: RED, alpha: 0.8 })

    // Green outline — visible tiles (inset: +1 tile start, -2 tiles end — matching RME)
    const greenStartPX = boxStartPX + TILE_SIZE
    const greenStartPY = boxStartPY + TILE_SIZE
    const greenW = boxW - 3 * TILE_SIZE
    const greenH = boxH - 3 * TILE_SIZE
    bg.rect(greenStartPX, greenStartPY, greenW, greenH)
    bg.stroke({ width: lineWidth, color: GREEN, alpha: 0.8 })

    // Player position — (ClientMapWidth/2 - 2, ClientMapHeight/2 - 2) from green box start
    const playerPX = greenStartPX + (Math.floor(CLIENT_MAP_WIDTH / 2) - 2) * TILE_SIZE
    const playerPY = greenStartPY + (Math.floor(CLIENT_MAP_HEIGHT / 2) - 2) * TILE_SIZE
    bg.rect(playerPX, playerPY, TILE_SIZE, TILE_SIZE)
    bg.stroke({ width: lineWidth, color: GREEN, alpha: 0.8 })
  }

  destroy(): void {
    this._darkGraphics.destroy()
    this._boxGraphics.destroy()
    this.container.destroy()
  }
}
