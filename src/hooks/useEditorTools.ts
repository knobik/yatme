import { useState, useCallback, useRef, useEffect } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import { type OtbmMap, type OtbmItem, deepCloneItem } from '../lib/otbm'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import { DOOR_NORMAL } from '../lib/brushes/WallTypes'

export type EditorTool = 'select' | 'draw' | 'erase' | 'door'
export type BrushShape = 'square' | 'circle'

function getTilesInBrush(cx: number, cy: number, size: number, shape: BrushShape): { x: number; y: number }[] {
  if (size === 0) return [{ x: cx, y: cy }]
  const tiles: { x: number; y: number }[] = []
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      if (shape === 'square' || Math.sqrt(dx * dx + dy * dy) < size + 0.005) {
        tiles.push({ x: cx + dx, y: cy + dy })
      }
    }
  }
  return tiles
}

export interface ClipboardData {
  originX: number
  originY: number
  z: number
  tiles: { dx: number; dy: number; items: OtbmItem[] }[]
}

export interface EditorToolsState {
  activeTool: EditorTool
  setActiveTool: (tool: EditorTool) => void
  selectedItemId: number | null
  setSelectedItemId: (id: number | null) => void
  selection: { x: number; y: number; z: number }[]
  clipboard: ClipboardData | null
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  copy: () => void
  cut: () => void
  paste: () => void
  deleteSelection: () => void
  selectTiles: (tiles: { x: number; y: number; z: number }[]) => void
  brushSize: number
  setBrushSize: (size: number) => void
  brushShape: BrushShape
  setBrushShape: (shape: BrushShape) => void
  activeDoorType: number
  setActiveDoorType: (type: number) => void
}

