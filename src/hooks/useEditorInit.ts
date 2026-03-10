import { useEffect, useRef, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { Application } from 'pixi.js'
import { loadAssets } from '../lib/initPipeline'
import { setupEditor } from '../lib/setupEditor'
import { StaticFileProvider, ServerStorageProvider, type MapStorageProvider } from '../lib/storage'
import { loadSettings } from '../lib/EditorSettings'
import { deepCloneItem } from '../lib/otbm'
import { MapRenderer, type FloorViewMode } from '../lib/MapRenderer'
import { MapMutator } from '../lib/MapMutator'
import type { AppearanceData } from '../lib/appearances'
import type { OtbmMap } from '../lib/otbm'
import type { ItemRegistry } from '../lib/items'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import type { ResolvedTileset } from '../lib/tilesets/TilesetTypes'
import type { MapSidecars } from '../lib/sidecars'
import type { EditorToolsState } from './useEditorTools'
import type { ContextMenuState } from './useContextMenu'

export interface CameraState {
  x: number
  y: number
  zoom: number
  floor: number
  floorViewMode: FloorViewMode
  showTransparentUpper: boolean
}

export interface UseEditorInitOptions {
  // Loading state setters
  setLoadingStatus: (status: string) => void
  setLoadingProgress: (progress: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Data state setters
  setAppearancesData: (data: AppearanceData) => void
  setItemRegistry: (registry: ItemRegistry) => void
  setMapInfo: (info: { tiles: number; towns: string[] }) => void
  setBrushRegistryState: (registry: BrushRegistry) => void
  setTilesets: (tilesets: ResolvedTileset[]) => void
  setMapFilename: (filename: string) => void
  setMapData: (data: OtbmMap) => void
  setSidecarsData: Dispatch<SetStateAction<MapSidecars>>
  setRendererReady: (renderer: MapRenderer) => void
  setMutatorReady: (mutator: MapMutator) => void

  // UI state setters
  setCamera: (camera: CameraState) => void
  setSelectedTilePos: (pos: { x: number; y: number; z: number } | null) => void
  setContextMenu: (menu: ContextMenuState | null) => void
  setTileVersion: Dispatch<SetStateAction<number>>

  // House exit placement
  setPlacingHouseExit: (id: number | null) => void
  placingHouseExitRef: RefObject<number | null>

  // Tools ref for accessing current tools state in callbacks
  toolsRef: RefObject<EditorToolsState>
}

export function useEditorInit(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseEditorInitOptions,
) {
  const rendererRef = useRef<MapRenderer | null>(null)
  const mutatorRef = useRef<MapMutator | null>(null)
  const appRef = useRef<Application | null>(null)
  const storageRef = useRef<MapStorageProvider | null>(null)

  const {
    setLoadingStatus,
    setLoadingProgress,
    setLoading,
    setError,
    setAppearancesData,
    setItemRegistry,
    setMapInfo,
    setBrushRegistryState,
    setTilesets,
    setMapFilename,
    setMapData,
    setSidecarsData,
    setRendererReady,
    setMutatorReady,
    setCamera,
    setSelectedTilePos,
    setContextMenu,
    setTileVersion,
    setPlacingHouseExit,
    placingHouseExitRef,
    toolsRef,
  } = options

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const signal = { destroyed: false }
    let appInstance: Application | null = null

    async function init() {
      const mapFile = import.meta.env.VITE_MAP_FILE as string | undefined
      const provider: MapStorageProvider = import.meta.env.VITE_STORAGE === 'static'
        ? new StaticFileProvider(mapFile)
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

      renderer.onTileClick = (tile) => {
        if (tile) {
          setSelectedTilePos({ x: tile.x, y: tile.y, z: tile.z })
        } else {
          setSelectedTilePos(null)
          toolsRef.current.setSelectedItems([])
        }
      }

      // House exit placement intercept
      const origOnTileClick = renderer.onTileClick
      renderer.onTileClick = (tile, worldX, worldY) => {
        const exitHouseId = placingHouseExitRef.current
        if (exitHouseId != null && tile) {
          setSidecarsData(prev => ({
            ...prev,
            houses: prev.houses.map(h =>
              h.id === exitHouseId
                ? { ...h, entryX: tile.x, entryY: tile.y, entryZ: tile.z }
                : h
            ),
          }))
          setPlacingHouseExit(null)
          return
        }
        origOnTileClick?.(tile, worldX, worldY)
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
      renderer.setShowHouseOverlay(savedSettings.showHouseOverlay)

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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { rendererRef, mutatorRef, appRef, storageRef }
}
