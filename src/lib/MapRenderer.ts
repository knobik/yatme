import { Application, Container } from 'pixi.js'
import { ChunkManager, buildChunkIndex } from './ChunkManager'
import { Camera } from './Camera'
import { TileRenderer } from './TileRenderer'
import { SelectionOverlay } from './SelectionOverlay'
import { FloorManager } from './FloorManager'
import { setupMapInput, type InputHost } from './InputHandler'
import { type FloorViewMode, ZOOM_LEVELS } from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmMap, OtbmTile } from './otbm'

export { type FloorViewMode } from './constants'

// ── MapRenderer ─────────────────────────────────────────────────────

export class MapRenderer implements InputHost {
  private app: Application
  private mapContainer: Container
  readonly mapData: OtbmMap
  readonly camera: Camera

  // Sub-modules
  private tileRenderer: TileRenderer
  private selection: SelectionOverlay
  private floorManager: FloorManager
  private chunkManager: ChunkManager

  // Lifecycle
  private _cleanupInput: (() => void) | null = null
  private _boundUpdate: () => void
  private _getFloorOffset: (z: number) => number

  // Callbacks (InputHost interface + camera change)
  onCameraChange?: (x: number, y: number, zoom: number, floor: number, floorViewMode: FloorViewMode, showTransparentUpper: boolean) => void
  onTileClick?: (tile: OtbmTile | null, worldX: number, worldY: number) => void
  onTilePointerDown?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTilePointerMove?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTilePointerUp?: (pos: { x: number; y: number; z: number }, event: PointerEvent) => void
  onTileContextMenu?: (pos: { x: number; y: number; z: number }, tile: OtbmTile | null, screenX: number, screenY: number) => void
  onItemDrop?: (pos: { x: number; y: number; z: number }, itemId: number) => void
  onTileHover?: (pos: { x: number; y: number; z: number }) => void

  constructor(app: Application, appearances: AppearanceData, mapData: OtbmMap) {
    this.app = app
    this.mapData = mapData

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

    // Floor manager
    this.floorManager = new FloorManager(this.mapContainer, this.selection.container)

    // Input
    this._cleanupInput = setupMapInput(
      this.app.canvas as HTMLCanvasElement,
      this,
      () => this.notifyCamera(),
      (x, y, z, tile) => {
        this.selection.select(x, y, z)
        this.selection.updateHighlight(this.camera.floor, this.camera.getFloorOffset(this.camera.floor))
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
  }

  /** Update the chunk index when a tile is created or modified. */
  updateChunkIndex(tile: OtbmTile): void {
    this.chunkManager.updateChunkIndex(tile)
  }

  /** Set multi-tile selection overlay. */
  updateSelectionOverlay(tiles: { x: number; y: number; z: number }[]): void {
    this.selection.updateOverlay(tiles, this.camera.floor)
  }

  clearSelectionOverlay(): void {
    this.selection.clearOverlay()
  }

  /** Update the brush cursor (hover preview). */
  updateBrushCursor(tiles: { x: number; y: number; z: number }[]): void {
    this.selection.updateBrushCursor(tiles, this.camera.floor)
  }

  clearBrushCursor(): void {
    this.selection.clearBrushCursor()
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

    this.selection.updateHighlight(this.camera.floor, this.camera.getFloorOffset(this.camera.floor))
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
    this.selection.destroy()
    this.floorManager.destroy()
    this.mapContainer.destroy({ children: true })
  }
}
