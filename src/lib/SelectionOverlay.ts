import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { TILE_SIZE } from './constants'
import { renderTileItems } from './renderTileItems'
import type { OtbmTile } from './otbm'
import type { AppearanceData } from './appearances'

type TilePos = { x: number; y: number; z: number }

// ── SelectionOverlay ────────────────────────────────────────────────

export class SelectionOverlay {
  readonly container: Container
  private _brushCursorGraphics: Graphics

  private _selectedTileX = -1
  private _selectedTileY = -1
  private _selectedTileZ = -1

  // Selection border state
  private _selectionBorderGraphics: Graphics
  private _selectionBorderKey = ''

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

  // Tile ping animation (RME-style pulsating rectangle)
  private _pingGraphics: Graphics
  private _pingStartTime = 0
  private _pingDuration = 5000 // ms
  private _pingActive = false
  private _pingX = 0
  private _pingY = 0

  // Dirty tracking
  private _lastHighlightOffset = NaN

  constructor() {
    this.container = new Container()
    this._selectionBorderGraphics = new Graphics()
    this._selectionBorderGraphics.visible = false
    this._brushCursorGraphics = new Graphics()
    this._brushCursorGraphics.visible = false
    this._ghostContainer = new Container()
    this._ghostContainer.visible = false
    this._pingGraphics = new Graphics()
    this._pingGraphics.visible = false
    this.container.addChild(this._selectionBorderGraphics)
    this.container.addChild(this._brushCursorGraphics)
    this.container.addChild(this._ghostContainer)
    this.container.addChild(this._pingGraphics)
  }

  // ── Selection state ───────────────────────────────────────────

  get selectedTileX(): number { return this._selectedTileX }
  get selectedTileY(): number { return this._selectedTileY }
  get selectedTileZ(): number { return this._selectedTileZ }

  select(x: number, y: number, z: number): void {
    this._selectedTileX = x
    this._selectedTileY = y
    this._selectedTileZ = z
  }

  deselect(): void {
    this._selectedTileX = -1
    this._selectedTileY = -1
    this._selectedTileZ = -1
  }

  // ── Container positioning ────────────────────────────────────

  updateContainerOffset(floorOffset: number): void {
    if (floorOffset !== this._lastHighlightOffset) {
      this.container.position.set(-floorOffset, -floorOffset)
      this._lastHighlightOffset = floorOffset
    }
  }

  // ── Selection border ─────────────────────────────────────────

  updateSelectionBorder(tiles: TilePos[], floor: number): void {
    const key = tiles.map(t => `${t.x},${t.y}`).join(';')
    if (key === this._selectionBorderKey) return
    this._selectionBorderKey = key

    const g = this._selectionBorderGraphics
    g.clear()

    if (tiles.length === 0) {
      g.visible = false
      return
    }

    // Build set of selected positions for neighbor lookup
    const selected = new Set<string>()
    for (const t of tiles) {
      if (t.z !== floor) continue
      selected.add(`${t.x},${t.y}`)
    }

    if (selected.size === 0) {
      g.visible = false
      return
    }

    // Draw only outer edges (skip edges shared between selected tiles)
    for (const t of tiles) {
      if (t.z !== floor) continue
      const px = t.x * TILE_SIZE
      const py = t.y * TILE_SIZE

      if (!selected.has(`${t.x},${t.y - 1}`)) {
        g.moveTo(px, py).lineTo(px + TILE_SIZE, py)
      }
      if (!selected.has(`${t.x},${t.y + 1}`)) {
        g.moveTo(px, py + TILE_SIZE).lineTo(px + TILE_SIZE, py + TILE_SIZE)
      }
      if (!selected.has(`${t.x - 1},${t.y}`)) {
        g.moveTo(px, py).lineTo(px, py + TILE_SIZE)
      }
      if (!selected.has(`${t.x + 1},${t.y}`)) {
        g.moveTo(px + TILE_SIZE, py).lineTo(px + TILE_SIZE, py + TILE_SIZE)
      }
    }

    g.stroke({ color: 0xd4a549, width: 1, alpha: 0.8 })
    g.visible = true
  }