export function useEditorTools(
  renderer: MapRenderer | null,
  mutator: MapMutator | null,
  mapData: OtbmMap | null,
  brushRegistry: BrushRegistry | null = null,
): EditorToolsState {
  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [selection, setSelection] = useState<{ x: number; y: number; z: number }[]>([])
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [brushSize, setBrushSize] = useState(0)
  const [brushShape, setBrushShape] = useState<BrushShape>('square')
  const [activeDoorType, setActiveDoorType] = useState<number>(DOOR_NORMAL)

  // Refs for pointer handling (avoid stale closures)
  const activeToolRef = useRef(activeTool)
  const selectedItemIdRef = useRef(selectedItemId)
  const selectionRef = useRef(selection)
  const brushSizeRef = useRef(brushSize)
  const brushShapeRef = useRef(brushShape)
  const brushRegistryRef = useRef(brushRegistry)
  const activeDoorTypeRef = useRef(activeDoorType)
  activeToolRef.current = activeTool
  selectedItemIdRef.current = selectedItemId
  selectionRef.current = selection
  brushSizeRef.current = brushSize
  brushShapeRef.current = brushShape
  brushRegistryRef.current = brushRegistry
  activeDoorTypeRef.current = activeDoorType

  // Drag state for tools
  const paintedTilesRef = useRef(new Set<string>())
  const selectStartRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const isDraggingRef = useRef(false)

  // Wire up mutator undo/redo callback
  useEffect(() => {
    if (!mutator) return
    mutator.onUndoRedoChanged = (u, r) => {
      setCanUndo(u)
      setCanRedo(r)
    }
  }, [mutator])

  // Wire up renderer pointer callbacks
  useEffect(() => {
    if (!renderer || !mutator) return

    renderer.onTilePointerDown = (pos, _event) => {
      const tool = activeToolRef.current
      isDraggingRef.current = true

      if (tool === 'draw') {
        const itemId = selectedItemIdRef.current
        if (itemId == null) return
        paintedTilesRef.current.clear()
        const registry = brushRegistryRef.current
        const groundBrush = registry?.getBrushForItem(itemId) ?? null
        const doorInfo = !groundBrush ? registry?.getDoorInfo(itemId) ?? null : null
        const wallBrush = !groundBrush && !doorInfo ? registry?.getWallBrushForItem(itemId) ?? null : null
        mutator.beginBatch(groundBrush ? 'Paint ground' : doorInfo ? 'Place door' : wallBrush ? 'Paint wall' : 'Draw items')
        const tiles = getTilesInBrush(pos.x, pos.y, brushSizeRef.current, brushShapeRef.current)
        for (const t of tiles) {
          const key = `${t.x},${t.y}`
          paintedTilesRef.current.add(key)
          if (groundBrush && registry) {
            mutator.paintGround(t.x, t.y, pos.z, groundBrush, registry)
          } else if (doorInfo && registry) {
            mutator.paintDoor(t.x, t.y, pos.z, doorInfo.type, registry)
          } else if (wallBrush && registry) {
            mutator.paintWall(t.x, t.y, pos.z, wallBrush, registry)
          } else {
            mutator.addItem(t.x, t.y, pos.z, { id: itemId })
          }
        }
        mutator.flushChunkUpdates()
      } else if (tool === 'erase') {
        paintedTilesRef.current.clear()
        mutator.beginBatch('Erase items')
        const tiles = getTilesInBrush(pos.x, pos.y, brushSizeRef.current, brushShapeRef.current)
        for (const t of tiles) {
          const key = `${t.x},${t.y}`
          paintedTilesRef.current.add(key)
          mutator.removeTopItem(t.x, t.y, pos.z)
        }
        mutator.flushChunkUpdates()
      } else if (tool === 'door') {
        const registry = brushRegistryRef.current
        if (!registry) return
        const doorType = activeDoorTypeRef.current
        paintedTilesRef.current.clear()
        mutator.beginBatch('Place door')
        const tiles = getTilesInBrush(pos.x, pos.y, brushSizeRef.current, brushShapeRef.current)
        for (const t of tiles) {
          const key = `${t.x},${t.y}`
          paintedTilesRef.current.add(key)
          mutator.paintDoor(t.x, t.y, pos.z, doorType, registry)
        }
        mutator.flushChunkUpdates()
      } else if (tool === 'select') {
        selectStartRef.current = pos
      }
    }

    renderer.onTilePointerMove = (pos, _event) => {
      const tool = activeToolRef.current
      if (!isDraggingRef.current) return

      if (tool === 'draw') {
        const itemId = selectedItemIdRef.current
        if (itemId == null) return
        const registry = brushRegistryRef.current
        const groundBrush = registry?.getBrushForItem(itemId) ?? null
        const doorInfo = !groundBrush ? registry?.getDoorInfo(itemId) ?? null : null
        const wallBrush = !groundBrush && !doorInfo ? registry?.getWallBrushForItem(itemId) ?? null : null
        const tiles = getTilesInBrush(pos.x, pos.y, brushSizeRef.current, brushShapeRef.current)
        let any = false
        for (const t of tiles) {
          const key = `${t.x},${t.y}`
          if (paintedTilesRef.current.has(key)) continue
          paintedTilesRef.current.add(key)
          if (groundBrush && registry) {
            mutator.paintGround(t.x, t.y, pos.z, groundBrush, registry)
          } else if (doorInfo && registry) {
            mutator.paintDoor(t.x, t.y, pos.z, doorInfo.type, registry)
          } else if (wallBrush && registry) {
            mutator.paintWall(t.x, t.y, pos.z, wallBrush, registry)
          } else {
            mutator.addItem(t.x, t.y, pos.z, { id: itemId })
          }
          any = true
        }
        if (any) mutator.flushChunkUpdates()
      } else if (tool === 'erase') {
        const tiles = getTilesInBrush(pos.x, pos.y, brushSizeRef.current, brushShapeRef.current)
        let any = false
        for (const t of tiles) {
          const key = `${t.x},${t.y}`
          if (paintedTilesRef.current.has(key)) continue
          paintedTilesRef.current.add(key)
          mutator.removeTopItem(t.x, t.y, pos.z)
          any = true
        }
        if (any) mutator.flushChunkUpdates()
      } else if (tool === 'door') {
        const registry = brushRegistryRef.current
        if (!registry) return
        const doorType = activeDoorTypeRef.current
        const tiles = getTilesInBrush(pos.x, pos.y, brushSizeRef.current, brushShapeRef.current)
        let any = false
        for (const t of tiles) {
          const key = `${t.x},${t.y}`
          if (paintedTilesRef.current.has(key)) continue
          paintedTilesRef.current.add(key)
          mutator.paintDoor(t.x, t.y, pos.z, doorType, registry)
          any = true
        }
        if (any) mutator.flushChunkUpdates()
      } else if (tool === 'select') {
        const start = selectStartRef.current
        if (!start) return
        const minX = Math.min(start.x, pos.x)
        const maxX = Math.max(start.x, pos.x)
        const minY = Math.min(start.y, pos.y)
        const maxY = Math.max(start.y, pos.y)
        const tiles: { x: number; y: number; z: number }[] = []
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            tiles.push({ x, y, z: pos.z })
          }
        }
        setSelection(tiles)
        renderer.updateSelectionOverlay(tiles)
      }
    }

    renderer.onTilePointerUp = (pos, _event) => {
      const tool = activeToolRef.current
      isDraggingRef.current = false

      if (tool === 'draw' || tool === 'erase' || tool === 'door') {
        paintedTilesRef.current.clear()
        mutator.commitBatch()
      } else if (tool === 'select') {
        const start = selectStartRef.current
        if (start && start.x === pos.x && start.y === pos.y) {
          // Single click in select mode — select single tile + open inspector
          const key = `${pos.x},${pos.y},${pos.z}`
          const tile = mapData?.tiles.get(key) ?? null
          renderer.onTileClick?.(tile, pos.x, pos.y)
          setSelection([{ x: pos.x, y: pos.y, z: pos.z }])
          renderer.updateSelectionOverlay([{ x: pos.x, y: pos.y, z: pos.z }])
        }
        selectStartRef.current = null
      }
    }

    return () => {
      renderer.onTilePointerDown = undefined
      renderer.onTilePointerMove = undefined
      renderer.onTilePointerUp = undefined
    }
  }, [renderer, mutator, mapData, brushRegistry])

  // Update cursor when tool changes
  useEffect(() => {
    if (!renderer) return
    switch (activeTool) {
      case 'select': renderer.setCursorStyle('default'); break
      case 'draw': renderer.setCursorStyle('crosshair'); break
      case 'erase': renderer.setCursorStyle('crosshair'); break
      case 'door': renderer.setCursorStyle('crosshair'); break
    }
  }, [renderer, activeTool])

  const undo = useCallback(() => { mutator?.undo() }, [mutator])
  const redo = useCallback(() => { mutator?.redo() }, [mutator])

  const copy = useCallback(() => {
    const sel = selectionRef.current
    if (!mapData || sel.length === 0) return
    const minX = Math.min(...sel.map(s => s.x))
    const minY = Math.min(...sel.map(s => s.y))
    const z = sel[0].z
    const tiles: ClipboardData['tiles'] = []
    for (const s of sel) {
      const tile = mapData.tiles.get(`${s.x},${s.y},${s.z}`)
      if (tile && tile.items.length > 0) {
        tiles.push({
          dx: s.x - minX,
          dy: s.y - minY,
          items: tile.items.map(deepCloneItem),
        })
      }
    }
    if (tiles.length > 0) {
      setClipboard({ originX: minX, originY: minY, z, tiles })
    }
  }, [mapData])

  const paste = useCallback(() => {
    if (!clipboard || !mutator || !renderer) return
    const sel = selectionRef.current
    // Paste at the first selected tile, or at clipboard origin if no selection
    const targetX = sel.length > 0 ? sel[0].x : clipboard.originX
    const targetY = sel.length > 0 ? sel[0].y : clipboard.originY
    const targetZ = renderer.floor

    mutator.beginBatch('Paste')
    for (const t of clipboard.tiles) {
      const items = t.items.map(deepCloneItem)
      mutator.setTileItems(targetX + t.dx, targetY + t.dy, targetZ, items)
      // Update chunk index for any new tiles
      const tile = mutator.getTile(targetX + t.dx, targetY + t.dy, targetZ)
      if (tile) renderer.updateChunkIndex(tile)
    }
    mutator.commitBatch()
  }, [clipboard, mutator, renderer])

  const deleteSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!mutator || !renderer || sel.length === 0) return
    mutator.beginBatch('Delete selection')
    for (const s of sel) {
      mutator.setTileItems(s.x, s.y, s.z, [])
    }
    mutator.commitBatch()
    setSelection([])
    selectionRef.current = []
    renderer.clearSelectionOverlay()
  }, [mutator, renderer])

  const cut = useCallback(() => {
    copy()
    deleteSelection()
  }, [copy, deleteSelection])

  const selectTiles = useCallback((tiles: { x: number; y: number; z: number }[]) => {
    setSelection(tiles)
    selectionRef.current = tiles
    renderer?.updateSelectionOverlay(tiles)
  }, [renderer])

  return {
    activeTool,
    setActiveTool,
    selectedItemId,
    setSelectedItemId,
    selection,
    clipboard,
    canUndo,
    canRedo,
    undo,
    redo,
    copy,
    cut,
    paste,
    deleteSelection,
    selectTiles,
    brushSize,
    setBrushSize,
    brushShape,
    setBrushShape,
    activeDoorType,
    setActiveDoorType,
  }
}
