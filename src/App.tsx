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
import { ItemPalette } from './components/ItemPalette'
import { Toolbar } from './components/Toolbar'
import { ContextMenu, type ContextMenuGroup } from './components/ContextMenu'
import { GoToPositionDialog } from './components/GoToPositionDialog'
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
  const [showPalette, setShowPalette] = useState(true)

  // Phase 7 state
  const [mapData, setMapData] = useState<OtbmMap | null>(null)
  const [rendererReady, setRendererReady] = useState<MapRenderer | null>(null)
  const [mutatorReady, setMutatorReady] = useState<MapMutator | null>(null)

  const [showGoToDialog, setShowGoToDialog] = useState(false)
  const [brushRegistryState, setBrushRegistryState] = useState<BrushRegistry | null>(null)

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number
    tilePos: { x: number; y: number; z: number }
    tile: OtbmTile | null
  } | null>(null)

  const tools = useEditorTools(rendererReady, mutatorReady, mapData, brushRegistryState)
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
  }, [])

  const handleToggleTransparentUpper = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.setShowTransparentUpper(!rendererRef.current.showTransparentUpper)
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

    // Weighted progress: each step has a weight proportional to its cost.
    // The progress callback maps per-step fraction to overall 0→1 progress.
    const stepWeights = [2, 15, 3, 55, 12, 8, 5] // renderer, appearances, sprites, otbm, items, brushes, setup
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

      setLoadingStatus('Loading appearances...')
      const appearances = await loadAppearances(undefined, stepProgress)
      if (destroyed) return
      setAppearancesData(appearances)
      nextStep()

      setLoadingStatus('Loading sprite catalog...')
      await loadSpriteCatalog(undefined, stepProgress)
      if (destroyed) return
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

        // Load wall brushes
        const wallsXml = await fetch('/materials/brushs/walls.xml').then(r => r.text())
        const wallBrushes = parseWallBrushesXml(wallsXml, nextId)
        console.log(`[WallLoader] Loaded ${wallBrushes.length} wall brushes`)

        // Load carpet/table/doodad brushes from doodad XMLs
        const doodadFiles = ['doodads.xml', 'tiny_borders.xml', 'trees.xml']
        const allCarpets: CarpetBrush[] = []
        const allTables: TableBrush[] = []
        const allDoodads: DoodadBrush[] = []
        for (const file of doodadFiles) {
          try {
            const xml = await fetch(`/materials/brushs/${file}`).then(r => r.text())
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

      setLoadingStatus('Building renderer...')
      const renderer = new MapRenderer(app, appearances, mapData)
      rendererRef.current = renderer
      ;(window as any).__renderer = renderer

      // Create mutator and wire chunk invalidation
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
        } else {
          setSelectedTilePos(null)
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
      // Don't handle shortcuts when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Ctrl shortcuts
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
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setShowPalette(prev => !prev)
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
    )

    // Clipboard group
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

    // Position group
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
                renderer?.onTileClick?.(tile, tilePos.x, tilePos.y)
              },
            }]
          : []),
      ],
    }

    // Item info group
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

    // Door group — switch door open/closed
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

    // Teleport group — find first item with teleportDestination
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
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-void)',
      }}>
        <div className="panel" style={{ padding: 'var(--space-10)', maxWidth: 400, textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, margin: '0 auto var(--space-6)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>!</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--danger)',
            marginBottom: 'var(--space-3)',
          }}>Failed to load</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            wordBreak: 'break-word',
          }}>{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Map viewport */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

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
          hasSelection={tools.selection.length > 0}
          onGoToPosition={() => setShowGoToDialog(true)}
          showPalette={showPalette}
          onTogglePalette={() => setShowPalette(prev => !prev)}
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

      {/* Item palette — left side */}
      {!loading && showPalette && itemRegistry && appearancesData && (
        <ItemPalette
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
          offset={showPalette}
        />
      )}

      {/* HUD — bottom left status bar */}
      {!loading && (
        <div className="panel" style={{
          position: 'absolute',
          bottom: 'var(--space-4)',
          left: showPalette && selectedTilePos
            ? 'calc(var(--space-4) + 320px + var(--space-3) + 400px + var(--space-3))'
            : showPalette
              ? 'calc(var(--space-4) + 320px + var(--space-3))'
              : selectedTilePos
                ? 'calc(var(--space-4) + 400px + var(--space-3))'
                : 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-6)',
          padding: 'var(--space-3) var(--space-5)',
          pointerEvents: 'auto',
          userSelect: 'none',
          transition: 'left var(--duration-normal) var(--ease-out)',
        }}>
          <HudField label="POS" value={`${camera.x}, ${camera.y}`} />
          <div className="separator-v" style={{ height: 16, flexShrink: 0 }} />
          <HudField label="ZOOM" value={`${camera.zoom.toFixed(2)}x`} />
          {mapInfo && (
            <>
              <div className="separator-v" style={{ height: 16, flexShrink: 0 }} />
              <HudField label="TILES" value={mapInfo.tiles.toLocaleString()} />
            </>
          )}
        </div>
      )}

      {/* Floor selector — right side */}
      {!loading && (
        <div className="panel" style={{
          position: 'absolute',
          top: '50%',
          right: 'var(--space-4)',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-3)',
          gap: 'var(--space-1)',
        }}>
          <button
            className="btn btn-icon"
            onClick={() => handleFloorChange(-1)}
            title="Floor up (PageUp)"
            style={{ border: 'none', background: 'transparent' }}
          >
            <svg width="16" height="10" viewBox="0 0 12 8" fill="none">
              <path d="M1 6.5L6 1.5L11 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 'var(--space-2) var(--space-5)',
            gap: 2,
          }}>
            <span className="label" style={{ fontSize: 10, lineHeight: 1 }}>FLOOR</span>
            <span className="value value-accent" style={{ fontSize: 'var(--text-2xl)', fontWeight: 500, lineHeight: 1 }}>
              {camera.floor}
            </span>
          </div>

          <button
            className="btn btn-icon"
            onClick={() => handleFloorChange(1)}
            title="Floor down (PageDown)"
            style={{ border: 'none', background: 'transparent' }}
          >
            <svg width="16" height="10" viewBox="0 0 12 8" fill="none">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="separator" style={{ width: '100%', margin: 'var(--space-1) 0' }} />

          {/* Floor view mode: single / current+below / all */}
          <button
            className="btn btn-icon"
            onClick={() => handleFloorViewMode('single')}
            title="Single floor"
            style={{
              border: 'none',
              background: 'transparent',
              color: camera.floorViewMode === 'single' ? 'var(--accent)' : undefined,
            }}
          >
            <svg width="18" height="13" viewBox="0 0 14 10" fill="none">
              <path d="M7 2L1 5L7 8L13 5L7 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            className="btn btn-icon"
            onClick={() => handleFloorViewMode('current-below')}
            title="Current floor + below"
            style={{
              border: 'none',
              background: 'transparent',
              color: camera.floorViewMode === 'current-below' ? 'var(--accent)' : undefined,
            }}
          >
            <svg width="18" height="16" viewBox="0 0 14 12" fill="none">
              <path d="M7 1L1 4L7 7L13 4L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M1 7.5L7 10.5L13 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            className="btn btn-icon"
            onClick={() => handleFloorViewMode('all')}
            title="All floors"
            style={{
              border: 'none',
              background: 'transparent',
              color: camera.floorViewMode === 'all' ? 'var(--accent)' : undefined,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L1 4L7 7L13 4L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M1 7L7 10L13 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 10L7 13L13 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="separator" style={{ width: '100%', margin: 'var(--space-1) 0' }} />

          {/* Transparent upper floor toggle */}
          <button
            className="btn btn-icon"
            onClick={handleToggleTransparentUpper}
            title="Show transparent upper floor"
            style={{
              border: 'none',
              background: 'transparent',
              color: camera.showTransparentUpper ? 'var(--accent)' : undefined,
            }}
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
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  )
}

function LoadingOverlay({ status, progress }: { status: string; progress: number }) {
  const pct = Math.round(progress * 100)
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-void)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-8)',
      zIndex: 100,
    }}>
      {/* Animated sigil */}
      <div style={{
        width: 48,
        height: 48,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{
          position: 'absolute',
          inset: 6,
          border: '2px solid var(--border-subtle)',
          borderBottomColor: 'var(--accent-pressed)',
          borderRadius: '50%',
          animation: 'spin 1.2s linear infinite reverse',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-xl)',
        fontWeight: 600,
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        color: 'var(--text-primary)',
      }}>
        Tibia Map Editor
      </div>

      {/* Progress bar */}
      <div style={{
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}>
        <div style={{
          width: '100%',
          height: 4,
          background: 'var(--bg-elevated)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--accent)',
            borderRadius: 2,
          }} />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
          }}>
            {status}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--accent)',
          }}>
            {pct}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
