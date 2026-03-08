import { useEffect, useRef, useState, useCallback } from 'react'
import { Application } from 'pixi.js'
import type { AppearanceData } from './lib/appearances'
import type { OtbmMap, OtbmTile } from './lib/otbm'
import { deepCloneItem, serializeOtbm } from './lib/otbm'
import { serializeSidecars, emptySidecars, parseZonesXml, serializeZonesXml, type MapSidecars } from './lib/sidecars'
import { StaticFileProvider, ServerStorageProvider, type MapStorageProvider } from './lib/storage'
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
import { FindItemDialog } from './components/FindItemDialog'
import { ReplaceItemsDialog } from './components/ReplaceItemsDialog'
import { SettingsModal } from './components/SettingsModal'
import { SaveToast, type SavePhase } from './components/SaveToast'
import { loadSettings, saveSettings, type EditorSettings } from './lib/EditorSettings'
import { getItemDisplayName } from './lib/items'
import { loadAssets } from './lib/initPipeline'
import { setupEditor } from './lib/setupEditor'
import { findEntryInTilesets } from './lib/tilesets/TilesetLoader'
import { ZONE_FLAG_DEFS, type BrushSelection } from './hooks/tools/types'
import { scrubZoneFromTiles } from './lib/zoneCleanup'
import { ZonePalette } from './components/ZonePalette'
import { CaretUpIcon, CaretDownIcon, EyeIcon } from '@phosphor-icons/react'
import type { CategoryType } from './lib/tilesets/TilesetTypes'

