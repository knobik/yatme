import { useState, useCallback, useRef, useEffect } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import type { OtbmMap, OtbmItem } from '../lib/otbm'

export type EditorTool = 'select' | 'draw' | 'erase'

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
  paste: () => void
  deleteSelection: () => void
}

function deepCloneItem(item: OtbmItem): OtbmItem {
  const clone: OtbmItem = { id: item.id }
  if (item.count != null) clone.count = item.count
  if (item.actionId != null) clone.actionId = item.actionId
  if (item.uniqueId != null) clone.uniqueId = item.uniqueId
  if (item.text != null) clone.text = item.text
  if (item.description != null) clone.description = item.description
  if (item.teleportDestination) clone.teleportDestination = { ...item.teleportDestination }
  if (item.depotId != null) clone.depotId = item.depotId
  if (item.houseDoorId != null) clone.houseDoorId = item.houseDoorId
  if (item.charges != null) clone.charges = item.charges
  if (item.duration != null) clone.duration = item.duration
  if (item.items && item.items.length > 0) clone.items = item.items.map(deepCloneItem)
  return clone
}

export function useEditorTools(
  renderer: MapRenderer | null,
  mutator: MapMutator | null,
  mapData: OtbmMap | null,
): EditorToolsState {
  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [selection, setSelection] = useState<{ x: number; y: number; z: number }[]>([])
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Refs for pointer handling (avoid stale closures)
  const activeToolRef = useRef(activeTool)
  const selectedItemIdRef = useRef(selectedItemId)
  const selectionRef = useRef(selection)
  activeToolRef.current = activeTool
  selectedItemIdRef.current = selectedItemId
  selectionRef.current = selection

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
        mutator.beginBatch('Draw items')
        const key = `${pos.x},${pos.y}`
        paintedTilesRef.current.add(key)
        mutator.addItem(pos.x, pos.y, pos.z, { id: itemId })
        mutator.flushChunkUpdates()
      } else if (tool === 'erase') {
        paintedTilesRef.current.clear()
        mutator.beginBatch('Erase items')
        const key = `${pos.x},${pos.y}`
        paintedTilesRef.current.add(key)
        mutator.removeTopItem(pos.x, pos.y, pos.z)
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
        const key = `${pos.x},${pos.y}`
        if (paintedTilesRef.current.has(key)) return
        paintedTilesRef.current.add(key)
        mutator.addItem(pos.x, pos.y, pos.z, { id: itemId })
        mutator.flushChunkUpdates()
      } else if (tool === 'erase') {
        const key = `${pos.x},${pos.y}`
        if (paintedTilesRef.current.has(key)) return
        paintedTilesRef.current.add(key)
        mutator.removeTopItem(pos.x, pos.y, pos.z)
        mutator.flushChunkUpdates()
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

      if (tool === 'draw' || tool === 'erase') {
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
  }, [renderer, mutator, mapData])

  // Update cursor when tool changes
  useEffect(() => {
    if (!renderer) return
    switch (activeTool) {
      case 'select': renderer.setCursorStyle('default'); break
      case 'draw': renderer.setCursorStyle('crosshair'); break
      case 'erase': renderer.setCursorStyle('crosshair'); break
    }
  }, [renderer, activeTool])

  const undo = useCallback(() => { mutator?.undo() }, [mutator])
  const redo = useCallback(() => { mutator?.redo() }, [mutator])

  const copy = useCallback(() => {
    if (!mapData || selection.length === 0) return
    const minX = Math.min(...selection.map(s => s.x))
    const minY = Math.min(...selection.map(s => s.y))
    const z = selection[0].z
    const tiles: ClipboardData['tiles'] = []
    for (const s of selection) {
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
  }, [mapData, selection])

  const paste = useCallback(() => {
    if (!clipboard || !mutator || !renderer) return
    // Paste at the first selected tile, or at clipboard origin if no selection
    const targetX = selection.length > 0 ? selection[0].x : clipboard.originX
    const targetY = selection.length > 0 ? selection[0].y : clipboard.originY
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
  }, [clipboard, mutator, renderer, selection])

  const deleteSelection = useCallback(() => {
    if (!mutator || !renderer || selection.length === 0) return
    mutator.beginBatch('Delete selection')
    for (const s of selection) {
      mutator.setTileItems(s.x, s.y, s.z, [])
    }
    mutator.commitBatch()
    setSelection([])
    renderer.clearSelectionOverlay()
  }, [mutator, renderer, selection])

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
    paste,
    deleteSelection,
  }
}
