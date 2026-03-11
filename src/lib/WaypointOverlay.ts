import { Assets, Container, Graphics, Text, Texture } from 'pixi.js'
import { TILE_SIZE } from './constants'
import type { WaypointManager } from './WaypointManager'
import type { Camera } from './Camera'
import { TILE_CENTER, svgToDataUrl, createIconBadge, FloorOffsetTracker } from './overlayUtils'

export const MARKER_COLOR = 0x00c800
/** CSS hex representation of the marker color for UI components. */
export const MARKER_COLOR_CSS = '#00c800'
const SELECTED_BORDER_COLOR = 0xd4a549
const LABEL_FONT_SIZE = 13

// Phosphor MapPin icon (256x256 viewBox, fill white for tinting)
const MAP_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="white" viewBox="0 0 256 256"><path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,152.26,144.53,199,128,222Z"/></svg>`

let waypointIconTexture: Texture | null = null
let loadingPromise: Promise<boolean> | null = null

function ensureIconTexture(): Promise<boolean> {
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    try {
      waypointIconTexture = await Assets.load<Texture>(svgToDataUrl(MAP_PIN_SVG))
      return true
    } catch (err) {
      console.error('[WaypointOverlay] Failed to load icon texture:', err)
      loadingPromise = null
      return false
    }
  })()
  return loadingPromise
}

export class WaypointOverlay {
  readonly container: Container
  private _graphics: Graphics
  private _labelContainer: Container
  private _iconContainer: Container
  private _visible = false
  private _dirty = true
  private _lastFloor = -1
  private _lastKey = ''
  private _selectedWaypoint: string | null = null
  private _offsetTracker = new FloorOffsetTracker()
  private _iconsReady = false
  private _ghostContainer: Container
  private _ghostPos: { x: number; y: number; z: number } | null = null
  /** Generation counter — bumped on any external mutation to invalidate the dirty key. */
  private _generation = 0

  constructor() {
    this.container = new Container()
    this.container.visible = false

    this._graphics = new Graphics()
    this.container.addChild(this._graphics)

    this._iconContainer = new Container()
    this.container.addChild(this._iconContainer)

    this._labelContainer = new Container()
    this.container.addChild(this._labelContainer)

    this._ghostContainer = new Container()
    this._ghostContainer.alpha = 0.5
    this._ghostContainer.visible = false
    this.container.addChild(this._ghostContainer)

    ensureIconTexture().then((ok) => {
      if (!ok) return
      this._iconsReady = true
      this._dirty = true
    })
  }

  get visible(): boolean { return this._visible }

  setVisible(v: boolean): void {
    this._visible = v
    this.container.visible = v
    if (v) this._dirty = true
  }

  markDirty(): void {
    this._dirty = true
    this._generation++
  }

  setSelectedWaypoint(name: string | null): void {
    if (this._selectedWaypoint !== name) {
      this._selectedWaypoint = name
      this._dirty = true
    }
  }

  setDragGhost(x: number, y: number, z: number): void {
    if (this._ghostPos && this._ghostPos.x === x && this._ghostPos.y === y && this._ghostPos.z === z) return
    this._ghostPos = { x, y, z }
    this._dirty = true
  }

  clearDragGhost(): void {
    if (this._ghostPos) {
      this._ghostPos = null
      this._ghostContainer.removeChildren().forEach(c => c.destroy())
      this._ghostContainer.visible = false
      this._dirty = true
    }
  }

  updateContainerOffset(floorOffset: number): void {
    this._offsetTracker.updateContainerOffset(this.container, floorOffset)
  }

  rebuild(floor: number, waypointManager: WaypointManager, camera: Camera): void {
    if (!this._visible) return

    // Build dirty key — uses generation counter instead of size for proper mutation tracking
    const ghostKey = this._ghostPos ? `${this._ghostPos.x},${this._ghostPos.y},${this._ghostPos.z}` : ''
    const key = `${floor}|${this._selectedWaypoint}|${this._generation}|${camera.zoom.toFixed(3)}|${ghostKey}`
    if (!this._dirty && key === this._lastKey && floor === this._lastFloor) return

    this._dirty = false
    this._lastFloor = floor
    this._lastKey = key

    const g = this._graphics
    g.clear()

    // Remove and destroy old labels and icons to free GPU resources
    this._labelContainer.removeChildren().forEach(c => c.destroy())
    this._iconContainer.removeChildren().forEach(c => c.destroy())

    const floorWaypoints = waypointManager.getByFloor(floor)

    for (const wp of floorWaypoints) {
      const px = wp.x * TILE_SIZE
      const py = wp.y * TILE_SIZE
      const isSelected = wp.name === this._selectedWaypoint

      if (isSelected) {
        const borderWidth = 2 / camera.zoom
        g.rect(px + borderWidth / 2, py + borderWidth / 2, TILE_SIZE - borderWidth, TILE_SIZE - borderWidth)
        g.stroke({ color: SELECTED_BORDER_COLOR, width: borderWidth, alpha: 0.8 })
      }

      // Add icon badge at tile center
      if (this._iconsReady && waypointIconTexture) {
        const cx = px + TILE_CENTER
        const cy = py + TILE_CENTER
        const ringColor = isSelected ? SELECTED_BORDER_COLOR : MARKER_COLOR
        this._iconContainer.addChild(createIconBadge(cx, cy, waypointIconTexture, ringColor))
      }

      // Add label (constant screen size regardless of zoom)
      const invZoom = 1 / camera.zoom
      const label = new Text({
        text: wp.name,
        style: {
          fontFamily: 'Barlow, system-ui, -apple-system, sans-serif',
          fontSize: LABEL_FONT_SIZE,
          fill: 0xffffff,
          letterSpacing: 1,
        },
      })
      label.anchor.set(0.5, 1)
      label.scale.set(invZoom)
      label.position.set(px + TILE_CENTER, py - 2)
      this._labelContainer.addChild(label)
    }

    // Drag ghost
    this._ghostContainer.removeChildren().forEach(c => c.destroy())
    if (this._ghostPos && this._ghostPos.z === floor && this._iconsReady && waypointIconTexture) {
      const gx = this._ghostPos.x * TILE_SIZE + TILE_CENTER
      const gy = this._ghostPos.y * TILE_SIZE + TILE_CENTER
      this._ghostContainer.addChild(createIconBadge(gx, gy, waypointIconTexture, MARKER_COLOR))
      this._ghostContainer.visible = true
    } else {
      this._ghostContainer.visible = false
    }
  }

  destroy(): void {
    this._graphics.destroy()
    this._iconContainer.destroy({ children: true })
    this._labelContainer.destroy({ children: true })
    this._ghostContainer.destroy({ children: true })
    this.container.destroy({ children: true })
  }
}
