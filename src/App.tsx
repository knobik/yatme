import { useEffect, useRef, useState, useCallback } from 'react'
import { Application } from 'pixi.js'
import type { AppearanceData } from './lib/appearances'
import type { OtbmMap, OtbmTile } from './lib/otbm'
import { MapRenderer, type FloorViewMode } from './lib/MapRenderer'
import { MapMutator } from './lib/MapMutator'
import type { ItemRegistry } from './lib/items'
import { useEditorTools, deriveHighlights } from './hooks/useEditorTools'
import type { BrushRegistry } from './lib/brushes/BrushRegistry'
import { Inspector } from './components/Inspector'
import { BrushPalette, type BrushPaletteHandle } from './components/BrushPalette'
import type { ResolvedTileset } from './lib/tilesets/TilesetTypes'
import { Toolbar } from './components/Toolbar'
import { ContextMenu, type ContextMenuGroup, type ContextMenuAction } from './components/ContextMenu'
import { GoToPositionDialog } from './components/GoToPositionDialog'
import { SettingsModal } from './components/SettingsModal'
import { loadSettings, saveSettings, type EditorSettings } from './lib/EditorSettings'
import { getItemDisplayName } from './lib/items'
import { loadAssets } from './lib/initPipeline'
import { setupEditor } from './lib/setupEditor'
import { findEntryInTilesets } from './lib/tilesets/TilesetLoader'
import type { BrushSelection } from './hooks/tools/types'
import type { CategoryType } from './lib/tilesets/TilesetTypes'

