import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { TILE_SIZE } from './constants'

type TilePos = { x: number; y: number; z: number }

// ── SelectionOverlay ────────────────────────────────────────────────

export class SelectionOverlay {
  readonly container: Container
  private _highlightGraphics: Graphics
  private _selectionGraphics: Graphics
  private _brushCursorGraphics: Graphics

  private _selectedTileX = -1
  private _selectedTileY = -1
  private _selectedTileZ = -1
  private _selectionTiles: TilePos[] = []

  // Brush cursor state
  private _brushCursorKey = ''

  // Ghost sprite preview state
  private _ghostContainer: Container
  private _ghostItemId: number = -1
  private _ghostTexture: Texture | null = null
  private _ghostShiftX: number = 0
  private _ghostShiftY: number = 0
  private _ghostSprites: Sprite[] = []
  private _ghostCursorKey: string = ''

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
    this._brushCursorGraphics = new Graphics()
    this._brushCursorGraphics.visible = false
    this._ghostContainer = new Container()
    this._ghostContainer.visible = false
    this.container.addChild(this._highlightGraphics)
    this.container.addChild(this._selectionGraphics)
    this.container.addChild(this._brushCursorGraphics)
    this.container.addChild(this._ghostContainer)
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

  // ── Brush cursor (hover preview) ─────────────────────────────

  updateBrushCursor(tiles: TilePos[], floor: number): void {
    // Build a cache key to avoid unnecessary redraws
    const key = tiles.map(t => `${t.x},${t.y}`).join(';')
    if (key === this._brushCursorKey) return
    this._brushCursorKey = key

    const g = this._brushCursorGraphics
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
      g.stroke({ color: 0xc0d0e0, width: 1, alpha: 0.7 })
      g.rect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      g.fill({ color: 0xc0d0e0, alpha: 0.1 })
    }
    g.visible = true
  }

  clearBrushCursor(): void {
    this._brushCursorKey = ''
    this._brushCursorGraphics.clear()
    this._brushCursorGraphics.visible = false
  }

  // ── Ghost sprite preview ───────────────────────────────────────

  setGhostTexture(
    itemId: number,
    texture: Texture | null,
    shiftX: number,
    shiftY: number,
  ): void {
    if (itemId === this._ghostItemId) return
    this._ghostItemId = itemId
    this._ghostTexture = texture
    this._ghostShiftX = shiftX
    this._ghostShiftY = shiftY
    this._ghostCursorKey = '' // force position recalc
    this._clearGhostSprites()
  }

  updateGhostCursor(tiles: TilePos[], floor: number): void {
    if (!this._ghostTexture || tiles.length === 0) {
      this._ghostContainer.visible = false
      return
    }

    const key = tiles.map(t => `${t.x},${t.y}`).join(';')
    if (key === this._ghostCursorKey) return
    this._ghostCursorKey = key

    const tex = this._ghostTexture
    const tw = tex.width
    const th = tex.height

    // Grow sprite pool as needed
    while (this._ghostSprites.length < tiles.length) {
      const s = new Sprite(tex)
      s.alpha = 0.5
      s.roundPixels = true
      this._ghostContainer.addChild(s)
      this._ghostSprites.push(s)
    }

    // Position visible sprites, hide excess
    let idx = 0
    for (const t of tiles) {
      if (t.z !== floor) continue
      const sprite = this._ghostSprites[idx]
      sprite.texture = tex
      sprite.x = t.x * TILE_SIZE + TILE_SIZE - tw - this._ghostShiftX
      sprite.y = t.y * TILE_SIZE + TILE_SIZE - th - this._ghostShiftY
      sprite.visible = true
      idx++
    }
    for (let i = idx; i < this._ghostSprites.length; i++) {
      this._ghostSprites[i].visible = false
    }

    this._ghostContainer.visible = true
  }

  clearGhostCursor(): void {
    this._ghostItemId = -1
    this._ghostTexture = null
    this._ghostCursorKey = ''
    this._clearGhostSprites()
    this._ghostContainer.visible = false
  }

  private _clearGhostSprites(): void {
    for (const s of this._ghostSprites) s.destroy()
    this._ghostSprites.length = 0
    this._ghostContainer.removeChildren()
  }

  // ── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    this._clearGhostSprites()
    this._ghostContainer.destroy()
    this._highlightGraphics.destroy()
    this._selectionGraphics.destroy()
    this._brushCursorGraphics.destroy()
    this.container.destroy()
  }
}
