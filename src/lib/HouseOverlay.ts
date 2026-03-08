import type { Graphics } from 'pixi.js'
import type { OtbmTile } from './otbm'
import { TileOverlay } from './TileOverlay'
import { houseColorHex } from './houseColors'

export class HouseOverlay extends TileOverlay {
  private _activeHouseId: number | null = null

  setActiveHouse(houseId: number | null): void {
    if (houseId === this._activeHouseId) return
    this._activeHouseId = houseId
    this.markDirty()
  }

  paintTile(x: number, y: number, houseId: number | undefined): void {
    if (!this.isVisible || houseId == null) return
    const active = this._activeHouseId === houseId
    this.fillRect(this.liveGraphics, x, y, houseColorHex(houseId), this.alphaFor(active))
  }

  protected hasActiveSelection(): boolean {
    return this._activeHouseId != null
  }

  protected shouldDrawTile(tile: OtbmTile): boolean {
    return tile.houseId != null
  }

  protected drawTile(g: Graphics, tile: OtbmTile): void {
    const active = this._activeHouseId === tile.houseId
    this.fillRect(g, tile.x, tile.y, houseColorHex(tile.houseId!), this.alphaFor(active))
  }
}