  clearSelectionBorder(): void {
    this._selectionBorderKey = ''
    this._selectionBorderGraphics.clear()
    this._selectionBorderGraphics.visible = false
  }

  // ── Drag-move preview (ghost items) ─────────────────────────────

  private _dragPreviewContainer: Container | null = null
  private _dragPreviewKey = ''

  updateDragPreview(
    tiles: { pos: TilePos; indices: number[] }[],
    dx: number,
    dy: number,
    floor: number,
    tileMap: Map<string, OtbmTile>,
    appearances: AppearanceData,
  ): void {
    if (tiles.length === 0) {
      this.clearDragPreview()
      return
    }

    const key = `${tiles.map(t => `${t.pos.x},${t.pos.y}:${t.indices.join(',')}`).join(';')}:${dx},${dy}`
    if (key === this._dragPreviewKey) return
    this._dragPreviewKey = key

    if (!this._dragPreviewContainer) {
      this._dragPreviewContainer = new Container()
      this._dragPreviewContainer.alpha = 0.5
      this.container.addChild(this._dragPreviewContainer)
    }

    // Clear previous sprites
    this._dragPreviewContainer.removeChildren()

    for (const { pos: t, indices } of tiles) {
      if (t.z !== floor) continue
      const tileKey = `${t.x},${t.y},${t.z}`
      const tile = tileMap.get(tileKey)
      if (!tile) continue

      const selectedItems = indices
        .filter(i => i >= 0 && i < tile.items.length)
        .map(i => tile.items[i])

      renderTileItems({
        parent: this._dragPreviewContainer!,
        items: selectedItems,
        tile,
        baseX: (t.x + dx) * TILE_SIZE,
        baseY: (t.y + dy) * TILE_SIZE,
        appearances,
      })
    }

    this._dragPreviewContainer.visible = true
  }

  clearDragPreview(): void {
    this._dragPreviewKey = ''
    if (this._dragPreviewContainer) {
      this._dragPreviewContainer.removeChildren()
      this._dragPreviewContainer.visible = false
    }
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

  // ── Tile ping animation ─────────────────────────────────────

  pingTile(x: number, y: number, _floor: number): void {
    this._pingActive = true
    this._pingStartTime = performance.now()
    this._pingX = x * TILE_SIZE
    this._pingY = y * TILE_SIZE
    this._pingGraphics.visible = true
  }

  /** Called each frame from the update loop — redraws the pulsating rectangle (RME-style). */
  updatePing(): void {
    if (!this._pingActive) return

    const elapsed = performance.now() - this._pingStartTime
    if (elapsed >= this._pingDuration) {
      this._pingActive = false
      this._pingGraphics.visible = false
      this._pingGraphics.clear()
      return
    }

    // RME formula: size oscillates between 30% and 80% of tile size every 1000ms
    const size = TILE_SIZE * (0.3 + Math.abs(500 - (elapsed % 1000)) / 1000)
    const offset = (TILE_SIZE - size) / 2

    const g = this._pingGraphics
    g.clear()

    const px = this._pingX + offset
    const py = this._pingY + offset

    // Outer black border for contrast
    g.rect(px, py, size, size)
    g.stroke({ color: 0x000000, width: 2, alpha: 1 })
    // Inner white border
    g.rect(px + 1, py + 1, size - 2, size - 2)
    g.stroke({ color: 0xffffff, width: 2, alpha: 1 })
  }

  // ── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    this._clearGhostSprites()
    this._ghostContainer.destroy()
    this._brushCursorGraphics.destroy()
    this._pingGraphics.destroy()
    this._selectionBorderGraphics.destroy()
    this._dragPreviewContainer?.destroy()
    this.container.destroy()
  }
}
