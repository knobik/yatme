import { Application, Container } from 'pixi.js'
import { ChunkManager, buildChunkIndex, chunkKeyForTile } from './ChunkManager'
import { Camera } from './Camera'
import { TileRenderer } from './TileRenderer'
import { SelectionOverlay } from './SelectionOverlay'
import { ZoneOverlay } from './ZoneOverlay'
import { HouseOverlay } from './HouseOverlay'
import { BoundaryOverlay } from './BoundaryOverlay'
import { SpawnOverlay } from './creatures/SpawnOverlay'
import { WaypointOverlay } from './WaypointOverlay'
import { WaypointManager } from './WaypointManager'
import { SpawnManager } from './creatures/SpawnManager'
import { FloorManager } from './FloorManager'
import { LightEngine } from './LightEngine'
import { setupMapInput, type InputHost } from './InputHandler'
import { getItemSpriteId } from './SpriteResolver'
import { getTextureSync, getTexture } from './TextureManager'
import type { FloorViewMode } from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmMap, OtbmTile, OtbmItem } from './otbm'
import type { CopyBuffer } from './CopyBuffer'
import { CreatureSpriteResolver } from './creatures/CreatureSpriteResolver'
import type { CreatureDatabase } from './creatures/CreatureDatabase'
import type { ZoneSelection } from '../hooks/tools/types'

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
  private zoneOverlay: ZoneOverlay
  private houseOverlay: HouseOverlay
  private monsterSpawnOverlay: SpawnOverlay
  private npcSpawnOverlay: SpawnOverlay
  private boundaryOverlay: BoundaryOverlay
  private waypointOverlay: WaypointOverlay
  private _waypointManager: WaypointManager
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
  onInspectorItemDrop?: (pos: { x: number; y: number; z: number }, itemId: number, source: { x: number; y: number; z: number; index: number }) => void
  onDragHover?: (pos: { x: number; y: number; z: number }) => void
  onDragLeave?: () => void
  onTileHover?: (pos: { x: number; y: number; z: number }) => void

  /** Set by drag sources (Inspector/Palette) so dragover can show a ghost preview. */
  dragPreviewItemId: number | null = null

  constructor(app: Application, appearances: AppearanceData, mapData: OtbmMap, spawnManager?: SpawnManager | null, waypointManager?: WaypointManager | null) {
    this.app = app
    this.mapData = mapData
    this.appearances = appearances

    // Camera (app.screen is a persistent Pixi Rectangle — no allocation on access)
    this.camera = new Camera(this.app.screen)
    this._getFloorOffset = (z: number) => this.camera.getFloorOffset(z)

    // Sub-modules
    this.tileRenderer = new TileRenderer(appearances)
    this.selection = new SelectionOverlay()
    this.zoneOverlay = new ZoneOverlay()
    this.houseOverlay = new HouseOverlay()
    this.boundaryOverlay = new BoundaryOverlay()
    this.waypointOverlay = new WaypointOverlay()
    this._waypointManager = waypointManager ?? new WaypointManager([])

    // Spawn overlays
    const sm = spawnManager ?? new SpawnManager()
    this.monsterSpawnOverlay = new SpawnOverlay(sm, 'monster', 0xCC4400, 0xFF6600)
    this.npcSpawnOverlay = new SpawnOverlay(sm, 'npc', 0x2288CC, 0x44BBFF)

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

    // Boundary overlay (hatch pattern on out-of-bounds tiles)
    this.mapContainer.addChild(this.boundaryOverlay.container)

    // Zone overlay (between tile layers and selection overlay)
    this.mapContainer.addChild(this.zoneOverlay.container)

    // House overlay (between zone overlay and selection overlay)
    this.mapContainer.addChild(this.houseOverlay.container)

    // Spawn overlays (between house overlay and selection overlay)
    this.mapContainer.addChild(this.monsterSpawnOverlay.container)
    this.mapContainer.addChild(this.npcSpawnOverlay.container)

    // Waypoint overlay (between spawn overlays and selection overlay)
    this.mapContainer.addChild(this.waypointOverlay.container)

    // Selection overlay (added to mapContainer; FloorManager keeps it on top)
    this.mapContainer.addChild(this.selection.container)

    // Light engine (multiply-blend overlay on top of everything)
    this.lightEngine = new LightEngine()
    this.mapContainer.addChild(this.lightEngine.container)

    // Floor manager
    this.floorManager = new FloorManager(
      this.mapContainer,
      this.boundaryOverlay.container,
      this.zoneOverlay.container,
      this.houseOverlay.container,
      this.monsterSpawnOverlay.container,
      this.npcSpawnOverlay.container,
      this.waypointOverlay.container,
      this.selection.container,
      this.lightEngine.container,
    )

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

    // Initial camera position priority:
    // 1. First town's temple position (most maps have at least one town)
    // 2. Map center (width/2, height/2) at floor 7 — for OTBM maps without towns
    // 3. 1024/1024 at floor 7 — fallback for brand-new empty maps
    if (mapData.towns.length > 0) {
      const town = mapData.towns[0]
      this.camera.setFloor(town.templeZ)
      this.camera.centerOn(town.templeX, town.templeY)
    } else if (mapData.tiles.size > 0) {
      this.camera.setFloor(7)
      this.camera.centerOn(Math.floor(mapData.width / 2), Math.floor(mapData.height / 2))
    } else {
      this.camera.setFloor(7)
      this.camera.centerOn(1024, 1024)
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
    this.zoneOverlay.markDirty()
    this.houseOverlay.markDirty()
    this.monsterSpawnOverlay.markDirty()
    this.npcSpawnOverlay.markDirty()
    this.waypointOverlay.markDirty()
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

  /** Flash a tile with a brief highlight animation. */
  pingTile(x: number, y: number, z: number): void {
    this.selection.pingTile(x, y, z)
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

  /** Invalidate specific chunks, rebuilding active ones in-place. */
  invalidateChunks(keys: Set<string>): void {
    this.chunkManager.invalidateChunks(keys)
    this.lightEngine.markDirty()
    this.zoneOverlay.invalidateChunks(keys)
    this.houseOverlay.invalidateChunks(keys)
    this.monsterSpawnOverlay.invalidateChunks(keys)
    this.npcSpawnOverlay.invalidateChunks(keys)
  }

  /** Update the chunk index when a tile is created or modified. */
  updateChunkIndex(tile: OtbmTile): void {
    this.chunkManager.updateChunkIndex(tile)
    this.lightEngine.markDirty()
  }

  // ── Light engine ──────────────────────────────────────────────

  // ── Zone overlay ──────────────────────────────────────────────

  /** Mark the zone overlay as dirty so it rebuilds on the next frame. */
  markZoneOverlayDirty(): void {
    this.zoneOverlay.markDirty()
  }

  get showZoneOverlay(): boolean { return this.zoneOverlay.visible }

  setShowZoneOverlay(enabled: boolean): void {
    this.zoneOverlay.setVisible(enabled)
  }

  setActiveZone(zone: ZoneSelection | null): void {
    this.zoneOverlay.setActiveZone(zone)
  }

  paintZoneTile(x: number, y: number): void {
    this.zoneOverlay.paintTile(x, y, this.camera.floor)
  }

  // ── House overlay ─────────────────────────────────────────────

  markHouseOverlayDirty(): void {
    this.houseOverlay.markDirty()
  }

  get showHouseOverlay(): boolean { return this.houseOverlay.visible }

  setShowHouseOverlay(enabled: boolean): void {
    this.houseOverlay.setVisible(enabled)
  }

  setActiveHouse(houseId: number | null): void {
    this.houseOverlay.setActiveHouse(houseId)
  }

  paintHouseTile(x: number, y: number): void {
    this.houseOverlay.paintTile(x, y, this.camera.floor)
  }

  // ── Spawn overlays ──────────────────────────────────────────

  setShowMonsterSpawnOverlay(enabled: boolean): void {
    this.monsterSpawnOverlay.setVisible(enabled)
  }

  setShowNpcSpawnOverlay(enabled: boolean): void {
    this.npcSpawnOverlay.setVisible(enabled)
  }

  markMonsterSpawnOverlayDirty(): void {
    this.monsterSpawnOverlay.markDirty()
  }

  markNpcSpawnOverlayDirty(): void {
    this.npcSpawnOverlay.markDirty()
  }

  setShowMonsters(v: boolean): void {
    this.tileRenderer.showMonsters = v
    this.recycleAllChunks()
    this.notifyCamera()
  }

  setShowNpcs(v: boolean): void {
    this.tileRenderer.showNpcs = v
    this.recycleAllChunks()
    this.notifyCamera()
  }

  // ── Waypoint overlay ──────────────────────────────────────────

  get waypointManager(): WaypointManager { return this._waypointManager }

  markWaypointOverlayDirty(): void {
    this.waypointOverlay.markDirty()
  }

  get showWaypointOverlay(): boolean { return this.waypointOverlay.visible }

  setShowWaypointOverlay(enabled: boolean): void {
    this.waypointOverlay.setVisible(enabled)
  }

  setSelectedWaypoint(name: string | null): void {
    this.waypointOverlay.setSelectedWaypoint(name)
  }

  setWaypointDragGhost(x: number, y: number, z: number): void {
    this.waypointOverlay.setDragGhost(x, y, z)
  }

  clearWaypointDragGhost(): void {
    this.waypointOverlay.clearDragGhost()
  }

  setSpawnDragGhost(spawnType: 'monster' | 'npc', x: number, y: number, z: number, radius: number): void {
    const overlay = spawnType === 'monster' ? this.monsterSpawnOverlay : this.npcSpawnOverlay
    overlay.setDragGhost(x, y, z, radius)
  }

  clearSpawnDragGhost(spawnType: 'monster' | 'npc'): void {
    const overlay = spawnType === 'monster' ? this.monsterSpawnOverlay : this.npcSpawnOverlay
    overlay.clearDragGhost()
  }

  setCreatureDatabase(db: CreatureDatabase): void {
    this.tileRenderer.creatureSpriteResolver = new CreatureSpriteResolver(this.appearances)
    this.tileRenderer.creatureDb = db
  }

  get showLights(): boolean { return this.lightEngine.enabled }

  setShowLights(enabled: boolean): void {
    this.lightEngine.setEnabled(enabled)
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

  /** Show a ghost preview of tiles being dragged to a new position. */
  updateDragPreview(tiles: { pos: { x: number; y: number; z: number }; indices: number[] }[], dx: number, dy: number): void {
    this.selection.updateDragPreview(tiles, dx, dy, this.camera.floor, this.mapData.tiles, this.appearances)
  }

  clearDragPreview(): void {
    this.selection.clearDragPreview()
  }

  /** Show a ghost preview of clipboard tiles at a target position. */
  updatePastePreview(buffer: CopyBuffer, targetX: number, targetY: number, targetZ: number): void {
    const origin = buffer.getOrigin()
    const tempMap = new Map<string, OtbmTile>()
    const tileEntries: { pos: { x: number; y: number; z: number }; indices: number[] }[] = []
    for (const t of buffer.getTiles()) {
      const x = origin.x + t.dx
      const y = origin.y + t.dy
      const z = origin.z + t.dz
      // Only preview tiles on the currently viewed floor
      const actualZ = targetZ + t.dz
      if (actualZ !== this.camera.floor) continue
      const key = `${x},${y},${z}`
      tempMap.set(key, { x, y, z, flags: 0, items: t.items })
      tileEntries.push({ pos: { x, y, z }, indices: t.items.map((_: OtbmItem, i: number) => i) })
    }
    const dx = targetX - origin.x
    const dy = targetY - origin.y
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

    this.boundaryOverlay.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
    this.boundaryOverlay.update(this.camera)

    this.selection.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
    this.selection.updatePing()

    this.zoneOverlay.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
    this.zoneOverlay.rebuild(this.camera.floor, this.chunkManager.index)

    this.houseOverlay.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
    this.houseOverlay.rebuild(this.camera.floor, this.chunkManager.index)

    this.monsterSpawnOverlay.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
    this.monsterSpawnOverlay.rebuild(this.camera.floor, this.chunkManager.index)

    this.npcSpawnOverlay.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
    this.npcSpawnOverlay.rebuild(this.camera.floor, this.chunkManager.index)

    this.waypointOverlay.updateContainerOffset(this.camera.getFloorOffset(this.camera.floor))
    this.waypointOverlay.rebuild(this.camera.floor, this._waypointManager, this.camera)
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
    this.waypointOverlay.destroy()
    this.npcSpawnOverlay.destroy()
    this.monsterSpawnOverlay.destroy()
    this.houseOverlay.destroy()
    this.zoneOverlay.destroy()
    this.boundaryOverlay.destroy()
    this.selection.destroy()
    this.floorManager.destroy()
    this.mapContainer.destroy({ children: true })
  }
}
