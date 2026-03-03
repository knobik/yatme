import { useEffect, useRef, useState, useCallback } from 'react'
import { Application } from 'pixi.js'
import { loadAppearances, type AppearanceData } from './lib/appearances'
import { loadSpriteCatalog } from './lib/sprites'
import { loadOtbm, type OtbmMap, type OtbmTile } from './lib/otbm'
import { MapRenderer, type FloorViewMode } from './lib/MapRenderer'
import { MapMutator } from './lib/MapMutator'
import { loadItems, type ItemRegistry } from './lib/items'
import { useEditorTools } from './hooks/useEditorTools'
import { Inspector } from './components/Inspector'
import { ItemPalette } from './components/ItemPalette'
import { Toolbar } from './components/Toolbar'

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
  const [error, setError] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1, floor: 7, floorViewMode: 'single', showTransparentUpper: false })
  const [mapInfo, setMapInfo] = useState<{ tiles: number; towns: string[] } | null>(null)

  // Phase 6 state
  const [selectedTile, setSelectedTile] = useState<OtbmTile | null>(null)
  const [itemRegistry, setItemRegistry] = useState<ItemRegistry | null>(null)
  const [appearancesData, setAppearancesData] = useState<AppearanceData | null>(null)
  const [showPalette, setShowPalette] = useState(false)

  // Phase 7 state
  const [mapData, setMapData] = useState<OtbmMap | null>(null)
  const [rendererReady, setRendererReady] = useState<MapRenderer | null>(null)
  const [mutatorReady, setMutatorReady] = useState<MapMutator | null>(null)

  const tools = useEditorTools(rendererReady, mutatorReady, mapData)
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
    setSelectedTile(null)
    rendererRef.current?.deselectTile()
  }, [])

  const handleClosePalette = useCallback(() => {
    setShowPalette(false)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    let destroyed = false
    let initialized = false
    const app = new Application()
    appRef.current = app

    async function init() {
      const container = containerRef.current!

      setLoadingStatus('Starting renderer...')
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

      setLoadingStatus('Loading appearances...')
      const appearances = await loadAppearances()
      if (destroyed) return
      setAppearancesData(appearances)

      setLoadingStatus('Loading sprite catalog...')
      await loadSpriteCatalog()
      if (destroyed) return

      setLoadingStatus('Parsing map data...')
      const mapData = await loadOtbm()
      if (destroyed) return

      setLoadingStatus('Loading item data...')
      const registry = await loadItems()
      if (destroyed) return
      setItemRegistry(registry)

      setMapInfo({
        tiles: mapData.tiles.size,
        towns: mapData.towns.map((t) => t.name),
      })

      setLoadingStatus('Building renderer...')
      const renderer = new MapRenderer(app, appearances, mapData)
      rendererRef.current = renderer
      ;(window as any).__renderer = renderer

      // Create mutator and wire chunk invalidation
      const mutator = new MapMutator(mapData, appearances)
      mutatorRef.current = mutator
      mutator.onChunksInvalidated = (keys) => {
        renderer.invalidateChunks(keys)
      }
      mutator.onTileChanged = (x, y, z) => {
        const tile = mapData.tiles.get(`${x},${y},${z}`)
        if (tile) renderer.updateChunkIndex(tile)
      }

      renderer.onCameraChange = (x, y, zoom, floor, floorViewMode, showTransparentUpper) => {
        setCamera({ x, y, zoom, floor, floorViewMode, showTransparentUpper })
      }

      renderer.onTileClick = (tile) => {
        setSelectedTile(tile)
      }

      setCamera({
        x: renderer.worldX,
        y: renderer.worldY,
        zoom: renderer.zoom,
        floor: renderer.floor,
        floorViewMode: renderer.floorViewMode,
        showTransparentUpper: renderer.showTransparentUpper,
      })

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
        if (e.key === 'v') {
          e.preventDefault()
          toolsRef.current.paste()
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
        if (showPalette) {
          setShowPalette(false)
        } else if (selectedTile) {
          setSelectedTile(null)
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
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleFloorChange, showPalette, selectedTile])

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
      {loading && <LoadingOverlay status={loadingStatus} />}

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
        />
      )}

      {/* Item palette — left side */}
      {!loading && showPalette && itemRegistry && appearancesData && (
        <ItemPalette
          registry={itemRegistry}
          appearances={appearancesData}
          onClose={handleClosePalette}
          selectedItemId={tools.selectedItemId}
          onItemSelect={(id) => {
            tools.setSelectedItemId(id)
            tools.setActiveTool('draw')
          }}
        />
      )}

      {/* Inspector panel — left side (offset right when palette is open) */}
      {!loading && selectedTile && itemRegistry && appearancesData && (
        <Inspector
          tile={selectedTile}
          registry={itemRegistry}
          appearances={appearancesData}
          onClose={handleCloseInspector}
          offset={showPalette}
        />
      )}

      {/* HUD — bottom left status bar */}
      {!loading && (
        <div className="panel" style={{
          position: 'absolute',
          bottom: 'var(--space-4)',
          left: showPalette && selectedTile
            ? 'calc(var(--space-4) + 320px + var(--space-3) + 300px + var(--space-3))'
            : showPalette
              ? 'calc(var(--space-4) + 320px + var(--space-3))'
              : selectedTile
                ? 'calc(var(--space-4) + 300px + var(--space-3))'
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
          <div className="separator-v" style={{ height: 16, flexShrink: 0 }} />
          {/* Palette toggle button */}
          <button
            className="btn btn-icon"
            onClick={() => setShowPalette(prev => !prev)}
            title="Item palette (P)"
            style={{
              border: 'none',
              background: 'transparent',
              color: showPalette ? 'var(--accent)' : undefined,
              pointerEvents: 'auto',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
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
          padding: 'var(--space-2)',
          gap: 'var(--space-1)',
        }}>
          <button
            className="btn btn-icon"
            onClick={() => handleFloorChange(-1)}
            title="Floor up (PageUp)"
            style={{ border: 'none', background: 'transparent' }}
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 6.5L6 1.5L11 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 'var(--space-2) var(--space-4)',
            gap: 1,
          }}>
            <span className="label" style={{ fontSize: 8, lineHeight: 1 }}>FLOOR</span>
            <span className="value value-accent" style={{ fontSize: 'var(--text-xl)', fontWeight: 500, lineHeight: 1 }}>
              {camera.floor}
            </span>
          </div>

          <button
            className="btn btn-icon"
            onClick={() => handleFloorChange(1)}
            title="Floor down (PageDown)"
            style={{ border: 'none', background: 'transparent' }}
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
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
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
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
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
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

function LoadingOverlay({ status }: { status: string }) {
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

      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-wide)',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-3)',
        }}>
          Tibia Map Editor
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-tertiary)',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}>
          {status}
        </div>
      </div>
    </div>
  )
}

export default App
