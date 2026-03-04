import { useEffect, useRef, useState, useCallback } from 'react'
import { Application } from 'pixi.js'
import { loadAppearances, type AppearanceData } from './lib/appearances'
import { loadSpriteCatalog } from './lib/sprites'
import { loadOtbm, type OtbmMap, type OtbmTile } from './lib/otbm'
import { MapRenderer, type FloorViewMode } from './lib/MapRenderer'
import { MapMutator } from './lib/MapMutator'
import { loadItems, type ItemRegistry } from './lib/items'
import { useEditorTools } from './hooks/useEditorTools'
import { loadBrushData } from './lib/brushes/BrushLoader'
import { parseWallBrushesXml } from './lib/brushes/WallLoader'
import { parseCarpetBrushesXml } from './lib/brushes/CarpetLoader'
import { parseDoodadBrushesXml } from './lib/brushes/DoodadLoader'
import type { CarpetBrush, TableBrush } from './lib/brushes/CarpetTypes'
import type { DoodadBrush } from './lib/brushes/DoodadTypes'
import { BrushRegistry } from './lib/brushes/BrushRegistry'
import { Inspector } from './components/Inspector'
import { BrushPalette } from './components/BrushPalette'
import { loadTilesets, resolveTilesets } from './lib/tilesets/TilesetLoader'
import type { ResolvedTileset } from './lib/tilesets/TilesetTypes'
import { Toolbar } from './components/Toolbar'
import { ContextMenu, type ContextMenuGroup } from './components/ContextMenu'
import { GoToPositionDialog } from './components/GoToPositionDialog'
import { SettingsModal } from './components/SettingsModal'
import { loadSettings, saveSettings, type EditorSettings } from './lib/EditorSettings'
import { getItemDisplayName } from './lib/items'

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

  const handleSelectAsBrush = useCallback((itemId: number) => {
    tools.setSelectedItemId(itemId)
    tools.setActiveTool('draw')
  }, [tools])

  const inspectorAnchorRef = useRef<number | null>(null)

  const handleSelectItem = useCallback((index: number, e: React.MouseEvent) => {
    if (!selectedTilePos) return
    const { x, y, z } = selectedTilePos
    const renderer = rendererRef.current
    const tiles = tools.selection // preserve multi-tile selection

    if (e.ctrlKey || e.metaKey) {
      // Toggle item in/out of selection
      const existing = tools.selectedItems.filter(
        it => it.x === x && it.y === y && it.z === z
      )
      const alreadySelected = existing.some(it => it.itemIndex === index)
      const otherOnTile = alreadySelected
        ? existing.filter(it => it.itemIndex !== index)
        : [...existing, { x, y, z, itemIndex: index }]
      const otherTiles = tools.selectedItems.filter(
        it => !(it.x === x && it.y === y && it.z === z)
      )
      const newItems = [...otherTiles, ...otherOnTile]
      tools.setSelectedItems(newItems)
      if (newItems.length === 0 && tiles.length === 0) {
        renderer?.clearItemHighlight()
      } else {
        renderer?.highlightCombined(newItems, tiles)
      }
      inspectorAnchorRef.current = alreadySelected ? null : index
    } else if (e.shiftKey && inspectorAnchorRef.current !== null) {
      // Range select from anchor to clicked index
      const from = Math.min(inspectorAnchorRef.current, index)
      const to = Math.max(inspectorAnchorRef.current, index)
      const rangeItems: typeof tools.selectedItems = []
      for (let i = from; i <= to; i++) {
        rangeItems.push({ x, y, z, itemIndex: i })
      }
      tools.setSelectedItems(rangeItems)
      renderer?.highlightCombined(rangeItems, tiles)
    } else {
      // Plain click — select single item, clear multi-tile selection
      tools.setSelectedItems([{ x, y, z, itemIndex: index }])
      renderer?.highlightCombined([{ x, y, z, itemIndex: index }], tiles)
      inspectorAnchorRef.current = index
    }
  }, [selectedTilePos, tools])

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
    if (!containerRef.current) return

    let destroyed = false
    let initialized = false
    const app = new Application()
    appRef.current = app

    const stepWeights = [2, 15, 3, 55, 12, 8, 3, 2]
    const totalWeight = stepWeights.reduce((a, b) => a + b, 0)
    let currentStep = 0
    const stepStarts: number[] = []
    let acc = 0
    for (const w of stepWeights) {
      stepStarts.push(acc / totalWeight)
      acc += w
    }

    function stepProgress(fraction: number) {
      const start = stepStarts[currentStep]
      const weight = stepWeights[currentStep] / totalWeight
      setLoadingProgress(Math.min(start + fraction * weight, 1))
    }

    function nextStep() {
      currentStep++
      if (currentStep < stepWeights.length) {
        setLoadingProgress(stepStarts[currentStep])
      }
    }

    async function init() {
      const container = containerRef.current!

      setLoadingStatus('Starting renderer...')
      stepProgress(0)
      await app.init({
        resizeTo: container,
        backgroundColor: 0x07070a,
        antialias: false,
        roundPixels: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: 'webgl',
      })

      if (destroyed) { app.destroy(true); return }
      initialized = true
      container.appendChild(app.canvas as HTMLCanvasElement)
      nextStep()

      setLoadingStatus('Loading sprite catalog...')
      const catalog = await loadSpriteCatalog(undefined, stepProgress)
      if (destroyed) return
      nextStep()

      setLoadingStatus('Loading appearances...')
      const appearancesUrl = catalog.appearancesFile
        ? `/sprites-png/${catalog.appearancesFile}`
        : '/appearances.dat'
      const appearances = await loadAppearances(appearancesUrl, stepProgress)
      if (destroyed) return
      setAppearancesData(appearances)
      nextStep()

      setLoadingStatus('Loading map data...')
      const mapData = await loadOtbm(undefined, stepProgress)
      if (destroyed) return
      nextStep()

      setLoadingStatus('Loading item data...')
      const registry = await loadItems(undefined, stepProgress)
      if (destroyed) return
      setItemRegistry(registry)
      nextStep()

      setMapInfo({
        tiles: mapData.tiles.size,
        towns: mapData.towns.map((t) => t.name),
      })

      setLoadingStatus('Loading brush data...')
      let brushRegistry: BrushRegistry | null = null
      try {
        const brushData = await loadBrushData(stepProgress)
        const nextId = { value: brushData.brushes.length + 1 }

        const wallsXml = await fetch('/data/materials/brushs/walls.xml').then(r => r.text())
        const wallBrushes = parseWallBrushesXml(wallsXml, nextId)
        console.log(`[WallLoader] Loaded ${wallBrushes.length} wall brushes`)

        const doodadFiles = ['doodads.xml', 'tiny_borders.xml', 'trees.xml']
        const allCarpets: CarpetBrush[] = []
        const allTables: TableBrush[] = []
        const allDoodads: DoodadBrush[] = []
        for (const file of doodadFiles) {
          try {
            const xml = await fetch(`/data/materials/brushs/${file}`).then(r => r.text())
            const { carpets, tables } = parseCarpetBrushesXml(xml, nextId)
            const doodads = parseDoodadBrushesXml(xml, nextId)
            allCarpets.push(...carpets)
            allTables.push(...tables)
            allDoodads.push(...doodads)
          } catch (e) {
            console.warn(`[BrushLoader] Failed to load ${file}:`, e)
          }
        }
        console.log(`[CarpetLoader] Loaded ${allCarpets.length} carpet brushes, ${allTables.length} table brushes`)
        console.log(`[DoodadLoader] Loaded ${allDoodads.length} doodad brushes`)

        brushRegistry = new BrushRegistry(brushData.brushes, brushData.borders, wallBrushes, allCarpets, allTables, allDoodads)
        ;(window as any).__brushRegistry = brushRegistry
        if (!destroyed) setBrushRegistryState(brushRegistry)
      } catch (e) {
        console.warn('[App] Failed to load brush data, smart brushes disabled:', e)
      }
      if (destroyed) return
      nextStep()

      setLoadingStatus('Loading tilesets...')
      try {
        const rawTilesets = await loadTilesets()
        if (brushRegistry) {
          const resolved = resolveTilesets(rawTilesets, brushRegistry, appearances)
          if (!destroyed) setTilesets(resolved)
          console.log(`[TilesetLoader] Loaded ${resolved.length} tilesets`)
        }
      } catch (e) {
        console.warn('[App] Failed to load tilesets:', e)
      }
      if (destroyed) return
      nextStep()

      setLoadingStatus('Building renderer...')
      const renderer = new MapRenderer(app, appearances, mapData)
      rendererRef.current = renderer
      ;(window as any).__renderer = renderer

      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = brushRegistry
      mutatorRef.current = mutator
      mutator.onChunksInvalidated = (keys) => {
        renderer.invalidateChunks(keys)
      }
      mutator.onTileChanged = (x, y, z) => {
        const tile = mapData.tiles.get(`${x},${y},${z}`)
        if (tile) renderer.updateChunkIndex(tile)
        setTileVersion(v => v + 1)
      }

      renderer.onCameraChange = (x, y, zoom, floor, floorViewMode, showTransparentUpper) => {
        setCamera({ x, y, zoom, floor, floorViewMode, showTransparentUpper })
        setContextMenu(null)
      }

      renderer.onTileClick = (tile, worldX, worldY) => {
        if (tile) {
          setSelectedTilePos({ x: tile.x, y: tile.y, z: tile.z })
          // Sync Inspector anchor to map's selected item (top item)
          inspectorAnchorRef.current = tile.items.length > 0 ? tile.items.length - 1 : null
        } else {
          setSelectedTilePos(null)
          inspectorAnchorRef.current = null
          // Clear per-item selection when clicking empty ground
          toolsRef.current.setSelectedItems([])
        }
      }

      renderer.onTileContextMenu = (pos, tile, screenX, screenY) => {
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
      if (!destroyed) setError(e.message)
      setLoading(false)
    })

    return () => {
      destroyed = true
      rendererRef.current?.destroy()
      rendererRef.current = null
      if (initialized) {
        app.destroy(true)
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
        if (showGoToDialog) {
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

    const isInSelection = currentTools.selection.some(
      s => s.x === tilePos.x && s.y === tilePos.y && s.z === tilePos.z,
    ) || currentTools.selectedItems.some(
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
            currentTools.copy()
            currentTools.deleteSelection()
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
          ? [{
              label: 'Browse Tile',
              onClick: () => {
                setSelectedTilePos({ x: tilePos.x, y: tilePos.y, z: tilePos.z })
              },
            }]
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
              mutatorReady.switchDoorItem(tilePos.x, tilePos.y, tilePos.z, idx, brushRegistryState)
            },
          }]
        : [],
    }

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

    return [clipboardGroup, positionGroup, itemInfoGroup, doorGroup, teleportGroup]
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

  const inspectorSelectedIndices = (() => {
    const s = new Set<number>()
    if (selectedTilePos) {
      for (const it of tools.selectedItems) {
        if (it.x === selectedTilePos.x && it.y === selectedTilePos.y && it.z === selectedTilePos.z) {
          s.add(it.itemIndex)
        }
      }
    }
    return s
  })()

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
          selectedItemId={tools.selectedItemId}
          appearances={appearancesData}
          registry={itemRegistry}
          onCut={tools.cut}
          onCopy={tools.copy}
          onPaste={tools.paste}
          onDelete={tools.deleteSelection}
          canPaste={!!tools.clipboard}
          hasSelection={tools.selection.length > 0 || tools.selectedItems.length > 0}
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
          tilesets={tilesets}
          registry={itemRegistry}
          appearances={appearancesData}
          brushRegistry={brushRegistryState}
          onClose={handleClosePalette}
          selectedItemId={tools.selectedItemId}
          onItemSelect={(id) => {
            tools.setSelectedItemId(id)
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
          onSelectItem={handleSelectItem}
          selectedItemIndices={inspectorSelectedIndices}
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