interface CameraState {
  x: number
  y: number
  zoom: number
  floor: number
  floorViewMode: FloorViewMode
  showTransparentUpper: boolean
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<MapRenderer | null>(null)
  const mutatorRef = useRef<MapMutator | null>(null)
  const appRef = useRef<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1, floor: 7, floorViewMode: 'single', showTransparentUpper: false })
  const [mapInfo, setMapInfo] = useState<{ tiles: number; towns: string[] } | null>(null)

  // Phase 6 state
  const [selectedTilePos, setSelectedTilePos] = useState<{ x: number; y: number; z: number } | null>(null)
  const [tileVersion, setTileVersion] = useState(0)
  const [itemRegistry, setItemRegistry] = useState<ItemRegistry | null>(null)
  const [appearancesData, setAppearancesData] = useState<AppearanceData | null>(null)
  const [showPalette, setShowPalette] = useState(() => loadSettings().showPalette)
  const [showLights, setShowLights] = useState(() => loadSettings().showLights)

  // Phase 7 state
  const [mapData, setMapData] = useState<OtbmMap | null>(null)
  const [rendererReady, setRendererReady] = useState<MapRenderer | null>(null)
  const [mutatorReady, setMutatorReady] = useState<MapMutator | null>(null)

  const [showGoToDialog, setShowGoToDialog] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => loadSettings())
  const [brushRegistryState, setBrushRegistryState] = useState<BrushRegistry | null>(null)
  const [tilesets, setTilesets] = useState<ResolvedTileset[]>([])

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number
    tilePos: { x: number; y: number; z: number }
    tile: OtbmTile | null
  } | null>(null)

  const paletteRef = useRef<BrushPaletteHandle>(null)

  const [editItemIndex, setEditItemIndex] = useState<number | null>(null)

  const handleRequestEditItem = useCallback((_x: number, _y: number, _z: number, itemIndex: number) => {
    setEditItemIndex(itemIndex)
  }, [])

  const tools = useEditorTools(rendererReady, mutatorReady, mapData, brushRegistryState, handleRequestEditItem, editorSettings.clickToInspect)
  const toolsRef = useRef(tools)
  toolsRef.current = tools

  const handleFloorChange = useCallback((delta: number) => {
    if (rendererRef.current) {
      rendererRef.current.setFloor(rendererRef.current.floor + delta)
    }
  }, [])

  const handleFloorViewMode = useCallback((mode: FloorViewMode) => {
    if (rendererRef.current) {
      rendererRef.current.setFloorViewMode(mode)
    }
    setEditorSettings(s => { const u = { ...s, floorViewMode: mode }; saveSettings(u); return u })
  }, [])

  const handleToggleTransparentUpper = useCallback(() => {
    if (rendererRef.current) {
      const next = !rendererRef.current.showTransparentUpper
      rendererRef.current.setShowTransparentUpper(next)
      setEditorSettings(s => { const u = { ...s, showTransparentUpper: next }; saveSettings(u); return u })
    }
  }, [])

  const handleCloseInspector = useCallback(() => {
    setSelectedTilePos(null)
    rendererRef.current?.deselectTile()
  }, [])

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
    tools.setActiveTool('draw')

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

    // Determine what brush this item belongs to and build a selection
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

  const handleItemSelectionChange = useCallback((items: typeof tools.selectedItems) => {
    tools.setSelectedItems(items)
    if (items.length === 0) {
      rendererRef.current?.clearItemHighlight()
    } else if (mapData) {
      rendererRef.current?.setHighlights(deriveHighlights(items, mapData))
    }
  }, [tools, mapData])

  const handleClosePalette = useCallback(() => {
    setShowPalette(false)
  }, [])

  const handleZoomIn = useCallback(() => {
    rendererRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    rendererRef.current?.zoomOut()
  }, [])

  const handleResetZoom = useCallback(() => {
    rendererRef.current?.resetZoom()
  }, [])

  const handleSettingsChange = useCallback((next: EditorSettings) => {
    setEditorSettings(next)
    const r = rendererRef.current
    if (r) {
      r.setFloorViewMode(next.floorViewMode)
      r.setShowTransparentUpper(next.showTransparentUpper)
      r.setShowLights(next.showLights)
      r.setShowSelectionBorder(next.selectionBorder)
    }
    setShowPalette(next.showPalette)
    setShowLights(next.showLights)
  }, [])

  const handleGoToPosition = useCallback((x: number, y: number, z: number) => {
    if (!rendererRef.current) return
    rendererRef.current.setFloor(z)
    rendererRef.current.centerOn(x, y)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const signal = { destroyed: false }
    let appInstance: Application | null = null

    async function init() {
      const result = await loadAssets(container!, {
        setStatus: setLoadingStatus,
        setProgress: setLoadingProgress,
      }, signal)
      if (!result) return

      const { app, appearances, mapData, registry, brushRegistry, tilesets } = result
      appInstance = app
      appRef.current = app

      // Update React state with loaded data
      setAppearancesData(appearances)
      setItemRegistry(registry)
      setMapInfo({
        tiles: mapData.tiles.size,
        towns: mapData.towns.map((t) => t.name),
      })
      if (brushRegistry) setBrushRegistryState(brushRegistry)
      setTilesets(tilesets)

      // Build renderer + mutator
      const { renderer, mutator } = setupEditor(app, appearances, mapData, brushRegistry)
      rendererRef.current = renderer
      mutatorRef.current = mutator

      // Wire mutator → React callbacks
      mutator.onTileChanged = (x, y, z) => {
        const tile = mapData.tiles.get(`${x},${y},${z}`)
        if (tile) renderer.updateChunkIndex(tile)
        setTileVersion(v => v + 1)
      }

      // Wire renderer → React callbacks
      renderer.onCameraChange = (x, y, zoom, floor, floorViewMode, showTransparentUpper) => {
        setCamera({ x, y, zoom, floor, floorViewMode, showTransparentUpper })
        setContextMenu(null)
      }

      renderer.onTileClick = (tile, _worldX, _worldY) => {
        if (tile) {
          setSelectedTilePos({ x: tile.x, y: tile.y, z: tile.z })
        } else {
          setSelectedTilePos(null)
          toolsRef.current.setSelectedItems([])
        }
      }

      renderer.onTileContextMenu = (pos, tile, screenX, screenY) => {
        if (toolsRef.current.isPasting) {
          toolsRef.current.cancelPaste()
          return
        }
        const currentTool = toolsRef.current.activeTool
        if (currentTool === 'draw' || currentTool === 'erase') {
          toolsRef.current.setActiveTool('select')
        }
        setContextMenu({ x: screenX, y: screenY, tilePos: pos, tile })
      }

      renderer.onItemDrop = (pos, itemId) => {
        mutator.addItem(pos.x, pos.y, pos.z, { id: itemId })
      }

      setCamera({
        x: renderer.worldX,
        y: renderer.worldY,
        zoom: renderer.zoom,
        floor: renderer.floor,
        floorViewMode: renderer.floorViewMode,
        showTransparentUpper: renderer.showTransparentUpper,
      })

      // Restore saved settings
      const savedSettings = loadSettings()
      renderer.setFloorViewMode(savedSettings.floorViewMode)
      renderer.setShowTransparentUpper(savedSettings.showTransparentUpper)
      renderer.setShowLights(savedSettings.showLights)
      renderer.setShowSelectionBorder(savedSettings.selectionBorder)

      setLoadingProgress(1)
      setMapData(mapData)
      setRendererReady(renderer)
      setMutatorReady(mutator)
      setLoading(false)
    }

    init().catch((e) => {
      if (!signal.destroyed) setError(e.message)
      setLoading(false)
    })

    return () => {
      signal.destroyed = true
      rendererRef.current?.destroy()
      rendererRef.current = null
      if (appInstance) {
        appInstance.destroy(true)
      }
      appRef.current = null
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          toolsRef.current.undo()
          return
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z')) {
          e.preventDefault()
          toolsRef.current.redo()
          return
        }
        if (e.key === 'c') {
          e.preventDefault()
          toolsRef.current.copy()
          return
        }
        if (e.key === 'x') {
          e.preventDefault()
          toolsRef.current.cut()
          return
        }
        if (e.key === 'v') {
          e.preventDefault()
          toolsRef.current.paste()
          return
        }
        if (e.key === 'g') {
          e.preventDefault()
          setShowGoToDialog(true)
          return
        }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          rendererRef.current?.zoomIn()
          return
        }
        if (e.key === '-') {
          e.preventDefault()
          rendererRef.current?.zoomOut()
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          rendererRef.current?.resetZoom()
          return
        }
        return
      }

      if (e.key === 'PageUp') {
        e.preventDefault()
        handleFloorChange(-1)
      } else if (e.key === 'PageDown') {
        e.preventDefault()
        handleFloorChange(1)
      } else if (e.key === 'Delete') {
        e.preventDefault()
        toolsRef.current.deleteSelection()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (toolsRef.current.isPasting) {
          toolsRef.current.cancelPaste()
        } else if (showGoToDialog) {
          setShowGoToDialog(false)
        } else if (contextMenu) {
          setContextMenu(null)
        } else if (showPalette) {
          setShowPalette(false)
        } else if (selectedTilePos) {
          setSelectedTilePos(null)
          rendererRef.current?.deselectTile()
          toolsRef.current.setSelectedItems([])
          toolsRef.current.selectTiles([])
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setShowPalette(prev => {
          const next = !prev
          setEditorSettings(s => { const u = { ...s, showPalette: next }; saveSettings(u); return u })
          return next
        })
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setShowLights(prev => {
          const next = !prev
          rendererRef.current?.setShowLights(next)
          setEditorSettings(s => { const u = { ...s, showLights: next }; saveSettings(u); return u })
          return next
        })
      } else if (e.key === 's' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('select')
      } else if (e.key === 'd' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('draw')
      } else if (e.key === 'e' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('erase')
      } else if (e.key === 'r' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('door')
      } else if (e.key === ']') {
        e.preventDefault()
        const cur = toolsRef.current.brushSize
        if (cur < 6) toolsRef.current.setBrushSize(cur + 1)
      } else if (e.key === '[') {
        e.preventDefault()
        const cur = toolsRef.current.brushSize
        if (cur > 0) toolsRef.current.setBrushSize(cur - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleFloorChange, showPalette, selectedTilePos, contextMenu, showGoToDialog])

  function buildContextMenuGroups(): ContextMenuGroup[] {
    if (!contextMenu) return []
    const { tilePos, tile } = contextMenu
    const renderer = rendererRef.current
    const currentTools = toolsRef.current

    const isInSelection = currentTools.selectedItems.some(
      i => i.x === tilePos.x && i.y === tilePos.y && i.z === tilePos.z
    )

    const clipboardGroup: ContextMenuGroup = {
      items: [
        {
          label: 'Copy',
          shortcut: 'Ctrl+C',
          disabled: !tile,
          onClick: () => {
            if (!isInSelection) currentTools.selectTiles([tilePos])
            currentTools.copy()
          },
        },
        {
          label: 'Cut',
          shortcut: 'Ctrl+X',
          disabled: !tile,
          onClick: () => {
            if (!isInSelection) currentTools.selectTiles([tilePos])
            currentTools.cut()
          },
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          disabled: !currentTools.clipboard,
          onClick: () => {
            currentTools.selectTiles([tilePos])
            currentTools.paste()
          },
        },
        {
          label: 'Delete',
          shortcut: 'Del',
          disabled: !tile,
          onClick: () => {
            if (!isInSelection) currentTools.selectTiles([tilePos])
            currentTools.deleteSelection()
          },
        },
      ],
    }

    const positionGroup: ContextMenuGroup = {
      items: [
        {
          label: 'Copy Position',
          onClick: () => {
            navigator.clipboard.writeText(`{x=${tilePos.x}, y=${tilePos.y}, z=${tilePos.z}}`)
          },
        },
        ...(tile
          ? [
              {
                label: 'Browse Tile',
                onClick: () => {
                  setSelectedTilePos({ x: tilePos.x, y: tilePos.y, z: tilePos.z })
                },
              },
              ...(tile.items && tile.items.length > 0
                ? [{
                    label: 'Properties',
                    onClick: () => {
                      setSelectedTilePos({ x: tilePos.x, y: tilePos.y, z: tilePos.z })
                      setEditItemIndex(tile.items!.length - 1)
                    },
                  }]
                : []),
            ]
          : []),
      ],
    }

    const topItem = tile?.items?.[tile.items.length - 1]
    const itemInfoGroup: ContextMenuGroup = {
      items: topItem && itemRegistry && appearancesData
        ? [
            {
              label: 'Copy Top Item ID',
              onClick: () => {
                navigator.clipboard.writeText(String(topItem.id))
              },
            },
            {
              label: 'Copy Top Item Name',
              onClick: () => {
                navigator.clipboard.writeText(
                  getItemDisplayName(topItem.id, itemRegistry!, appearancesData!),
                )
              },
            },
          ]
        : [],
    }

    const doorGroup: ContextMenuGroup = {
      items: topItem && brushRegistryState?.isDoorItem(topItem.id)
        ? [{
            label: brushRegistryState.getDoorInfo(topItem.id)?.open ? 'Close Door' : 'Open Door',
            onClick: () => {
              if (!mutatorReady || !brushRegistryState || !tile) return
              const idx = tile.items.length - 1
              mutatorReady.switchDoorItem(tilePos.x, tilePos.y, tilePos.z, idx)
            },
          }]
        : [],
    }

    // Brush selection group — "Select RAW" for top item, "Select Ground Brush" for ground
    const brushSelectItems: ContextMenuAction[] = []
    if (topItem) {
      brushSelectItems.push({
        label: 'Select RAW',
        onClick: () => handleSelectAsRaw(topItem.id),
      })
    }
    // Find ground item (first item with bank/ground flag) and check if it has a ground brush
    const groundItem = tile?.items?.find(i => {
      const app = appearancesData?.objects.get(i.id)
      return !!app?.flags?.bank
    })
    if (groundItem && brushRegistryState?.getBrushForItem(groundItem.id)) {
      brushSelectItems.push({
        label: 'Select Ground Brush',
        onClick: () => handleSelectAsBrush(groundItem.id),
      })
    }
    const brushSelectGroup: ContextMenuGroup = { items: brushSelectItems }

    const teleportItem = tile?.items?.find(i => i.teleportDestination)
    const dest = teleportItem?.teleportDestination
    const teleportGroup: ContextMenuGroup = {
      items: dest && renderer
        ? [
            {
              label: 'Go to Destination',
              onClick: () => {
                renderer!.setFloor(dest.z)
                renderer!.centerOn(dest.x, dest.y)
              },
            },
            {
              label: 'Copy Destination',
              onClick: () => {
                navigator.clipboard.writeText(`{x=${dest.x}, y=${dest.y}, z=${dest.z}}`)
              },
            },
          ]
        : [],
    }

    return [clipboardGroup, positionGroup, itemInfoGroup, brushSelectGroup, doorGroup, teleportGroup]
  }

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
          canPaste={!!tools.clipboard}
          hasSelection={tools.hasSelection}
          onGoToPosition={() => setShowGoToDialog(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
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
          brushSize={tools.brushSize}
          onBrushSizeChange={tools.setBrushSize}
          brushShape={tools.brushShape}
          onBrushShapeChange={tools.setBrushShape}
          activeDoorType={tools.activeDoorType}
          onDoorTypeChange={tools.setActiveDoorType}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          groups={buildContextMenuGroups()}
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

      {/* Settings modal */}
      {showSettingsModal && (
        <SettingsModal
          settings={editorSettings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettingsModal(false)}
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
            tools.setActiveTool('draw')
          }}
        />
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
          initialEditIndex={editItemIndex}
          onEditIndexConsumed={() => setEditItemIndex(null)}
        />
      )}

      {/* HUD — bottom left status bar */}
      {!loading && (
        <div
          className="panel absolute bottom-4 z-10 flex h-[48px] items-center gap-6 px-5 pointer-events-auto select-none transition-[left] duration-[180ms] ease-out"
          style={{
            left: showPalette && selectedTilePos
              ? 'calc(8px + 320px + 6px + 400px + 6px)'
              : showPalette
                ? 'calc(8px + 320px + 6px)'
                : selectedTilePos
                  ? 'calc(8px + 400px + 6px)'
                  : '8px',
          }}
        >
          <HudField label="POS" value={`${camera.x}, ${camera.y}`} />
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
        <div className="panel absolute top-1/2 right-4 z-10 flex -translate-y-1/2 flex-col items-center gap-1 p-3">
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={() => handleFloorChange(-1)}
            title="Floor up (PageUp)"
          >
            <svg width="16" height="10" viewBox="0 0 12 8" fill="none">
              <path d="M1 6.5L6 1.5L11 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <span className="value text-accent-fg text-2xl font-medium leading-none py-1">
            {camera.floor}
          </span>

          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={() => handleFloorChange(1)}
            title="Floor down (PageDown)"
          >
            <svg width="16" height="10" viewBox="0 0 12 8" fill="none">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="mx-1 my-1 h-px w-full bg-border-subtle" />

          {/* Floor view mode: single / current+below / all */}
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={() => handleFloorViewMode('single')}
            title="Single floor"
            style={{ color: camera.floorViewMode === 'single' ? 'var(--color-accent)' : undefined }}
          >
            <svg width="18" height="13" viewBox="0 0 14 10" fill="none">
              <path d="M7 2L1 5L7 8L13 5L7 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={() => handleFloorViewMode('current-below')}
            title="Current floor + below"
            style={{ color: camera.floorViewMode === 'current-below' ? 'var(--color-accent)' : undefined }}
          >
            <svg width="18" height="16" viewBox="0 0 14 12" fill="none">
              <path d="M7 1L1 4L7 7L13 4L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M1 7.5L7 10.5L13 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={() => handleFloorViewMode('all')}
            title="All floors"
            style={{ color: camera.floorViewMode === 'all' ? 'var(--color-accent)' : undefined }}
          >
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L1 4L7 7L13 4L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M1 7L7 10L13 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 10L7 13L13 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="mx-1 my-1 h-px w-full bg-border-subtle" />

          {/* Transparent upper floor toggle */}
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={handleToggleTransparentUpper}
            title="Show transparent upper floor"
            style={{ color: camera.showTransparentUpper ? 'var(--color-accent)' : undefined }}
          >
            <svg width="18" height="13" viewBox="0 0 14 10" fill="none">
              <path d="M1 5C1 5 3.5 1 7 1C10.5 1 13 5 13 5C13 5 10.5 9 7 9C3.5 9 1 5 1 5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <circle cx="7" cy="5" r="2" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

function HudField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="label text-sm">{label}</span>
      <span className="value text-sm">{value}</span>
    </div>
  )
}

function LoadingOverlay({ status, progress }: { status: string; progress: number }) {
  const pct = Math.round(progress * 100)
  return (
    <div className="absolute inset-0 z-100 flex flex-col items-center justify-center gap-8 bg-void">
      {/* Animated sigil */}
      <div className="relative h-[48px] w-[48px]">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-border-default border-t-accent" />
        <div className="absolute inset-[6px] animate-spin-reverse rounded-full border-2 border-border-subtle border-b-accent-pressed" />
      </div>

      <div className="font-display text-xl font-semibold tracking-wide uppercase text-fg">
        Tibia Map Editor
      </div>

      {/* Progress bar */}
      <div className="flex w-[280px] flex-col gap-3">
        <div className="h-[4px] w-full overflow-hidden rounded-[2px] bg-elevated">
          <div className="h-full rounded-[2px] bg-accent" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-baseline justify-between">
          <div className="font-mono text-xs text-fg-faint">
            {status}
          </div>
          <div className="font-mono text-xs text-accent">
            {pct}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
