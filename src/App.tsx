import { useEffect, useRef, useState, useCallback } from 'react'
import { Application } from 'pixi.js'
import { loadAppearances, type AppearanceData } from './lib/appearances'
import { loadSpriteCatalog } from './lib/sprites'
import { loadOtbm, type OtbmMap } from './lib/otbm'
import { MapRenderer } from './lib/MapRenderer'

interface CameraState {
  x: number
  y: number
  zoom: number
  floor: number
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<MapRenderer | null>(null)
  const appRef = useRef<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [error, setError] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1, floor: 7 })
  const [mapInfo, setMapInfo] = useState<{ tiles: number; towns: string[] } | null>(null)

  const handleFloorChange = useCallback((delta: number) => {
    if (rendererRef.current) {
      rendererRef.current.setFloor(rendererRef.current.floor + delta)
    }
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

      setLoadingStatus('Loading sprite catalog...')
      await loadSpriteCatalog()
      if (destroyed) return

      setLoadingStatus('Parsing map data...')
      const mapData = await loadOtbm()
      if (destroyed) return

      setMapInfo({
        tiles: mapData.tiles.size,
        towns: mapData.towns.map((t) => t.name),
      })

      setLoadingStatus('Building renderer...')
      const renderer = new MapRenderer(app, appearances, mapData)
      rendererRef.current = renderer

      renderer.onCameraChange = (x, y, zoom, floor) => {
        setCamera({ x, y, zoom, floor })
      }

      setCamera({
        x: renderer.worldX,
        y: renderer.worldY,
        zoom: renderer.zoom,
        floor: renderer.floor,
      })

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

  // Keyboard floor switching
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'PageUp') {
        e.preventDefault()
        handleFloorChange(-1)
      } else if (e.key === 'PageDown') {
        e.preventDefault()
        handleFloorChange(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleFloorChange])

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

      {/* HUD — bottom left status bar */}
      {!loading && (
        <div className="panel" style={{
          position: 'absolute',
          bottom: 'var(--space-4)',
          left: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-6)',
          padding: 'var(--space-3) var(--space-5)',
          pointerEvents: 'none',
          userSelect: 'none',
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
