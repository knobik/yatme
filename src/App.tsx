import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import type { AppearanceData } from './lib/appearances'
import type { OtbmMap, OtbmTown } from './lib/otbm'
import type { MapRenderer, FloorViewMode } from './lib/MapRenderer'
import { MapMutator } from './lib/MapMutator'
import type { ItemRegistry } from './lib/items'
import type { CreatureDatabase } from './lib/creatures'
import { useEditorTools, deriveHighlights } from './hooks/useEditorTools'
import type { BrushRegistry } from './lib/brushes/BrushRegistry'
import { Inspector } from './components/Inspector'
import { ItemPropertiesModal } from './components/ItemPropertiesModal'
import type { OtbmItem } from './lib/otbm'
import { applyItemProperties } from './lib/otbm'
import { BrushPalette, type BrushPaletteHandle } from './components/BrushPalette'
import type { ResolvedTileset } from './lib/tilesets/TilesetTypes'
import { Toolbar } from './components/Toolbar'
import { ContextMenu } from './components/ContextMenu'
import { GoToPositionDialog } from './components/GoToPositionDialog'
import { FindItemDialog } from './components/FindItemDialog'
import { ReplaceItemsDialog } from './components/ReplaceItemsDialog'
import { SettingsModal } from './components/SettingsModal'
import { MapPropertiesModal, type MapPropertiesPatch } from './components/MapPropertiesModal'
import { EditTownsModal } from './components/EditTownsModal'
import { SaveToast } from './components/SaveToast'
import { loadSettings, saveSettings, type EditorSettings } from './lib/EditorSettings'
import { findEntryInTilesets } from './lib/tilesets/TilesetLoader'
import { ZONE_FLAG_DEFS, type BrushSelection } from './hooks/tools/types'
import { scrubZoneFromTiles } from './lib/zoneCleanup'
import { scrubHouseFromTiles } from './lib/houseCleanup'
import { ZonePalette } from './components/ZonePalette'
import { HousePalette } from './components/HousePalette'
import { MonsterPalette } from './components/MonsterPalette'
import type { CategoryType } from './lib/tilesets/TilesetTypes'
import { emptySidecars, type MapSidecars } from './lib/sidecars'
import { useEditorInit, type CameraState } from './hooks/useEditorInit'
import { useContextMenu } from './hooks/useContextMenu'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSaveExport } from './hooks/useSaveExport'
import { useToolAutoToggle } from './hooks/useToolAutoToggle'
import { FloorSelector } from './components/FloorSelector'
import { LoadingOverlay } from './components/LoadingOverlay'
import { HudField } from './components/HudField'

