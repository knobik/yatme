import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE } from './constants'

type TilePos = { x: number; y: number; z: number }

// ── SelectionOverlay ────────────────────────────────────────────────

export class SelectionOverlay {
  readonly container: Container
  private _highlightGraphics: Graphics
  private _selectionGraphics: Graphics

  private _selectedTileX = -1
  private _selectedTileY = -1
  private _selectedTileZ = -1
  private _selectionTiles: TilePos[] = []

  // Dirty tracking — avoid redrawing Graphics when nothing changed
  private _highlightDirty = false
  private _lastHighlightFloor = -1
  private _lastHighlightOffset = NaN

  constructor() {
    this.container = new Container()
    this._highlightGraphics = new Graphics()
    this._highlightGraphics.visible = false
    this._selectionGraphics = new Graphics()
    this._selectionGraphics.visible = false
    this.container.addChild(this._highlightGraphics)
    this.container.addChild(this._selectionGraphics)
  }

  // ── Selection state ───────────────────────────────────────────

  get selectedTileX(): number { return this._selectedTileX }
  get selectedTileY(): number { return this._selectedTileY }
  get selectedTileZ(): number { return this._selectedTileZ }

  select(x: number, y: number, z: number): void {
    this._selectedTileX = x
    this._selectedTileY = y
    this._selectedTileZ = z
    this._highlightDirty = true
  }

  deselect(): void {
    this._selectedTileX = -1
    this._selectedTileY = -1
    this._selectedTileZ = -1
    this._highlightGraphics.visible = false
    this._highlightDirty = false
    this._lastHighlightOffset = NaN
  }

  // ── Highlight (single-tile cursor) ────────────────────────────

  updateHighlight(floor: number, floorOffset: number): void {
    // Always keep the container positioned for the current floor —
    // both _highlightGraphics and _selectionGraphics are children.
    if (floorOffset !== this._lastHighlightOffset) {
      this.container.position.set(-floorOffset, -floorOffset)
      this._lastHighlightOffset = floorOffset
    }

    if (this._selectedTileX < 0 || this._selectedTileZ !== floor) {
      this._highlightGraphics.visible = false
      return
    }

    // Only redraw geometry when selection or floor changed
    if (this._highlightDirty || floor !== this._lastHighlightFloor) {
      const g = this._highlightGraphics
      g.clear()
      const px = this._selectedTileX * TILE_SIZE
      const py = this._selectedTileY * TILE_SIZE
      g.rect(px, py, TILE_SIZE, TILE_SIZE)
      g.stroke({ color: 0xd4a549, width: 1.5, alpha: 0.9 })
      g.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      g.fill({ color: 0xd4a549, alpha: 0.1 })
      g.visible = true

      if (this._selectionTiles.length > 0) {
        this.updateOverlay(this._selectionTiles, floor)
      }

      this._highlightDirty = false
      this._lastHighlightFloor = floor
    }
  }

  // ── Multi-tile overlay ────────────────────────────────────────

  updateOverlay(tiles: TilePos[], floor: number): void {
    this._selectionTiles = tiles
    const g = this._selectionGraphics
    g.clear()
    if (tiles.length === 0) {
      g.visible = false
      return
    }
    for (const t of tiles) {
      if (t.z !== floor) continue
      const px = t.x * TILE_SIZE
      const py = t.y * TILE_SIZE
      g.rect(px, py, TILE_SIZE, TILE_SIZE)
      g.stroke({ color: 0xd4a549, width: 1, alpha: 0.7 })
      g.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      g.fill({ color: 0xd4a549, alpha: 0.08 })
    }
    g.visible = true
  }

  clearOverlay(): void {
    this._selectionTiles = []
    this._selectionGraphics.clear()
    this._selectionGraphics.visible = false
  }

  // ── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    this._highlightGraphics.destroy()
    this._selectionGraphics.destroy()
    this.container.destroy()
  }
}
