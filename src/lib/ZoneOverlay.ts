import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE } from './constants'
import type { OtbmMap } from './otbm'
import { ZONE_FLAG_DEFS } from '../hooks/tools/types'
import { zoneColorHex } from './zoneColors'

export class ZoneOverlay {
  readonly container: Container
  private _graphics: Graphics
  private _visible = false
  private _dirty = true
  private _lastFloorOffset = NaN

  constructor() {
    this.container = new Container()
    this._graphics = new Graphics()
    this.container.addChild(this._graphics)
    this.container.visible = false
  }

  setVisible(visible: boolean): void {
    this._visible = visible
    this.container.visible = visible
    if (visible) this._dirty = true
  }

  get visible(): boolean { return this._visible }

  markDirty(): void {
    this._dirty = true
  }

  updateContainerOffset(floorOffset: number): void {
    if (floorOffset !== this._lastFloorOffset) {
      this.container.position.set(-floorOffset, -floorOffset)
      this._lastFloorOffset = floorOffset
    }
  }

  rebuild(mapData: OtbmMap, floor: number): void {
    if (!this._visible || !this._dirty) return
    this._dirty = false

    const g = this._graphics
    g.clear()

    const alpha = 0.25

    for (const tile of mapData.tiles.values()) {
      if (tile.z !== floor) continue

      const px = tile.x * TILE_SIZE
      const py = tile.y * TILE_SIZE

      // Draw flag overlays
      for (const def of ZONE_FLAG_DEFS) {
        if ((tile.flags & def.flag) !== 0) {
          g.rect(px, py, TILE_SIZE, TILE_SIZE)
          g.fill({ color: def.color, alpha })
        }
      }

      // Draw zone overlays
      if (tile.zones) {
        for (const zoneId of tile.zones) {
          const color = zoneColorHex(zoneId)
          g.rect(px, py, TILE_SIZE, TILE_SIZE)
          g.fill({ color, alpha })
        }
      }
    }
  }

  destroy(): void {
    this._graphics.destroy()
    this.container.destroy()
  }
}