/** Compute left offset for elements that need to dodge all left-side panels. */
function computeLeftOffset(palette: boolean, inspector: boolean, findItem: boolean, replaceItems: boolean): string {
  // Panel widths: palette=320, inspector=400, find/replace=340, gap=6px each
  let px = 8 // base margin
  if (palette) px += 320 + 6
  if (inspector) px += 400 + 6
  if (findItem || replaceItems) px += 340 + 6
  return `${px}px`
}

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
  const storageRef = useRef<MapStorageProvider | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1, floor: 7, floorViewMode: 'single', showTransparentUpper: false })
  const [mapInfo, setMapInfo] = useState<{ tiles: number; towns: string[] } | null>(null)

  // Phase 6 state
  // Inspector panel tile position — set via "Browse Tile" or click-to-inspect.
  // NOT the map selection (use toolsRef.current.selectedItems for that).
  const [selectedTilePos, setSelectedTilePos] = useState<{ x: number; y: number; z: number } | null>(null)
  const [tileVersion, setTileVersion] = useState(0)
  const [itemRegistry, setItemRegistry] = useState<ItemRegistry | null>(null)
  const [appearancesData, setAppearancesData] = useState<AppearanceData | null>(null)
  const [showPalette, setShowPalette] = useState(() => loadSettings().showPalette)
  const [showLights, setShowLights] = useState(() => loadSettings().showLights)
  const [showZonePalette, setShowZonePalette] = useState(() => loadSettings().showZonePalette)
  const [showZoneOverlay, setShowZoneOverlay] = useState(() => loadSettings().showZoneOverlay)

  // Phase 7 state
  const [mapData, setMapData] = useState<OtbmMap | null>(null)
  const [sidecarsData, setSidecarsData] = useState<MapSidecars>(() => emptySidecars())
  const [rendererReady, setRendererReady] = useState<MapRenderer | null>(null)
  const [mutatorReady, setMutatorReady] = useState<MapMutator | null>(null)

  const [showGoToDialog, setShowGoToDialog] = useState(false)
  const [showFindItem, setShowFindItem] = useState(false)
  const [showReplaceItems, setShowReplaceItems] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => loadSettings())
  const [brushRegistryState, setBrushRegistryState] = useState<BrushRegistry | null>(null)
  const [tilesets, setTilesets] = useState<ResolvedTileset[]>([])
  const [mapFilename, setMapFilename] = useState('map.otbm')

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number
    tilePos: { x: number; y: number; z: number }
    tile: OtbmTile | null
  } | null>(null)

  const paletteRef = useRef<BrushPaletteHandle>(null)
  const editorSettingsRef = useRef(editorSettings)
  editorSettingsRef.current = editorSettings

  const [editItemIndex, setEditItemIndex] = useState<number | null>(null)

  const handleRequestEditItem = useCallback((_x: number, _y: number, _z: number, itemIndex: number) => {
    setEditItemIndex(itemIndex)
  }, [])

  const tools = useEditorTools(rendererReady, mutatorReady, mapData, brushRegistryState, handleRequestEditItem, editorSettings.clickToInspect, editorSettingsRef)
  const toolsRef = useRef(tools)
  toolsRef.current = tools

  // Auto-show zone overlay + palette while zone tool is active, restore on exit
  const zoneOverlayBeforeRef = useRef<boolean | null>(null)
  const zonePaletteBeforeRef = useRef<boolean | null>(null)
  const showZoneOverlayRef = useRef(showZoneOverlay)
  const showZonePaletteRef = useRef(showZonePalette)
  showZoneOverlayRef.current = showZoneOverlay
  showZonePaletteRef.current = showZonePalette
  useEffect(() => {
    if (tools.activeTool === 'zone') {
      zoneOverlayBeforeRef.current = showZoneOverlayRef.current
      zonePaletteBeforeRef.current = showZonePaletteRef.current
      if (!showZoneOverlayRef.current) {
        setShowZoneOverlay(true)
        rendererRef.current?.setShowZoneOverlay(true)
      }
      if (!showZonePaletteRef.current) {
        setShowZonePalette(true)
      }
    } else {
      if (zoneOverlayBeforeRef.current !== null) {
        if (!zoneOverlayBeforeRef.current) {
          setShowZoneOverlay(false)
          rendererRef.current?.setShowZoneOverlay(false)
        }
        zoneOverlayBeforeRef.current = null
      }
      if (zonePaletteBeforeRef.current !== null) {
        if (!zonePaletteBeforeRef.current) {
          setShowZonePalette(false)
        }
        zonePaletteBeforeRef.current = null
      }
    }
  }, [tools.activeTool])

  // Sync active zone highlighting to renderer
  useEffect(() => {
    rendererRef.current?.setActiveZone(tools.selectedZone)
  }, [tools.selectedZone])

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
    setShowZonePalette(next.showZonePalette)
    setShowZoneOverlay(next.showZoneOverlay)
    r?.setShowZoneOverlay(next.showZoneOverlay)
  }, [])

  const [saveProgress, setSaveProgress] = useState<number | null>(null)
  const [savePhase, setSavePhase] = useState<SavePhase>('serialize')
  const lastReportedProgress = useRef(0)

  const handleSave = useCallback(async () => {
    const md = mapData
    const provider = storageRef.current
    if (!md || !provider || !provider.canSave || saveProgress != null) return
    setSaveProgress(0)
    lastReportedProgress.current = 0
    try {
      setSavePhase('serialize')
      const otbm = await serializeOtbm(md, (done, total) => {
        const pct = total > 0 ? done / total : 0
        if (pct - lastReportedProgress.current >= 0.02) {
          lastReportedProgress.current = pct
          setSaveProgress(pct)
        }
      })
      const sidecars = serializeSidecars(sidecarsData, md)
      const hasUploadPhase = 'uploadWithProgress' in provider
      if (hasUploadPhase) {
        setSavePhase('upload')
        setSaveProgress(0)
        lastReportedProgress.current = 0
      }
      await provider.saveMap({ otbm, sidecars, filename: mapFilename }, (fraction) => {
        if (fraction - lastReportedProgress.current >= 0.02) {
          lastReportedProgress.current = fraction
          setSaveProgress(fraction)
        }
      })
    } catch (e) {
      console.error('[Save] Failed to save map:', e)
      alert(`Failed to save map: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaveProgress(null)
    }
  }, [mapData, mapFilename, sidecarsData, saveProgress])

  const handleExportZones = useCallback(() => {
    const xml = serializeZonesXml(sidecarsData.zones)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zones.xml'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [sidecarsData.zones])

  const handleImportZones = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const text = reader.result as string
          const imported = parseZonesXml(text)
          setSidecarsData(prev => {
            const existingIds = new Set(prev.zones.map(z => z.id))
            const newZones = imported.filter(z => !existingIds.has(z.id))
            if (newZones.length === 0) return prev
            return { ...prev, zones: [...prev.zones, ...newZones] }
          })
        } catch (e) {
          console.error('[Zones] Failed to parse imported zones:', e)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])

  const handleGoToPosition = useCallback((x: number, y: number, z: number) => {
    if (!rendererRef.current) return
    rendererRef.current.setFloor(z)
    rendererRef.current.centerOn(x, y)
    rendererRef.current.pingTile(x, y, z)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const signal = { destroyed: false }
    let appInstance: Application | null = null

    async function init() {
      const provider: MapStorageProvider = import.meta.env.VITE_STORAGE === 'static'
        ? new StaticFileProvider()
        : new ServerStorageProvider()
      storageRef.current = provider

      const result = await loadAssets(container!, {
        setStatus: setLoadingStatus,
        setProgress: setLoadingProgress,
      }, signal, provider)
      if (!result) return

      const { app, appearances, mapData, sidecars, registry, brushRegistry, tilesets, mapFilename: filename } = result
      setMapFilename(filename)
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
      setSidecarsData(sidecars)
      const { renderer, mutator } = setupEditor(app, appearances, mapData, brushRegistry, registry, sidecars)
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
        // Select the top item (like left-click) if tile not already in selection
        const alreadySelected = toolsRef.current.selectedItems.some(
          i => i.x === pos.x && i.y === pos.y && i.z === pos.z
        )
        if (!alreadySelected && tile && tile.items && tile.items.length > 0) {
          const topIdx = tile.items.length - 1
          const newSel = [{ x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }]
          toolsRef.current.setSelectedItems(newSel)
          renderer.setHighlights([{ pos: { x: pos.x, y: pos.y, z: pos.z }, indices: [topIdx] }])
        }
        setContextMenu({ x: screenX, y: screenY, tilePos: pos, tile })
      }

      renderer.onInspectorItemDrop = (pos, _itemId, source) => {
        // No-op if dropping on the same tile
        if (pos.x === source.x && pos.y === source.y && pos.z === source.z) return

        const srcKey = `${source.x},${source.y},${source.z}`
        const srcTile = mapData.tiles.get(srcKey)
        if (!srcTile || !srcTile.items[source.index]) return

        const movedItem = deepCloneItem(srcTile.items[source.index])
        mutator.beginBatch('Move item')
        mutator.removeItem(source.x, source.y, source.z, source.index)
        mutator.addItem(pos.x, pos.y, pos.z, movedItem)
        mutator.commitBatch()
      }

      renderer.onDragHover = (pos) => {
        if (renderer.dragPreviewItemId != null) {
          renderer.updateGhostPreview(renderer.dragPreviewItemId, [pos])
        }
      }

      renderer.onDragLeave = () => {
        renderer.clearGhostPreview()
        renderer.dragPreviewItemId = null
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
      renderer.setShowZoneOverlay(savedSettings.showZoneOverlay)

      setLoadingProgress(1)
      setLoadingStatus('Ready')
      setMapData(mapData)
      setRendererReady(renderer)
      setMutatorReady(mutator)
      // Brief delay so user sees 100% before overlay disappears
      await new Promise(r => setTimeout(r, 350))
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

  function borderizeCurrentSelection() {
    const sel = toolsRef.current.selectedItems
    if (sel.length === 0 || !mutatorRef.current) return
    const uniqueTiles = new Map<string, { x: number; y: number; z: number }>()
    for (const item of sel) {
      const key = `${item.x},${item.y},${item.z}`
      if (!uniqueTiles.has(key)) uniqueTiles.set(key, { x: item.x, y: item.y, z: item.z })
    }
    mutatorRef.current.borderizeSelection([...uniqueTiles.values()])
  }

  function randomizeCurrentSelection() {
    const sel = toolsRef.current.selectedItems
    if (sel.length === 0 || !mutatorRef.current) return
    const uniqueTiles = new Map<string, { x: number; y: number; z: number }>()
    for (const item of sel) {
      const key = `${item.x},${item.y},${item.z}`
      if (!uniqueTiles.has(key)) uniqueTiles.set(key, { x: item.x, y: item.y, z: item.z })
    }
    mutatorRef.current.randomizeSelection([...uniqueTiles.values()])
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault()
          handleSave()
          return
        }
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
        if (e.key === 'f') {
          e.preventDefault()
          setShowFindItem(true)
          setShowReplaceItems(false)
          return
        }
        if (e.key === 'h') {
          e.preventDefault()
          setShowReplaceItems(true)
          setShowFindItem(false)
          return
        }
        if (e.key === 'b') {
          e.preventDefault()
          borderizeCurrentSelection()
          return
        }
        if (e.key === 'r' && !e.shiftKey) {
          e.preventDefault()
          const sel = toolsRef.current.selectedItems
          if (sel.length > 0 && mutatorRef.current) {
            const last = sel[sel.length - 1]
            mutatorRef.current.rotateItem(last.x, last.y, last.z, -1)
          }
          return
        }
        if (e.key === 'R' && e.shiftKey) {
          e.preventDefault()
          randomizeCurrentSelection()
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
        } else if (showFindItem) {
          setShowFindItem(false)
        } else if (showReplaceItems) {
          setShowReplaceItems(false)
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
      } else if (e.key === 'f' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('fill')
      } else if (e.key === 'z' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('zone')
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
  }, [handleFloorChange, handleSave, showPalette, showZonePalette, selectedTilePos, contextMenu, showGoToDialog, showFindItem, showReplaceItems])

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
          disabled: !currentTools.canPaste,
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

    const rotateGroup: ContextMenuGroup = {
      items: topItem && itemRegistry?.get(topItem.id)?.rotateTo
        ? [{
            label: 'Rotate Item',
            shortcut: 'Ctrl+R',
            onClick: () => {
              if (!mutatorReady || !tile) return
              mutatorReady.rotateItem(tilePos.x, tilePos.y, tilePos.z, -1)
            },
          }]
        : [],
    }

    // Brush selection group — scan tile items for all applicable brush types
    const brushSelectItems: ContextMenuAction[] = []
    if (topItem) {
      brushSelectItems.push({
        label: 'Select RAW',
        onClick: () => handleSelectAsRaw(topItem.id),
      })
    }

    if (tile?.items && brushRegistryState) {
      const registry = brushRegistryState

      // Ground brush — from the ground item (first item with bank flag)
      const groundItem = tile.items.find(i => {
        const app = appearancesData?.objects.get(i.id)
        return !!app?.flags?.bank
      })
      if (groundItem && registry.getBrushForItem(groundItem.id)) {
        brushSelectItems.push({
          label: 'Select Ground Brush',
          onClick: () => handleSelectAsBrush(groundItem.id),
        })
      }

      // Wall brush — any non-door item on tile that belongs to a wall brush
      const wallItem = tile.items.find(i => !registry.isDoorItem(i.id) && registry.getWallBrushForItem(i.id))
      if (wallItem) {
        brushSelectItems.push({
          label: 'Select Wall Brush',
          onClick: () => handleSelectAsBrush(wallItem.id),
        })
      }

      // Carpet brush — any item on tile that belongs to a carpet brush
      const carpetItem = tile.items.find(i => registry.getCarpetBrushForItem(i.id))
      if (carpetItem) {
        brushSelectItems.push({
          label: 'Select Carpet Brush',
          onClick: () => handleSelectAsBrush(carpetItem.id),
        })
      }

      // Table brush — any item on tile that belongs to a table brush
      const tableItem = tile.items.find(i => registry.getTableBrushForItem(i.id))
      if (tableItem) {
        brushSelectItems.push({
          label: 'Select Table Brush',
          onClick: () => handleSelectAsBrush(tableItem.id),
        })
      }

      // Doodad brush — from the top item specifically (like RME)
      if (topItem && registry.getDoodadBrushForItem(topItem.id)) {
        brushSelectItems.push({
          label: 'Select Doodad Brush',
          onClick: () => handleSelectAsBrush(topItem.id),
        })
      }

      // TODO: Add "Select House", "Select Monster", "Select Monster Spawn",
      // "Select NPC", and "Select NPC Spawn" once those systems are implemented.

      // Door brush — from the top item specifically (like RME)
      if (topItem && registry.isDoorItem(topItem.id)) {
        const doorInfo = registry.getDoorInfo(topItem.id)
        if (doorInfo) {
          // Find the wall brush that owns this door
          const wallBrush = registry.getWallBrushForItem(topItem.id)
          if (wallBrush) {
            brushSelectItems.push({
              label: 'Select Door Brush',
              onClick: () => handleSelectAsBrush(topItem.id),
            })
          }
        }
      }
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

    return [clipboardGroup, positionGroup, itemInfoGroup, brushSelectGroup, doorGroup, rotateGroup, teleportGroup]
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
          selectedZone={tools.selectedZone}
          onZoneSelect={(zone) => {
            tools.setSelectedZone(zone)
            if (tools.activeTool !== 'zone') tools.setActiveTool('zone')
          }}
          onZoneDelete={(zoneId) => {
            if (!mapData) return
            // Scrub zone from all tiles
            scrubZoneFromTiles(mapData.tiles, zoneId)
            // Refresh zone overlay
            rendererRef.current?.markZoneOverlayDirty()
            // If the deleted zone was selected, fall back to first flag def
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
          onDragToMap={(itemId) => { if (rendererRef.current) rendererRef.current.dragPreviewItemId = itemId }}
          onDragToMapEnd={() => { if (rendererRef.current) { rendererRef.current.dragPreviewItemId = null; rendererRef.current.clearGhostPreview() } }}
        />
      )}

      {/* HUD — bottom left status bar */}
      {!loading && (
        <div
          className="panel absolute bottom-4 z-10 flex h-[48px] items-center gap-6 px-5 pointer-events-auto select-none transition-[left] duration-[180ms] ease-out"
          style={{ left: computeLeftOffset(showPalette, !!selectedTilePos, showFindItem, showReplaceItems) }}
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
            <CaretUpIcon size={16} weight="bold" />
          </button>

          <span className="value text-accent-fg text-2xl font-medium leading-none py-1">
            {camera.floor}
          </span>

          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={() => handleFloorChange(1)}
            title="Floor down (PageDown)"
          >
            <CaretDownIcon size={16} weight="bold" />
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
            <EyeIcon size={18} weight="bold" />
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
          <div className="h-full rounded-[2px] bg-accent transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
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
