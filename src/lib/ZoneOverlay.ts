import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE } from './constants'
import type { OtbmMap } from './otbm'
import { ZONE_FLAG_DEFS } from '../hooks/tools/types'
import { zoneColorHex } from './zoneColors'

const ALPHA = 0.25
const FLAG_MASK = 0x0001 | 0x0004 | 0x0008 | 0x0010

export class ZoneOverlay {
  readonly container: Container
  private _base: Graphics
  private _live: Graphics
  private _visible = false
  private _dirty = true
  private _painting = false
  private _lastFloorOffset = NaN

  constructor() {
    this.container = new Container()
    this._base = new Graphics()
    this._live = new Graphics()
    this.container.addChild(this._base)
    this.container.addChild(this._live)
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

  /** Begin incremental painting mode — suppresses full rebuilds. */
  beginPaint(): void {
    this._painting = true
    this._live.clear()
  }

  /** Draw a single tile's overlay incrementally during painting. */
  paintTile(x: number, y: number, flags: number, zones: number[] | undefined): void {
    if (!this._visible) return
    this._drawTileOn(this._live, x, y, flags, zones)
  }

  /** End painting — merge incremental draws into a full rebuild. */
  endPaint(): void {
    this._painting = false
    this._live.clear()
    this._dirty = true // trigger full rebuild next frame
  }

  updateContainerOffset(floorOffset: number): void {
    if (floorOffset !== this._lastFloorOffset) {
      this.container.position.set(-floorOffset, -floorOffset)
      this._lastFloorOffset = floorOffset
    }
  }

  rebuild(mapData: OtbmMap, floor: number): void {
    if (!this._visible || !this._dirty || this._painting) return
    this._dirty = false

    const g = this._base
    g.clear()

    for (const tile of mapData.tiles.values()) {
      if (tile.z !== floor) continue
      if (!(tile.flags & FLAG_MASK) && !(tile.zones && tile.zones.length > 0)) continue
      this._drawTileOn(g, tile.x, tile.y, tile.flags, tile.zones)
    }
  }

  private _drawTileOn(g: Graphics, x: number, y: number, flags: number, zones: number[] | undefined): void {
    const px = x * TILE_SIZE
    const py = y * TILE_SIZE

    if (flags & FLAG_MASK) {
      for (const def of ZONE_FLAG_DEFS) {
        if ((flags & def.flag) !== 0) {
          g.rect(px, py, TILE_SIZE, TILE_SIZE)
          g.fill({ color: def.color, alpha: ALPHA })
        }
      }
    }

    if (zones && zones.length > 0) {
      for (const zoneId of zones) {
        g.rect(px, py, TILE_SIZE, TILE_SIZE)
        g.fill({ color: zoneColorHex(zoneId), alpha: ALPHA })
      }
    }
  }

  destroy(): void {
    this._base.destroy()
    this._live.destroy()
    this.container.destroy()
  }
}
