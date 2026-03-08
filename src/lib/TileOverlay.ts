import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE } from './constants'
import type { OtbmMap, OtbmTile } from './otbm'

export const ALPHA_ACTIVE = 0.35
export const ALPHA_INACTIVE = 0.12
export const ALPHA_NONE = 0.25

/**
 * Base class for tile-based color overlays (zones, houses, etc.).
 *
 * Subclasses implement:
 * - `drawTile(g, tile)` — draw a single tile onto a Graphics object
 * - `hasActiveSelection()` — whether an active item is set (affects alpha)
 * - `shouldDrawTile(tile)` — filter tiles during full rebuild
 */
export abstract class TileOverlay {
  readonly container: Container
  protected _base: Graphics
  protected _live: Graphics
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

  beginPaint(): void {
    this._painting = true
    this._live.clear()
  }

  endPaint(): void {
    this._painting = false
    this._live.clear()
    this._dirty = true
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
      if (!this.shouldDrawTile(tile)) continue
      this.drawTile(g, tile)
    }
  }

  destroy(): void {
    this._base.destroy()
    this._live.destroy()
    this.container.destroy()
  }

  // ── Helpers for subclasses ────────────────────────────────────

  protected get isVisible(): boolean { return this._visible }

  protected alphaFor(isActive: boolean): number {
    if (!this.hasActiveSelection()) return ALPHA_NONE
    return isActive ? ALPHA_ACTIVE : ALPHA_INACTIVE
  }

  protected fillRect(g: Graphics, x: number, y: number, color: number, alpha: number): void {
    g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    g.fill({ color, alpha })
  }

  protected get liveGraphics(): Graphics { return this._live }

  // ── Abstract ──────────────────────────────────────────────────

  /** Whether any active item is selected (affects alpha calculation). */
  protected abstract hasActiveSelection(): boolean

  /** Filter: should this tile be drawn during a full rebuild? */
  protected abstract shouldDrawTile(tile: OtbmTile): boolean

  /** Draw a single tile's overlay onto the given Graphics object. */
  protected abstract drawTile(g: Graphics, tile: OtbmTile): void
}
