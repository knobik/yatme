import type { Graphics } from 'pixi.js'
import type { OtbmTile } from './otbm'
import { TileOverlay } from './TileOverlay'
import { ZONE_FLAG_DEFS } from '../hooks/tools/types'
import type { ZoneSelection } from '../hooks/tools/types'
import { zoneColorHex } from './zoneColors'

const FLAG_MASK = 0x0001 | 0x0004 | 0x0008 | 0x0010 | 0x0020

export class ZoneOverlay extends TileOverlay {
  private _activeZone: ZoneSelection | null = null

  setActiveZone(zone: ZoneSelection | null): void {
    const changed = zone?.type !== this._activeZone?.type ||
      (zone?.type === 'flag' && this._activeZone?.type === 'flag' && zone.flag !== this._activeZone.flag) ||
      (zone?.type === 'zone' && this._activeZone?.type === 'zone' && zone.zoneId !== this._activeZone.zoneId)
    if (!changed) return
    this._activeZone = zone
    this.markDirty()
  }

  paintTile(x: number, y: number, flags: number, zones: number[] | undefined): void {
    if (!this.isVisible) return
    this._drawZoneTile(this.liveGraphics, x, y, flags, zones)
  }

  protected hasActiveSelection(): boolean {
    return this._activeZone != null
  }

  protected shouldDrawTile(tile: OtbmTile): boolean {
    return !!(tile.flags & FLAG_MASK) || !!(tile.zones && tile.zones.length > 0)
  }

  protected drawTile(g: Graphics, tile: OtbmTile): void {
    this._drawZoneTile(g, tile.x, tile.y, tile.flags, tile.zones)
  }

  private _drawZoneTile(g: Graphics, x: number, y: number, flags: number, zones: number[] | undefined): void {
    if (flags & FLAG_MASK) {
      for (const def of ZONE_FLAG_DEFS) {
        if ((flags & def.flag) !== 0) {
          const active = this._activeZone?.type === 'flag' && this._activeZone.flag === def.flag
          this.fillRect(g, x, y, def.color, this.alphaFor(active))
        }
      }
    }

    if (zones && zones.length > 0) {
      for (const zoneId of zones) {
        const active = this._activeZone?.type === 'zone' && this._activeZone.zoneId === zoneId
        this.fillRect(g, x, y, zoneColorHex(zoneId), this.alphaFor(active))
      }
    }
  }
}