/** Compute left offset for elements that need to dodge all left-side panels. */
function computeLeftOffset(palette: boolean, inspector: boolean, findItem: boolean, replaceItems: boolean): string {
  // Panel widths: palette=320, inspector=400, find/replace=340, gap=6px each
  let px = 8 // base margin
  if (palette) px += 320 + 6
  if (inspector) px += 400 + 6
  if (findItem || replaceItems) px += 340 + 6
  return `${px}px`
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1, floor: 7, floorViewMode: 'single', showTransparentUpper: false })
  const [mapInfo, setMapInfo] = useState<{ tiles: number; towns: string[] } | null>(null)

  // Inspector panel tile position — set via "Browse Tile" or click-to-inspect.
  const [selectedTilePos, setSelectedTilePos] = useState<{ x: number; y: number; z: number } | null>(null)
  const [tileVersion, setTileVersion] = useState(0)
  const [itemRegistry, setItemRegistry] = useState<ItemRegistry | null>(null)
  const [creatureDb, setCreatureDb] = useState<CreatureDatabase | null>(null)
  const [appearancesData, setAppearancesData] = useState<AppearanceData | null>(null)
  const [initialSettings] = useState(() => loadSettings())
  const [showPalette, setShowPalette] = useState(initialSettings.showPalette)
  const [showLights, setShowLights] = useState(initialSettings.showLights)
  const [showZonePalette, setShowZonePalette] = useState(initialSettings.showZonePalette)
  const [showZoneOverlay, setShowZoneOverlay] = useState(initialSettings.showZoneOverlay)
  const [showHousePalette, setShowHousePalette] = useState(initialSettings.showHousePalette)
  const [showHouseOverlay, setShowHouseOverlay] = useState(initialSettings.showHouseOverlay)
  const [showMonsterPalette, setShowMonsterPalette] = useState(initialSettings.showMonsterPalette)
  const [showSpawnOverlay, setShowSpawnOverlay] = useState(initialSettings.showSpawnOverlay)
  const [activeSpawnIdx, setActiveSpawnIdx] = useState<number | null>(null)
  const [placingHouseExit, setPlacingHouseExit] = useState<number | null>(null)
  const placingHouseExitRef = useRef<number | null>(null)

  const [mapData, setMapData] = useState<OtbmMap | null>(null)
  const [sidecarsData, setSidecarsData] = useState<MapSidecars>(() => emptySidecars())
  const [rendererReady, setRendererReady] = useState<MapRenderer | null>(null)
  const [mutatorReady, setMutatorReady] = useState<MapMutator | null>(null)

  const [showGoToDialog, setShowGoToDialog] = useState(false)
  const [showFindItem, setShowFindItem] = useState(false)
  const [showReplaceItems, setShowReplaceItems] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showMapProperties, setShowMapProperties] = useState(false)
  const [showEditTowns, setShowEditTowns] = useState(false)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(initialSettings)
  const [brushRegistryState, setBrushRegistryState] = useState<BrushRegistry | null>(null)
  const [tilesets, setTilesets] = useState<ResolvedTileset[]>([])
  const [mapFilename, setMapFilename] = useState('map.otbm')

  const paletteRef = useRef<BrushPaletteHandle>(null)
  const editorSettingsRef = useRef(editorSettings)

  const [editingItem, setEditingItem] = useState<{ x: number; y: number; z: number; index: number } | null>(null)

  const handleRequestEditItem = useCallback((x: number, y: number, z: number, itemIndex: number) => {
    setEditingItem({ x, y, z, index: itemIndex })
  }, [])

  const tools = useEditorTools(rendererReady, mutatorReady, mapData, brushRegistryState, handleRequestEditItem, editorSettings.clickToInspect, editorSettingsRef)
  const toolsRef = useRef(tools)

  useEffect(() => {
    placingHouseExitRef.current = placingHouseExit
    editorSettingsRef.current = editorSettings
    toolsRef.current = tools
  })

  // ── Editor Init ────────────────────────────────────────────────────
  const { rendererRef, mutatorRef, storageRef } = useEditorInit(containerRef, {
    setLoadingStatus, setLoadingProgress, setLoading, setError,
    setAppearancesData, setItemRegistry, setCreatureDb, setMapInfo, setBrushRegistryState,
    setTilesets, setMapFilename, setMapData, setSidecarsData,
    setRendererReady, setMutatorReady,
    setCamera, setSelectedTilePos, setContextMenu: (menu) => setContextMenu(menu),
    setTileVersion, setPlacingHouseExit, placingHouseExitRef, toolsRef,
  })

  // ── Context Menu ───────────────────────────────────────────────────
  const navigatePaletteAndDraw = useCallback((selection: BrushSelection, primaryCategory: CategoryType) => {
    const location = findEntryInTilesets(tilesets, (entry) => {
      if (selection.mode === 'brush' && entry.type === 'brush') {
        return entry.brushName === selection.brushName && entry.brushType === selection.brushType
      }
      if (selection.mode === 'raw' && entry.type === 'item') {
        return entry.itemId === selection.itemId
      }
      return false
    }, primaryCategory)

    tools.setSelectedBrush(selection)
    if (tools.activeTool === 'select') tools.setActiveTool('draw')

    if (location) {
      paletteRef.current?.navigateTo(location.category, location.tilesetName)
    } else {
      paletteRef.current?.navigateTo('all', 'ALL')
    }

    setShowPalette(true)
    setEditorSettings(s => { const u = { ...s, showPalette: true }; saveSettings(u); return u })
  }, [tools, tilesets])

  const handleSelectAsRaw = useCallback((itemId: number) => {
    navigatePaletteAndDraw({ mode: 'raw', itemId }, 'items')
  }, [navigatePaletteAndDraw])

  const handleSelectAsBrush = useCallback((itemId: number) => {
    const registry = brushRegistryState

    let selection: BrushSelection
    let primaryCategory: CategoryType = 'raw'

    const ground = registry?.getBrushForItem(itemId)
    if (ground) {
      selection = { mode: 'brush', brushType: 'ground', brushName: ground.name }
      primaryCategory = 'terrain'
    } else {
      const wall = registry?.getWallBrushForItem(itemId)
      if (wall) {
        selection = { mode: 'brush', brushType: 'wall', brushName: wall.name }
        primaryCategory = 'terrain'
      } else {
        const carpet = registry?.getCarpetBrushForItem(itemId)
        if (carpet) {
          selection = { mode: 'brush', brushType: 'carpet', brushName: carpet.name }
          primaryCategory = 'terrain'
        } else {
          const table = registry?.getTableBrushForItem(itemId)
          if (table) {
            selection = { mode: 'brush', brushType: 'table', brushName: table.name }
            primaryCategory = 'terrain'
          } else {
            const doodad = registry?.getDoodadBrushForItem(itemId)
            if (doodad) {
              selection = { mode: 'brush', brushType: 'doodad', brushName: doodad.name }
              primaryCategory = 'doodad'
            } else {
              selection = { mode: 'raw', itemId }
              primaryCategory = 'items'
            }
          }
        }
      }
    }

    navigatePaletteAndDraw(selection, primaryCategory)
  }, [brushRegistryState, navigatePaletteAndDraw])

  const { contextMenuGroups, contextMenu, setContextMenu } = useContextMenu({
    toolsRef, mutatorReady, brushRegistryState, itemRegistry, appearancesData,
    rendererRef, handleSelectAsRaw, handleSelectAsBrush, setSelectedTilePos, setEditingItem,
  })

  // ── Save / Export / Import ─────────────────────────────────────────
  const { saveProgress, savePhase, handleSave, handleExportZones, handleImportZones, handleExportHouses, handleImportHouses, handleExportSpawns, handleImportSpawns } = useSaveExport({
    mapData, mapFilename, sidecarsData, setSidecarsData, storageRef,
  })

  // ── Auto-toggle overlay/palette when zone or house tool is active ───
  useToolAutoToggle(
    tools.activeTool, 'zone',
    { show: showZoneOverlay, setShow: setShowZoneOverlay, rendererSet: (v) => rendererRef.current?.setShowZoneOverlay(v), settingsKey: 'showZoneOverlay' },
    { show: showZonePalette, setShow: setShowZonePalette, settingsKey: 'showZonePalette' },
    setEditorSettings,
  )
  useToolAutoToggle(
    tools.activeTool, 'house',
    { show: showHouseOverlay, setShow: setShowHouseOverlay, rendererSet: (v) => rendererRef.current?.setShowHouseOverlay(v), settingsKey: 'showHouseOverlay' },
    { show: showHousePalette, setShow: setShowHousePalette, settingsKey: 'showHousePalette' },
    setEditorSettings,
  )
  useToolAutoToggle(
    tools.activeTool, 'monster',
    { show: showSpawnOverlay, setShow: setShowSpawnOverlay, rendererSet: (v) => rendererRef.current?.setShowSpawnOverlay(v), settingsKey: 'showSpawnOverlay' },
    { show: showMonsterPalette, setShow: setShowMonsterPalette, settingsKey: 'showMonsterPalette' },
    setEditorSettings,
  )

  useEffect(() => {
    if (rendererReady) {
      rendererReady.setHighlights(deriveHighlights(tools.selectedItems, mapData!))
    }
  }, [tools.selectedItems, rendererReady, mapData])

  useEffect(() => {
    rendererRef.current?.setActiveZone(tools.selectedZone)
  }, [tools.selectedZone, rendererRef])

  useEffect(() => {
    rendererRef.current?.setActiveHouse(tools.selectedHouse?.id ?? null)
  }, [tools.selectedHouse, rendererRef])

  // Sync spawns to renderer
  useEffect(() => {
    rendererRef.current?.setSpawns(sidecarsData.monsterSpawns)
  }, [sidecarsData.monsterSpawns, rendererRef])

  useEffect(() => {
    rendererRef.current?.setActiveSpawn(activeSpawnIdx)
  }, [activeSpawnIdx, rendererRef])

  useEffect(() => {
    rendererRef.current?.setShowSelectionBorder(editorSettings.selectionBorder)
  }, [editorSettings.selectionBorder, rendererRef])

  const handleFloorChange = useCallback((delta: number) => {
    const r = rendererRef.current
    if (!r) return
    r.setFloor(r.floor + delta)
  }, [rendererRef])

  const handleFloorViewMode = useCallback((mode: FloorViewMode) => {
    rendererRef.current?.setFloorViewMode(mode)
    setEditorSettings(s => { const u = { ...s, floorViewMode: mode }; saveSettings(u); return u })
  }, [rendererRef])

  const handleToggleTransparentUpper = useCallback(() => {
    if (rendererRef.current) {
      const next = !rendererRef.current.showTransparentUpper
      rendererRef.current.setShowTransparentUpper(next)
      setEditorSettings(s => { const u = { ...s, showTransparentUpper: next }; saveSettings(u); return u })
    }
  }, [rendererRef])

  const handleCloseInspector = useCallback(() => {
    setSelectedTilePos(null)
    rendererRef.current?.deselectTile()
    tools.setSelectedItems([])
  }, [tools, rendererRef])

  const handleItemSelectionChange = useCallback((items: typeof tools.selectedItems) => {
    tools.setSelectedItems(items)
    if (rendererReady) {
      rendererReady.setHighlights(deriveHighlights(items, mapData!))
    }
    if (items.length === 1) {
      setSelectedTilePos({ x: items[0].x, y: items[0].y, z: items[0].z })
    }
  }, [rendererReady, tools, mapData])

  const handleClosePalette = useCallback(() => {
    setShowPalette(false)
    setEditorSettings(s => { const u = { ...s, showPalette: false }; saveSettings(u); return u })
  }, [])

  const handleZoomIn = useCallback(() => { rendererRef.current?.zoomIn() }, [rendererRef])
  const handleZoomOut = useCallback(() => { rendererRef.current?.zoomOut() }, [rendererRef])
  const handleResetZoom = useCallback(() => { rendererRef.current?.resetZoom() }, [rendererRef])

  const handleSettingsChange = useCallback((next: EditorSettings) => {
    setEditorSettings(next)
    const r = rendererRef.current
    if (r) {
      r.setShowLights(next.showLights)
      r.setShowSelectionBorder(next.selectionBorder)
      r.setShowZoneOverlay(next.showZoneOverlay)
      r.setShowHouseOverlay(next.showHouseOverlay)
      r.setShowSpawnOverlay(next.showSpawnOverlay)
    }
    setShowPalette(next.showPalette)
    setShowLights(next.showLights)
    setShowZonePalette(next.showZonePalette)
    setShowZoneOverlay(next.showZoneOverlay)
    setShowHousePalette(next.showHousePalette)
    setShowHouseOverlay(next.showHouseOverlay)
    setShowMonsterPalette(next.showMonsterPalette)
    setShowSpawnOverlay(next.showSpawnOverlay)
    saveSettings(next)
  }, [rendererRef])

  const handleMapPropertiesApply = useCallback((patch: MapPropertiesPatch) => {
    setMapData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        description: patch.description,
        rawDescriptions: patch.description ? [patch.description] : [],
        width: patch.width,
        height: patch.height,
        version: patch.version,
        spawnFile: patch.spawnFile,
        houseFile: patch.houseFile,
      }
    })
  }, [])

  const handleEditTownsApply = useCallback((towns: OtbmTown[]) => {
    setMapData(prev => prev ? { ...prev, towns } : prev)
  }, [])

  const handleGoToPosition = useCallback((x: number, y: number, z: number) => {
    rendererRef.current?.setFloor(z)
    rendererRef.current?.centerOn(x, y)
    rendererRef.current?.pingTile(x, y, z)
  }, [rendererRef])

  // ── Keyboard Shortcuts ─────────────────────────────────────────────
  const { borderizeCurrentSelection, randomizeCurrentSelection } = useKeyboardShortcuts({
    toolsRef, mutatorRef, rendererRef,
    handleSave, handleFloorChange,
    showPalette, setShowPalette,
    showLights, setShowLights,
    showGoToDialog, setShowGoToDialog,
    showFindItem, setShowFindItem,
    showReplaceItems, setShowReplaceItems,
    showZonePalette,
    setEditorSettings,
    selectedTilePos, setSelectedTilePos,
    contextMenu, setContextMenu,
    placingHouseExit, setPlacingHouseExit,
  })

  // ── Item Properties Modal ──────────────────────────────────────────
  const handleApplyProperties = useCallback((props: Partial<OtbmItem>) => {
    if (!editingItem || !mapData || !mutatorReady) return
    const { x, y, z, index } = editingItem
    const tile = mapData.tiles.get(`${x},${y},${z}`)
    if (!tile || !tile.items[index]) return

    const items = [...tile.items]
    items[index] = applyItemProperties(items[index], props)

    mutatorReady.setTileItems(x, y, z, items)
    setEditingItem(null)
  }, [editingItem, mapData, mutatorReady])

  // Derive the item being edited (for the properties modal)
  const editingItemData = useMemo(() => {
    if (!editingItem || !mapData) return null
    const tile = mapData.tiles.get(`${editingItem.x},${editingItem.y},${editingItem.z}`)
    return tile?.items[editingItem.index] ?? null
  }, [editingItem, mapData])

  // Derive house name for the currently inspected tile
  const inspectedHouseName = (() => {
    if (!selectedTilePos || !mapData) return null
    const tile = mapData.tiles.get(`${selectedTilePos.x},${selectedTilePos.y},${selectedTilePos.z}`)
    if (!tile?.houseId) return null
    return sidecarsData.houses.find(h => h.id === tile.houseId)?.name ?? null
  })()

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-void">
        <div className="panel max-w-[400px] p-10 text-center">
          <div className="mx-auto mb-6 flex h-[40px] w-[40px] items-center justify-center rounded-md bg-danger-subtle text-[20px]">!</div>
          <div className="mb-3 font-display text-lg font-semibold text-danger">Failed to load</div>
          <div className="break-words font-mono text-sm text-fg-muted">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Map viewport */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Loading overlay */}
      {loading && <LoadingOverlay status={loadingStatus} progress={loadingProgress} />}

      {/* Save toast */}
      {saveProgress != null && <SaveToast progress={saveProgress} phase={savePhase} />}

      {/* Toolbar — top center */}
      {!loading && appearancesData && (
        <Toolbar
          activeTool={tools.activeTool}
          onToolChange={tools.setActiveTool}
          canUndo={tools.canUndo}
          canRedo={tools.canRedo}
          onUndo={tools.undo}
          onRedo={tools.redo}
          selectedBrush={tools.selectedBrush}
          brushRegistry={brushRegistryState}
          appearances={appearancesData}
          registry={itemRegistry}
          onCut={tools.cut}
          onCopy={tools.copy}
          onPaste={tools.paste}
          onDelete={tools.deleteSelection}
          canPaste={tools.canPaste}
          hasSelection={tools.hasSelection}
          onGoToPosition={() => setShowGoToDialog(true)}
          onFindItem={() => { setShowFindItem(true); setShowReplaceItems(false) }}
          onReplaceItems={() => { setShowReplaceItems(true); setShowFindItem(false) }}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenMapProperties={() => setShowMapProperties(true)}
          onOpenEditTowns={() => setShowEditTowns(true)}
          hasMap={!!mapData}
          showPalette={showPalette}
          onTogglePalette={() => {
            setShowPalette(prev => {
              const next = !prev
              setEditorSettings(s => { const u = { ...s, showPalette: next }; saveSettings(u); return u })
              return next
            })
          }}
          showLights={showLights}
          onToggleLights={() => {
            setShowLights(prev => {
              const next = !prev
              rendererRef.current?.setShowLights(next)
              setEditorSettings(s => { const u = { ...s, showLights: next }; saveSettings(u); return u })
              return next
            })
          }}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onBorderizeSelection={borderizeCurrentSelection}
          onRandomizeSelection={randomizeCurrentSelection}
          brushSize={tools.brushSize}
          onBrushSizeChange={tools.setBrushSize}
          brushShape={tools.brushShape}
          onBrushShapeChange={tools.setBrushShape}
          activeDoorType={tools.activeDoorType}
          onDoorTypeChange={tools.setActiveDoorType}
          onSave={handleSave}
          canSave={!!mapData}
          showZonePalette={showZonePalette}
          onToggleZonePalette={() => {
            setShowZonePalette(prev => {
              const next = !prev
              setEditorSettings(s => { const u = { ...s, showZonePalette: next }; saveSettings(u); return u })
              return next
            })
          }}
          showZoneOverlay={showZoneOverlay}
          onToggleZoneOverlay={() => {
            setShowZoneOverlay(prev => {
              const next = !prev
              rendererRef.current?.setShowZoneOverlay(next)
              setEditorSettings(s => { const u = { ...s, showZoneOverlay: next }; saveSettings(u); return u })
              return next
            })
          }}
          selectedZone={tools.selectedZone}
          onZoneSelect={(zone) => {
            tools.setSelectedZone(zone)
            if (tools.activeTool !== 'zone') tools.setActiveTool('zone')
          }}
          onExportZones={handleExportZones}
          onImportZones={handleImportZones}
          showHousePalette={showHousePalette}
          onToggleHousePalette={() => {
            setShowHousePalette(prev => {
              const next = !prev
              setEditorSettings(s => { const u = { ...s, showHousePalette: next }; saveSettings(u); return u })
              return next
            })
          }}
          showHouseOverlay={showHouseOverlay}
          onToggleHouseOverlay={() => {
            setShowHouseOverlay(prev => {
              const next = !prev
              rendererRef.current?.setShowHouseOverlay(next)
              setEditorSettings(s => { const u = { ...s, showHouseOverlay: next }; saveSettings(u); return u })
              return next
            })
          }}
          onExportHouses={handleExportHouses}
          onImportHouses={handleImportHouses}
          showMonsterPalette={showMonsterPalette}
          onToggleMonsterPalette={() => {
            setShowMonsterPalette(prev => {
              const next = !prev
              setEditorSettings(s => { const u = { ...s, showMonsterPalette: next }; saveSettings(u); return u })
              return next
            })
          }}
          showSpawnOverlay={showSpawnOverlay}
          onToggleSpawnOverlay={() => {
            setShowSpawnOverlay(prev => {
              const next = !prev
              rendererRef.current?.setShowSpawnOverlay(next)
              setEditorSettings(s => { const u = { ...s, showSpawnOverlay: next }; saveSettings(u); return u })
              return next
            })
          }}
          onExportSpawns={handleExportSpawns}
          onImportSpawns={handleImportSpawns}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          groups={contextMenuGroups}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Go to position dialog */}
      {showGoToDialog && (
        <GoToPositionDialog
          currentX={camera.x}
          currentY={camera.y}
          currentZ={camera.floor}
          onNavigate={handleGoToPosition}
          onClose={() => setShowGoToDialog(false)}
        />
      )}

      {/* Find Item dialog */}
      {showFindItem && mapData && itemRegistry && appearancesData && (
        <FindItemDialog
          mapData={mapData}
          registry={itemRegistry}
          appearances={appearancesData}
          hasSelection={tools.hasSelection}
          selectedItems={tools.selectedItems}
          onNavigate={handleGoToPosition}
          onClose={() => setShowFindItem(false)}
          left={computeLeftOffset(showPalette, !!selectedTilePos, false, false)}
        />
      )}

      {/* Replace Items dialog */}
      {showReplaceItems && mapData && mutatorReady && itemRegistry && appearancesData && (
        <ReplaceItemsDialog
          mapData={mapData}
          mutator={mutatorReady}
          registry={itemRegistry}
          appearances={appearancesData}
          hasSelection={tools.hasSelection}
          selectedItems={tools.selectedItems}
          onClose={() => setShowReplaceItems(false)}
          left={computeLeftOffset(showPalette, !!selectedTilePos, false, false)}
        />
      )}

      {/* Settings modal */}
      {showSettingsModal && (
        <SettingsModal
          settings={editorSettings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Map properties modal */}
      {showMapProperties && mapData && (
        <MapPropertiesModal
          map={mapData}
          onApply={handleMapPropertiesApply}
          onClose={() => setShowMapProperties(false)}
        />
      )}

      {/* Edit towns modal */}
      {showEditTowns && mapData && (
        <EditTownsModal
          towns={mapData.towns}
          houses={sidecarsData.houses}
          onApply={handleEditTownsApply}
          onClose={() => setShowEditTowns(false)}
          onNavigate={handleGoToPosition}
        />
      )}

      {/* Brush palette — left side */}
      {!loading && showPalette && itemRegistry && appearancesData && (
        <BrushPalette
          ref={paletteRef}
          tilesets={tilesets}
          registry={itemRegistry}
          appearances={appearancesData}
          onClose={handleClosePalette}
          selectedBrush={tools.selectedBrush}
          onBrushSelect={(sel) => {
            tools.setSelectedBrush(sel)
            if (tools.activeTool === 'select') tools.setActiveTool('draw')
          }}
        />
      )}

      {/* Zone palette — right side */}
      {!loading && showZonePalette && (
        <ZonePalette
          sidecars={sidecarsData}
          onSidecarsChange={setSidecarsData}
          mapData={mapData}
          selectedZone={tools.selectedZone}
          onZoneSelect={(zone) => {
            tools.setSelectedZone(zone)
            if (tools.activeTool !== 'zone') tools.setActiveTool('zone')
          }}
          onZoneDelete={(zoneId) => {
            if (!mapData) return
            scrubZoneFromTiles(mapData.tiles, zoneId)
            rendererRef.current?.markZoneOverlayDirty()
            if (tools.selectedZone?.type === 'zone' && tools.selectedZone.zoneId === zoneId) {
              const fallback = ZONE_FLAG_DEFS[0]
              tools.setSelectedZone({ type: 'flag', flag: fallback.flag, label: fallback.label })
            }
          }}
          onNavigateToZone={(zoneId) => {
            if (!mapData) return
            for (const [key, tile] of mapData.tiles) {
              if (tile.zones?.includes(zoneId)) {
                const [x, y, z] = key.split(',').map(Number)
                rendererRef.current?.setFloor(z)
                rendererRef.current?.centerOn(x, y)
                rendererRef.current?.pingTile(x, y, z)
                break
              }
            }
          }}
          onExportZones={handleExportZones}
          onImportZones={handleImportZones}
          onClose={() => {
            setShowZonePalette(false)
            setEditorSettings(s => { const u = { ...s, showZonePalette: false }; saveSettings(u); return u })
          }}
        />
      )}

      {/* House palette — right side */}
      {!loading && showHousePalette && (
        <HousePalette
          className={showZonePalette ? 'right-[336px]' : undefined}
          sidecars={sidecarsData}
          onSidecarsChange={setSidecarsData}
          mapData={mapData}
          selectedHouse={tools.selectedHouse}
          onHouseSelect={(house) => {
            tools.setSelectedHouse(house)
            if (tools.activeTool !== 'house') tools.setActiveTool('house')
          }}
          onHouseDelete={(houseId) => {
            if (!mapData) return
            scrubHouseFromTiles(mapData.tiles, houseId)
            rendererRef.current?.markHouseOverlayDirty()
            if (tools.selectedHouse?.id === houseId) {
              tools.setSelectedHouse(null)
            }
          }}
          onNavigateToHouse={(houseId) => {
            if (!mapData) return
            for (const tile of mapData.tiles.values()) {
              if (tile.houseId === houseId) {
                rendererRef.current?.setFloor(tile.z)
                rendererRef.current?.centerOn(tile.x, tile.y)
                rendererRef.current?.pingTile(tile.x, tile.y, tile.z)
                break
              }
            }
          }}
          onSetHouseExit={(houseId) => {
            setPlacingHouseExit(houseId)
          }}
          onExportHouses={handleExportHouses}
          onImportHouses={handleImportHouses}
          onClose={() => {
            setShowHousePalette(false)
            setEditorSettings(s => { const u = { ...s, showHousePalette: false }; saveSettings(u); return u })
          }}
        />
      )}

      {/* Monster palette — right side */}
      {!loading && showMonsterPalette && appearancesData && (
        <MonsterPalette
          className={clsx(
            showZonePalette && showHousePalette ? 'right-[622px]' :
            showZonePalette || showHousePalette ? 'right-[336px]' : undefined,
          )}
          sidecars={sidecarsData}
          creatureDb={creatureDb}
          appearances={appearancesData}
          selectedMonster={tools.selectedMonster}
          onMonsterSelect={(monster) => {
            tools.setSelectedMonster(monster)
            if (tools.activeTool !== 'monster') tools.setActiveTool('monster')
          }}
          activeSpawnIdx={activeSpawnIdx}
          onActiveSpawnChange={setActiveSpawnIdx}
          onDeleteSpawn={(spawnIdx) => {
            mutatorReady?.deleteSpawn(spawnIdx)
            if (activeSpawnIdx === spawnIdx) setActiveSpawnIdx(null)
          }}
          onDeleteCreature={(spawnIdx, creatureIdx) => {
            mutatorReady?.deleteCreature(spawnIdx, creatureIdx)
          }}
          onModifySpawnRadius={(spawnIdx, radius) => {
            mutatorReady?.modifySpawnRadius(spawnIdx, radius)
          }}
          onNavigateToSpawn={(spawn) => {
            rendererRef.current?.setFloor(spawn.centerZ)
            rendererRef.current?.centerOn(spawn.centerX, spawn.centerY)
            rendererRef.current?.pingTile(spawn.centerX, spawn.centerY, spawn.centerZ)
          }}
          onExportSpawns={handleExportSpawns}
          onImportSpawns={handleImportSpawns}
          onClose={() => {
            setShowMonsterPalette(false)
            setEditorSettings(s => { const u = { ...s, showMonsterPalette: false }; saveSettings(u); return u })
          }}
        />
      )}

      {/* House exit placement mode indicator */}
      {placingHouseExit != null && (
        <div className="panel absolute bottom-[80px] left-1/2 z-20 -translate-x-1/2 px-6 py-3 pointer-events-auto select-none">
          <span className="font-ui text-sm text-fg">
            Click a tile to set house exit for house #{placingHouseExit}. Press <span className="kbd">Esc</span> to cancel.
          </span>
        </div>
      )}

      {/* Browse Tile panel — left side (offset right when palette is open) */}
      {!loading && selectedTilePos && itemRegistry && appearancesData && mapData && mutatorReady && (
        <Inspector
          tilePos={selectedTilePos}
          mapData={mapData}
          tileVersion={tileVersion}
          registry={itemRegistry}
          appearances={appearancesData}
          mutator={mutatorReady}
          onClose={handleCloseInspector}
          onSelectAsBrush={handleSelectAsBrush}
          selectedItems={tools.selectedItems}
          onItemSelectionChange={handleItemSelectionChange}
          offset={showPalette}
          onEditItem={handleRequestEditItem}
          onDragToMap={(itemId) => { if (rendererRef.current) rendererRef.current.dragPreviewItemId = itemId }}
          onDragToMapEnd={() => { if (rendererRef.current) { rendererRef.current.dragPreviewItemId = null; rendererRef.current.clearGhostPreview() } }}
          houseName={inspectedHouseName}
        />
      )}

      {/* Item Properties modal */}
      {editingItemData && mapData && itemRegistry && appearancesData && (
        <ItemPropertiesModal
          item={editingItemData}
          appearances={appearancesData}
          registry={itemRegistry}
          mapVersion={mapData.version}
          onApply={handleApplyProperties}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {/* HUD — bottom left status bar */}
      {!loading && (
        <div
          className="panel absolute bottom-4 z-10 flex h-[48px] items-center gap-6 px-5 pointer-events-auto select-none transition-[left] duration-[180ms] ease-out"
          style={{ left: computeLeftOffset(showPalette, !!selectedTilePos, showFindItem, showReplaceItems) }}
        >
          <HudField label="POS" value={tools.cursorPos ? `${tools.cursorPos.x}, ${tools.cursorPos.y}, ${tools.cursorPos.z}` : '—'} />
          <div className="h-[16px] w-px shrink-0 bg-border-subtle" />
          <HudField label="ZOOM" value={`${camera.zoom.toFixed(2)}x`} />
          {mapInfo && (
            <>
              <div className="h-[16px] w-px shrink-0 bg-border-subtle" />
              <HudField label="TILES" value={mapInfo.tiles.toLocaleString()} />
            </>
          )}
        </div>
      )}

      {/* Floor selector — right side */}
      {!loading && (
        <FloorSelector
          floor={camera.floor}
          floorViewMode={camera.floorViewMode}
          showTransparentUpper={camera.showTransparentUpper}
          onFloorChange={handleFloorChange}
          onFloorViewMode={handleFloorViewMode}
          onToggleTransparentUpper={handleToggleTransparentUpper}
        />
      )}
    </div>
  )
}

export default App
