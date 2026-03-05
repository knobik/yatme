import { Application, Container } from 'pixi.js'
import { ChunkManager, buildChunkIndex, chunkKeyForTile } from './ChunkManager'
import { Camera } from './Camera'
import { TileRenderer } from './TileRenderer'
import { SelectionOverlay } from './SelectionOverlay'
import { FloorManager } from './FloorManager'
import { LightEngine } from './LightEngine'
import { setupMapInput, type InputHost } from './InputHandler'
import { getItemSpriteId } from './SpriteResolver'
import { getTextureSync, getTexture } from './TextureManager'
import type { FloorViewMode } from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmMap, OtbmTile, OtbmItem } from './otbm'
import type { ClipboardData } from '../hooks/useEditorTools'

export { type FloorViewMode } from './constants'

// ── MapRenderer ─────────────────────────────────────────────────────

export class MapRenderer implements InputHost {
  private app: Application
  private mapContainer: Container
  readonly mapData: OtbmMap
  readonly camera: Camera
  private appearances: AppearanceData

  // Sub-modules
  private tileRenderer: TileRenderer
  private selection: SelectionOverlay
  private floorManager: FloorManager
  private chunkManager: ChunkManager
  private lightEngine: LightEngine

  // Settings
  private _showSelectionBorder = false

  // Lifecycle
  private _cleanupInput: (() => void) | null = null
  private _boundUpdate: () => void
  private _getFloorOffset: (z: number) => number

  // Callbacks (InputHost interface + camera change)
  onCameraChange?: (x: number, y: number, zoom: number, floor: number, floorViewMode: FloorViewMode, showTransparentUpper: boolean) => void
  onTileClick?: (tile: OtbmTile | null, worldX: number, worldY: number) => void
  onTileDoubleClick?: (pos: { x: number; y: number; z: number }, event: MouseEvent) => void
  onTilePointerDown?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTilePointerMove?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTilePointerUp?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTileContextMenu?: (pos: { x: number; y: number; z: number }, tile: OtbmTile | null, screenX: number, screenY: number) => void
  onItemDrop?: (pos: { x: number; y: number; z: number }, itemId: number) => void
  onTileHover?: (pos: { x: number; y: number; z: number }) => void

  constructor(app: Application, appearances: AppearanceData, mapData: OtbmMap) {
    this.app = app
    this.mapData = mapData
    this.appearances = appearances

    // Camera (app.screen is a persistent Pixi Rectangle — no allocation on access)
    this.camera = new Camera(this.app.screen)
    this._getFloorOffset = (z: number) => this.camera.getFloorOffset(z)

    // Sub-modules
    this.tileRenderer = new TileRenderer(appearances)
    this.selection = new SelectionOverlay()

    // Chunk manager
    const { index, animatedKeys } = buildChunkIndex(mapData.tiles, appearances)
    this.chunkManager = new ChunkManager(
      {
        appearances,
        tileRenderer: this.tileRenderer,
        camera: this.camera,
        getFloorContainer: (z) => this.floorManager.getContainer(z),
      },
      index,
      animatedKeys,
    )

    // Stage
    this.mapContainer = new Container()
    this.app.stage.addChild(this.mapContainer)

    // Selection overlay (added to mapContainer; FloorManager keeps it on top)
    this.mapContainer.addChild(this.selection.container)

    // Light engine (multiply-blend overlay on top of everything)
    this.lightEngine = new LightEngine()
    this.mapContainer.addChild(this.lightEngine.container)

    // Floor manager
    this.floorManager = new FloorManager(this.mapContainer, this.selection.container, this.lightEngine.container)

    // Input
    this._cleanupInput = setupMapInput(
      this.app.canvas as HTMLCanvasElement,
      this,
      () => this.notifyCamera(),
      (x, y, z, tile) => {
        this.selection.select(x, y, z)
        this.onTileClick?.(tile, x, y)
      },
    )

    // Center on first town
    if (mapData.towns.length > 0) {
      const town = mapData.towns[0]
      this.camera.setFloor(town.templeZ)
      this.camera.centerOn(town.templeX, town.templeY)
    }

    this._boundUpdate = () => this.update()
    this.app.ticker.add(this._boundUpdate)
  }

  // ── Public API (delegates to Camera) ───────────────────────────

  get zoom(): number { return this.camera.zoom }
  get floor(): number { return this.camera.floor }
  get floorViewMode(): FloorViewMode { return this.camera.floorViewMode }
  get showTransparentUpper(): boolean { return this.camera.showTransparentUpper }
  get worldX(): number { return this.camera.worldX }
  get worldY(): number { return this.camera.worldY }

  setFloor(z: number): void {
    if (!this.camera.setFloor(z)) return
    this.deselectTile()
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setFloorViewMode(mode: FloorViewMode): void {
    if (!this.camera.setFloorViewMode(mode)) return
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setShowTransparentUpper(v: boolean): void {
    if (!this.camera.setShowTransparentUpper(v)) return
    this.floorManager.invalidate()
    this.notifyCamera()
  }

  centerOn(x: number, y: number): void {
    this.camera.centerOn(x, y)
    this.notifyCamera()
  }

  zoomIn(): void {
    const cx = this.app.screen.width / 2
    const cy = this.app.screen.height / 2
    this.camera.zoomAt(cx, cy, -1)
    this.notifyCamera()
  }

  zoomOut(): void {
    const cx = this.app.screen.width / 2
    const cy = this.app.screen.height / 2
    this.camera.zoomAt(cx, cy, 1)
    this.notifyCamera()
  }

  resetZoom(): void {
    this.camera.setZoom(1, this.app.screen.width, this.app.screen.height)
    this.notifyCamera()
  }

  getTileAt(screenX: number, screenY: number): { x: number; y: number; z: number } {
    return this.camera.getTileAt(screenX, screenY)
  }

  // ── Editor support ─────────────────────────────────────────────

  /** Invalidate specific chunks, forcing them to rebuild on next frame. */
  invalidateChunks(keys: Set<string>): void {
    this.chunkManager.invalidateChunks(keys)
    this.lightEngine.markDirty()
  }

  /** Update the chunk index when a tile is created or modified. */
  updateChunkIndex(tile: OtbmTile): void {
    this.chunkManager.updateChunkIndex(tile)
    this.lightEngine.markDirty()
  }

  // ── Light engine ──────────────────────────────────────────────

  get showLights(): boolean { return this.lightEngine.enabled }

  setShowLights(enabled: boolean): void {
    this.lightEngine.setEnabled(enabled)
  }

  setGlobalLightColor(r: number, g: number, b: number): void {
    this.lightEngine.setGlobalLightColor(r, g, b)
  }

  // ── Selection border ────────────────────────────────────────────

  get selectionBorder(): boolean { return this._showSelectionBorder }

  setShowSelectionBorder(v: boolean): void {
    this._showSelectionBorder = v
    if (!v) this.selection.clearSelectionBorder()
  }

  /** Set highlights for tiles/items. Each entry: null indices = whole tile, array = specific items. */
  setHighlights(highlights: { pos: { x: number; y: number; z: number }; indices: number[] | null }[]): void {
    const affectedChunks = this._collectHighlightChunkKeys()
    this.tileRenderer.clearHighlight()

    for (const h of highlights) {
      const tileKey = `${h.pos.x},${h.pos.y},${h.pos.z}`
      this.tileRenderer.setHighlight(tileKey, h.indices)
      affectedChunks.add(chunkKeyForTile(h.pos.x, h.pos.y, h.pos.z))
    }

    if (affectedChunks.size > 0) {
      this.chunkManager.rebuildChunksForHighlight(affectedChunks)
    }

    if (this._showSelectionBorder) {
      const positions = highlights.map(h => h.pos)
      this.selection.updateSelectionBorder(positions, this.camera.floor)
    }
  }

  clearItemHighlight(): void {
    const affectedChunks = this._collectHighlightChunkKeys()
    this.tileRenderer.clearHighlight()
    if (affectedChunks.size > 0) {
      this.chunkManager.rebuildChunksForHighlight(affectedChunks)
    }
    if (this._showSelectionBorder) {
      this.selection.clearSelectionBorder()
    }
  }

  /** Collect chunk keys for all currently highlighted tiles. */
  private _collectHighlightChunkKeys(): Set<string> {
    const keys = new Set<string>()
    for (const tileKey of this.tileRenderer.highlightedTileKeys.keys()) {
      const parts = tileKey.split(',')
      keys.add(chunkKeyForTile(+parts[0], +parts[1], +parts[2]))
    }
    return keys
  }

  /** Update the brush cursor (hover preview). */
  updateBrushCursor(tiles: { x: number; y: number; z: number }[]): void {
    this.selection.updateBrushCursor(tiles, this.camera.floor)
  }

  clearBrushCursor(): void {
    this.selection.clearBrushCursor()
  }

  /** Show a ghost preview of tiles being dragged to a new position. */
  updateDragPreview(tiles: { pos: { x: number; y: number; z: number }; indices: number[] }[], dx: number, dy: number): void {
    this.selection.updateDragPreview(tiles, dx, dy, this.camera.floor, this.mapData.tiles, this.appearances)
  }

  clearDragPreview(): void {
    this.selection.clearDragPreview()
  }

  /** Show a ghost preview of clipboard tiles at a target position. */
  updatePastePreview(clipboard: ClipboardData, targetX: number, targetY: number, targetZ: number): void {
    // Build a temporary tileMap with clipboard data at their original positions
    const tempMap = new Map<string, OtbmTile>()
    const tileEntries: { pos: { x: number; y: number; z: number }; indices: number[] }[] = []
    for (const t of clipboard.tiles) {
      const x = clipboard.originX + t.dx
      const y = clipboard.originY + t.dy
      const key = `${x},${y},${targetZ}`
      tempMap.set(key, { x, y, z: targetZ, flags: 0, items: t.items })
      tileEntries.push({ pos: { x, y, z: targetZ }, indices: t.items.map((_, i) => i) })
    }
    // Compute offset from original positions to target
    const dx = targetX - clipboard.originX
    const dy = targetY - clipboard.originY
    this.selection.updateDragPreview(tileEntries, dx, dy, this.camera.floor, tempMap, this.appearances)
  }

  /** Update the ghost sprite preview for the brush cursor. */
  updateGhostPreview(itemId: number | null, tiles: { x: number; y: number; z: number }[]): void {
    if (itemId == null || tiles.length === 0) {
      this.selection.clearGhostCursor()
      return
    }

    const appearance = this.appearances.objects.get(itemId)
    if (!appearance) {
      this.selection.clearGhostCursor()
      return
    }

    const firstTile = tiles[0]
    const fakeItem: OtbmItem = { id: itemId }
    const fakeTile = { x: firstTile.x, y: firstTile.y, z: firstTile.z, flags: 0, items: [fakeItem] }
    const spriteId = getItemSpriteId(appearance, fakeItem, fakeTile, 0)

    if (spriteId == null || spriteId === 0) {
      this.selection.clearGhostCursor()
      return
    }

    const texture = getTextureSync(spriteId)
    if (texture) {
      const shift = appearance.flags?.shift
      this.selection.setGhostTexture(itemId, texture, shift?.x ?? 0, shift?.y ?? 0)
      this.selection.updateGhostCursor(tiles, this.camera.floor)
    } else {
      // Texture not loaded yet — load async then set
      getTexture(spriteId).then(tex => {
        if (tex) {
          const shift = appearance.flags?.shift
          this.selection.setGhostTexture(itemId, tex, shift?.x ?? 0, shift?.y ?? 0)
          this.selection.updateGhostCursor(tiles, this.camera.floor)
        }
      })
    }
  }

  clearGhostPreview(): void {
    this.selection.clearGhostCursor()
  }

  /** Change the canvas cursor style. */
  setCursorStyle(style: string): void {
    (this.app.canvas as HTMLCanvasElement).style.cursor = style
  }

  // ── Tile selection ─────────────────────────────────────────────

  deselectTile(): void {
    this.selection.deselect()
    this.onTileClick?.(null, -1, -1)
  }

  // ── Camera notification ────────────────────────────────────────

  private notifyCamera(): void {
    this.onCameraChange?.(
      this.camera.worldX, this.camera.worldY, this.camera.zoom,
      this.camera.floor, this.camera.floorViewMode, this.camera.showTransparentUpper,
    )
  }

  // ── Update loop ────────────────────────────────────────────────

  private update(): void {
    this.mapContainer.position.set(
      Math.round(-this.camera.x * this.camera.zoom),
      Math.round(-this.camera.y * this.camera.zoom),
    )
    this.mapContainer.scale.set(this.camera.zoom)

    const visibleFloors = this.camera.getVisibleFloors()
    this.floorManager.update(
      visibleFloors,
      this._getFloorOffset,
      this.camera.floor,
      this.camera.showTransparentUpper,
    )

    this.chunkManager.update(visibleFloors)

    this.lightEngine.update(this.camera, this.chunkManager.index, this.appearances, visibleFloors)

    this.selection.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  recycleAllChunks(): void {
    this.chunkManager.recycleAll()
    this.floorManager.recycleAll()
  }

  destroy(): void {
    this.app.ticker.remove(this._boundUpdate)
    this._cleanupInput?.()
    this.recycleAllChunks()
    this.lightEngine.destroy()
    this.selection.destroy()
    this.floorManager.destroy()
    this.mapContainer.destroy({ children: true })
  }
}
