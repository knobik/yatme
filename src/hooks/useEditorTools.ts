import { useState, useCallback, useRef, useEffect } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import { type OtbmMap, type OtbmItem, deepCloneItem } from '../lib/otbm'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import { DOOR_NORMAL } from '../lib/brushes/WallTypes'

export type EditorTool = 'select' | 'draw' | 'erase' | 'door'
export type BrushShape = 'square' | 'circle'

export interface SelectedItemInfo {
  x: number
  y: number
  z: number
  itemIndex: number
}

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

function toggleItemInSelection(
  items: SelectedItemInfo[],
  newItem: SelectedItemInfo,
): SelectedItemInfo[] {
  const idx = items.findIndex(i =>
    i.x === newItem.x && i.y === newItem.y && i.z === newItem.z && i.itemIndex === newItem.itemIndex
  )
  if (idx >= 0) {
    return items.filter((_, i) => i !== idx)
  }
  return [...items, newItem]
}

/** Expand tile positions to per-item SelectedItemInfo entries. */
function selectAllItemsOnTiles(
  tiles: { x: number; y: number; z: number }[],
  mapData: OtbmMap,
): SelectedItemInfo[] {
  const result: SelectedItemInfo[] = []
  for (const t of tiles) {
    const tile = mapData.tiles.get(`${t.x},${t.y},${t.z}`)
    if (!tile) continue
    for (let i = 0; i < tile.items.length; i++) {
      result.push({ x: t.x, y: t.y, z: t.z, itemIndex: i })
    }
  }
  return result
}

/** Merge new per-item entries into existing selection, deduplicating. */
function mergeItemSelections(
  existing: SelectedItemInfo[],
  newItems: SelectedItemInfo[],
): SelectedItemInfo[] {
  const set = new Set(existing.map(i => `${i.x},${i.y},${i.z},${i.itemIndex}`))
  const merged = [...existing]
  for (const item of newItems) {
    const key = `${item.x},${item.y},${item.z},${item.itemIndex}`
    if (!set.has(key)) {
      set.add(key)
      merged.push(item)
    }
  }
  return merged
}

/** Derive highlight entries from selectedItems: whole-tile (null) when all items selected, specific indices otherwise. */
export function deriveHighlights(
  items: SelectedItemInfo[],
  mapData: OtbmMap,
): { pos: { x: number; y: number; z: number }; indices: number[] | null }[] {
  if (items.length === 0) return []
  // Group by tile
  const byTile = new Map<string, { pos: { x: number; y: number; z: number }; indices: number[] }>()
  for (const item of items) {
    const key = `${item.x},${item.y},${item.z}`
    let entry = byTile.get(key)
    if (!entry) {
      entry = { pos: { x: item.x, y: item.y, z: item.z }, indices: [] }
      byTile.set(key, entry)
    }
    entry.indices.push(item.itemIndex)
  }
  // Check if all items on each tile are selected
  const result: { pos: { x: number; y: number; z: number }; indices: number[] | null }[] = []
  for (const [key, entry] of byTile) {
    const tile = mapData.tiles.get(key)
    if (tile && entry.indices.length >= tile.items.length) {
      result.push({ pos: entry.pos, indices: null }) // whole tile
    } else {
      result.push({ pos: entry.pos, indices: entry.indices })
    }
  }
  return result
}

export interface ClipboardData {
  originX: number
  originY: number
  z: number
  tiles: { dx: number; dy: number; items: OtbmItem[] }[]
}

function getClipboardFootprint(cb: ClipboardData, targetX: number, targetY: number, targetZ: number): { x: number; y: number; z: number }[] {
  return cb.tiles.map(t => ({ x: targetX + t.dx, y: targetY + t.dy, z: targetZ }))
}

export interface EditorToolsState {
  activeTool: EditorTool
  setActiveTool: (tool: EditorTool) => void
  selectedItemId: number | null
  setSelectedItemId: (id: number | null) => void
  /** Unified per-item selections */
  selectedItems: SelectedItemInfo[]
  setSelectedItems: (items: SelectedItemInfo[]) => void
  /** Whether any items are selected */
  hasSelection: boolean
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
  isPasting: boolean
  cancelPaste: () => void
}

export function useEditorTools(
  renderer: MapRenderer | null,
  mutator: MapMutator | null,
  mapData: OtbmMap | null,
  brushRegistry: BrushRegistry | null = null,
  onRequestEditItem?: (x: number, y: number, z: number, itemIndex: number) => void,
  clickToInspect: boolean = true,
): EditorToolsState {
  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItemInfo[]>([])
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [brushSize, setBrushSize] = useState(0)
  const [brushShape, setBrushShape] = useState<BrushShape>('square')
  const [activeDoorType, setActiveDoorType] = useState<number>(DOOR_NORMAL)
  const [isPasting, setIsPasting] = useState(false)

  // Refs for pointer handling (avoid stale closures)
  const activeToolRef = useRef(activeTool)
  const selectedItemIdRef = useRef(selectedItemId)
  const selectedItemsRef = useRef(selectedItems)
  const brushSizeRef = useRef(brushSize)
  const brushShapeRef = useRef(brushShape)
  const brushRegistryRef = useRef(brushRegistry)
  const activeDoorTypeRef = useRef(activeDoorType)
  const onRequestEditItemRef = useRef(onRequestEditItem)
  const clickToInspectRef = useRef(clickToInspect)
  activeToolRef.current = activeTool
  selectedItemIdRef.current = selectedItemId
  selectedItemsRef.current = selectedItems
  brushSizeRef.current = brushSize
  brushShapeRef.current = brushShape
  brushRegistryRef.current = brushRegistry
  activeDoorTypeRef.current = activeDoorType
  onRequestEditItemRef.current = onRequestEditItem
  clickToInspectRef.current = clickToInspect

  const isPastingRef = useRef(false)
  const clipboardRef = useRef<ClipboardData | null>(null)
  clipboardRef.current = clipboard

  // Drag state for tools
  const paintedTilesRef = useRef(new Set<string>())
  const selectStartRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const isDraggingRef = useRef(false)
  const isShiftDragRef = useRef(false)
  const isCtrlDragRef = useRef(false)
  // For Ctrl+Shift+Drag: snapshot of selectedItems at drag start to merge with
  const selectedItemsSnapshotRef = useRef<SelectedItemInfo[]>([])

  // For drag-move: move selected items by dragging
  const isDragMovingRef = useRef(false)
  const dragMoveOriginRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const dragMoveLastPosRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const hoverPosRef = useRef<{ x: number; y: number; z: number } | null>(null)

  /** Apply highlights from selectedItems to the renderer. */
  const applyHighlights = (r: MapRenderer, items: SelectedItemInfo[]) => {
    if (!mapData) return
    if (items.length === 0) {
      r.clearItemHighlight()
    } else {
      r.setHighlights(deriveHighlights(items, mapData))
    }
  }

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

    renderer.onTilePointerDown = (pos, event) => {
      // Paste preview mode: click commits paste and exits paste mode
      if (isPastingRef.current && clipboardRef.current) {
        executePasteAt(pos.x, pos.y, renderer.floor)
        cancelPaste()
        return
      }

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
        const carpetBrush = !groundBrush && !doorInfo && !wallBrush ? registry?.getCarpetBrushForItem(itemId) ?? null : null
        const tableBrush = !groundBrush && !doorInfo && !wallBrush && !carpetBrush ? registry?.getTableBrushForItem(itemId) ?? null : null
        const doodadBrush = !groundBrush && !doorInfo && !wallBrush && !carpetBrush && !tableBrush ? registry?.getDoodadBrushForItem(itemId) ?? null : null
        mutator.beginBatch(groundBrush ? 'Paint ground' : doorInfo ? 'Place door' : wallBrush ? 'Paint wall' : carpetBrush ? 'Paint carpet' : tableBrush ? 'Paint table' : doodadBrush ? 'Paint doodad' : 'Draw items')
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
          } else if (carpetBrush && registry) {
            mutator.paintCarpet(t.x, t.y, pos.z, carpetBrush, registry)
          } else if (tableBrush && registry) {
            mutator.paintTable(t.x, t.y, pos.z, tableBrush, registry)
          } else if (doodadBrush && registry) {
            if (brushSizeRef.current > 0 && Math.random() * doodadBrush.thicknessCeiling >= doodadBrush.thickness) continue
            mutator.paintDoodad(t.x, t.y, pos.z, doodadBrush, registry)
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
        const ctrlKey = event.ctrlKey || event.metaKey
        selectStartRef.current = pos
        isShiftDragRef.current = event.shiftKey
        isCtrlDragRef.current = ctrlKey

        // Plain click (no modifiers): select top item immediately and begin drag-move
        if (!event.shiftKey && !ctrlKey) {
          const tileKey = `${pos.x},${pos.y},${pos.z}`
          const tile = mapData?.tiles.get(tileKey) ?? null

          // Check if clicking an already-selected tile
          const isAlreadySelected = selectedItemsRef.current.some(
            s => s.x === pos.x && s.y === pos.y && s.z === pos.z
          )

          if (!isAlreadySelected && tile && tile.items.length > 0) {
            // Select top item immediately so drag can begin in same gesture
            const topIdx = tile.items.length - 1
            const newSel: SelectedItemInfo = { x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }
            setSelectedItems([newSel])
            selectedItemsRef.current = [newSel]
            renderer.setHighlights([{ pos: { x: pos.x, y: pos.y, z: pos.z }, indices: [topIdx] }])
          }

          // Begin drag-move if tile has any selection
          if (isAlreadySelected || (tile && tile.items.length > 0)) {
            isDragMovingRef.current = true
            dragMoveOriginRef.current = pos
            dragMoveLastPosRef.current = pos
          }
        }

        if (ctrlKey && !event.shiftKey) {
          // Ctrl+Click: toggle top item in selection (immediate, additive)
          const tileKey = `${pos.x},${pos.y},${pos.z}`
          const tile = mapData?.tiles.get(tileKey) ?? null
          if (tile && tile.items.length > 0) {
            const topIdx = tile.items.length - 1
            const newItem: SelectedItemInfo = { x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }
            const newItems = toggleItemInSelection(selectedItemsRef.current, newItem)
            setSelectedItems(newItems)
            selectedItemsRef.current = newItems
            applyHighlights(renderer, newItems)
          }
        } else if (ctrlKey && event.shiftKey) {
          // Ctrl+Shift: boundbox mode, do NOT clear existing selection (append mode)
          // Snapshot current selectedItems to merge with during drag
          selectedItemsSnapshotRef.current = [...selectedItemsRef.current]
        } else if (event.shiftKey && !ctrlKey) {
          // Shift (no Ctrl): boundbox mode, clear existing selection first
          // (clearing happens naturally as rectangle replaces during move)
        }
        // Plain click (no modifiers): handled in pointerUp
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
        const carpetBrush = !groundBrush && !doorInfo && !wallBrush ? registry?.getCarpetBrushForItem(itemId) ?? null : null
        const tableBrush = !groundBrush && !doorInfo && !wallBrush && !carpetBrush ? registry?.getTableBrushForItem(itemId) ?? null : null
        const doodadBrush = !groundBrush && !doorInfo && !wallBrush && !carpetBrush && !tableBrush ? registry?.getDoodadBrushForItem(itemId) ?? null : null
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
          } else if (carpetBrush && registry) {
            mutator.paintCarpet(t.x, t.y, pos.z, carpetBrush, registry)
          } else if (tableBrush && registry) {
            mutator.paintTable(t.x, t.y, pos.z, tableBrush, registry)
          } else if (doodadBrush && registry) {
            if (brushSizeRef.current > 0 && Math.random() * doodadBrush.thicknessCeiling >= doodadBrush.thickness) continue
            mutator.paintDoodad(t.x, t.y, pos.z, doodadBrush, registry)
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
        // Drag-move: track target position and show ghost preview
        if (isDragMovingRef.current) {
          dragMoveLastPosRef.current = pos
          const origin = dragMoveOriginRef.current
          if (origin) {
            const dx = pos.x - origin.x
            const dy = pos.y - origin.y
            if (dx === 0 && dy === 0) {
              renderer.clearDragPreview()
              return
            }
            // Collect unique source tile positions from selectedItems
            const sourceTiles: { x: number; y: number; z: number }[] = []
            const seen = new Set<string>()
            for (const s of selectedItemsRef.current) {
              const key = `${s.x},${s.y},${s.z}`
              if (!seen.has(key)) { seen.add(key); sourceTiles.push({ x: s.x, y: s.y, z: s.z }) }
            }
            renderer.updateDragPreview(sourceTiles, dx, dy)
          }
          return
        }
        // Plain drag without shift: do nothing
        if (!isShiftDragRef.current) return
        // Shift+drag: rectangle selection
        const start = selectStartRef.current
        if (!start) return
        const minX = Math.min(start.x, pos.x)
        const maxX = Math.max(start.x, pos.x)
        const minY = Math.min(start.y, pos.y)
        const maxY = Math.max(start.y, pos.y)
        const rectTiles: { x: number; y: number; z: number }[] = []
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            rectTiles.push({ x, y, z: pos.z })
          }
        }

        if (mapData) {
          const rectItems = selectAllItemsOnTiles(rectTiles, mapData)
          if (isCtrlDragRef.current) {
            // Ctrl+Shift+Drag: append rectangle to existing selection
            const merged = mergeItemSelections(selectedItemsSnapshotRef.current, rectItems)
            setSelectedItems(merged)
            selectedItemsRef.current = merged
            applyHighlights(renderer, merged)
          } else {
            // Shift+Drag: replace selection with rectangle
            setSelectedItems(rectItems)
            selectedItemsRef.current = rectItems
            applyHighlights(renderer, rectItems)
          }
        }
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
        const wasClick = start && start.x === pos.x && start.y === pos.y
        const ctrlKey = isCtrlDragRef.current
        const shiftKey = isShiftDragRef.current

        // Handle drag-move completion
        if (isDragMovingRef.current) {
          const origin = dragMoveOriginRef.current
          const target = dragMoveLastPosRef.current
          isDragMovingRef.current = false
          dragMoveOriginRef.current = null
          dragMoveLastPosRef.current = null
          renderer.clearDragPreview()

          if (origin && target && (origin.x !== target.x || origin.y !== target.y)) {
            const dx = target.x - origin.x
            const dy = target.y - origin.y

            const itemsToMove = selectedItemsRef.current
            if (itemsToMove.length === 0) {
              selectStartRef.current = null
              isShiftDragRef.current = false
              isCtrlDragRef.current = false
              return
            }

            // Group by source tile, sort indices descending for safe removal
            const byTile = new Map<string, SelectedItemInfo[]>()
            for (const item of itemsToMove) {
              const key = `${item.x},${item.y},${item.z}`
              const list = byTile.get(key) ?? []
              list.push(item)
              byTile.set(key, list)
            }

            mutator.beginBatch('Move items')
            const newItems: SelectedItemInfo[] = []

            for (const [, tileItems] of byTile) {
              // Deduplicate indices and sort descending
              const uniqueIndices = [...new Set(tileItems.map(t => t.itemIndex))].sort((a, b) => b - a)
              const removed: OtbmItem[] = []
              const srcX = tileItems[0].x
              const srcY = tileItems[0].y
              const srcZ = tileItems[0].z

              for (const idx of uniqueIndices) {
                const tileKey = `${srcX},${srcY},${srcZ}`
                const tile = mapData?.tiles.get(tileKey)
                if (!tile || idx >= tile.items.length) continue
                const item = deepCloneItem(tile.items[idx])
                removed.unshift(item) // preserve original order
                mutator.removeItem(srcX, srcY, srcZ, idx)
              }

              // Add items to target tile
              const destX = srcX + dx
              const destY = srcY + dy
              const destKey = `${destX},${destY},${srcZ}`
              const destTile = mapData?.tiles.get(destKey)
              const baseIndex = destTile ? destTile.items.length : 0
              for (let ri = 0; ri < removed.length; ri++) {
                mutator.addItem(destX, destY, srcZ, removed[ri])
                newItems.push({ x: destX, y: destY, z: srcZ, itemIndex: baseIndex + ri })
              }
            }

            mutator.commitBatch()

            // Update selection to new positions - expand to all items on dest tiles
            if (mapData) {
              const destTilePositions: { x: number; y: number; z: number }[] = []
              const seen = new Set<string>()
              for (const item of newItems) {
                const key = `${item.x},${item.y},${item.z}`
                if (!seen.has(key)) { seen.add(key); destTilePositions.push({ x: item.x, y: item.y, z: item.z }) }
              }
              const expandedItems = selectAllItemsOnTiles(destTilePositions, mapData)
              setSelectedItems(expandedItems)
              selectedItemsRef.current = expandedItems
              applyHighlights(renderer, expandedItems)
            }
          }
          // Same tile — selection already happened in pointerDown, just open inspector
          selectStartRef.current = null
          isShiftDragRef.current = false
          isCtrlDragRef.current = false
          if (clickToInspectRef.current) {
            const key = `${pos.x},${pos.y},${pos.z}`
            const tile = mapData?.tiles.get(key) ?? null
            renderer.onTileClick?.(tile, pos.x, pos.y)
          }
          return
        }

        if (wasClick && !shiftKey && !ctrlKey) {
          // Plain click — selection already happened in pointerDown
          // Just open inspector
          const key = `${pos.x},${pos.y},${pos.z}`
          const tile = mapData?.tiles.get(key) ?? null

          // Handle click on empty tile (deselect)
          if (!tile || tile.items.length === 0) {
            setSelectedItems([])
            selectedItemsRef.current = []
            renderer.clearItemHighlight()
          }

          // Open inspector (if click-to-inspect is enabled)
          if (clickToInspectRef.current) {
            renderer.onTileClick?.(tile, pos.x, pos.y)
          }
        } else if (wasClick && ctrlKey && !shiftKey) {
          // Ctrl+Click — already handled in pointerDown (toggle top item)
          if (clickToInspectRef.current) {
            const key = `${pos.x},${pos.y},${pos.z}`
            const tile = mapData?.tiles.get(key) ?? null
            renderer.onTileClick?.(tile, pos.x, pos.y)
          }
        } else if (wasClick && ctrlKey && shiftKey) {
          // Ctrl+Shift+Click (no drag) — toggle all items for tile in/out of selection
          if (mapData) {
            const tileKey = `${pos.x},${pos.y},${pos.z}`
            const tile = mapData.tiles.get(tileKey)
            const tileItemCount = tile?.items.length ?? 0
            // Check if all items on this tile are already selected
            const currentOnTile = selectedItemsRef.current.filter(
              s => s.x === pos.x && s.y === pos.y && s.z === pos.z
            )
            let newItems: SelectedItemInfo[]
            if (currentOnTile.length >= tileItemCount && tileItemCount > 0) {
              // All selected — remove them
              newItems = selectedItemsRef.current.filter(
                s => !(s.x === pos.x && s.y === pos.y && s.z === pos.z)
              )
            } else {
              // Not all selected — add all items for this tile
              const otherItems = selectedItemsRef.current.filter(
                s => !(s.x === pos.x && s.y === pos.y && s.z === pos.z)
              )
              const tileItems: SelectedItemInfo[] = []
              for (let i = 0; i < tileItemCount; i++) {
                tileItems.push({ x: pos.x, y: pos.y, z: pos.z, itemIndex: i })
              }
              newItems = [...otherItems, ...tileItems]
            }
            setSelectedItems(newItems)
            selectedItemsRef.current = newItems
            applyHighlights(renderer, newItems)
          }
        }
        // If shift+drag ended, rectangle was already built during move

        selectStartRef.current = null
        isShiftDragRef.current = false
        isCtrlDragRef.current = false
      }
    }

    renderer.onTileHover = (pos) => {
      hoverPosRef.current = pos

      // Paste preview mode: show clipboard ghost at hover position
      if (isPastingRef.current && clipboardRef.current) {
        const cb = clipboardRef.current
        renderer.updatePastePreview(cb, pos.x, pos.y, renderer.floor)
        renderer.updateBrushCursor(getClipboardFootprint(cb, pos.x, pos.y, renderer.floor))
        renderer.clearGhostPreview()
        return
      }

      const tool = activeToolRef.current
      const size = (tool === 'draw' || tool === 'erase' || tool === 'door') ? brushSizeRef.current : 0
      const shape = brushShapeRef.current
      const tiles = getTilesInBrush(pos.x, pos.y, size, shape)
        .map(t => ({ x: t.x, y: t.y, z: pos.z }))
      renderer.updateBrushCursor(tiles)

      // Ghost sprite preview for draw tool
      if (tool === 'draw') {
        const itemId = selectedItemIdRef.current
        if (itemId != null) {
          const registry = brushRegistryRef.current
          let previewItemId = itemId
          const groundBrush = registry?.getBrushForItem(itemId)
          if (groundBrush && groundBrush.lookId > 0) {
            previewItemId = groundBrush.lookId
          } else if (!groundBrush) {
            const wallBrush = registry?.getWallBrushForItem(itemId)
            if (wallBrush && wallBrush.lookId > 0) {
              previewItemId = wallBrush.lookId
            } else if (!wallBrush) {
              const carpetBrush = registry?.getCarpetBrushForItem(itemId)
              if (carpetBrush && carpetBrush.lookId > 0) {
                previewItemId = carpetBrush.lookId
              } else if (!carpetBrush) {
                const tableBrush = registry?.getTableBrushForItem(itemId)
                if (tableBrush && tableBrush.lookId > 0) {
                  previewItemId = tableBrush.lookId
                } else if (!tableBrush) {
                  const doodadBrush = registry?.getDoodadBrushForItem(itemId)
                  if (doodadBrush && doodadBrush.lookId > 0) {
                    previewItemId = doodadBrush.lookId
                  }
                }
              }
            }
          }
          renderer.updateGhostPreview(previewItemId, tiles)
        } else {
          renderer.clearGhostPreview()
        }
      } else {
        renderer.clearGhostPreview()
      }
    }

    renderer.onTileDoubleClick = (pos, _event) => {
      if (activeToolRef.current !== 'select') return
      const key = `${pos.x},${pos.y},${pos.z}`
      const tile = mapData?.tiles.get(key) ?? null
      if (!tile || tile.items.length === 0) return
      const topIdx = tile.items.length - 1

      // Select the top item
      const newSel: SelectedItemInfo = { x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }
      setSelectedItems([newSel])
      selectedItemsRef.current = [newSel]

      // Open inspector with edit mode
      renderer.onTileClick?.(tile, pos.x, pos.y)
      renderer.setHighlights([{ pos: { x: pos.x, y: pos.y, z: pos.z }, indices: [topIdx] }])
      onRequestEditItemRef.current?.(pos.x, pos.y, pos.z, topIdx)
    }

    return () => {
      renderer.onTilePointerDown = undefined
      renderer.onTilePointerMove = undefined
      renderer.onTilePointerUp = undefined
      renderer.onTileDoubleClick = undefined
      renderer.onTileHover = undefined
      renderer.clearGhostPreview()
    }
  }, [renderer, mutator, mapData, brushRegistry])

  // Update cursor when tool changes
  useEffect(() => {
    if (!renderer) return
    switch (activeTool) {
      case 'select': renderer.setCursorStyle('default'); renderer.clearGhostPreview(); break
      case 'draw': renderer.setCursorStyle('crosshair'); break
      case 'erase': renderer.setCursorStyle('crosshair'); renderer.clearGhostPreview(); break
      case 'door': renderer.setCursorStyle('crosshair'); renderer.clearGhostPreview(); break
    }
  }, [renderer, activeTool])

  // Clear ghost when selected item changes (re-resolved on next hover)
  useEffect(() => {
    if (!renderer || activeTool !== 'draw') return
    renderer.clearGhostPreview()
  }, [renderer, selectedItemId, activeTool])

  // Clear selections when switching away from select tool
  useEffect(() => {
    if (activeTool !== 'select') {
      setSelectedItems([])
      selectedItemsRef.current = []
      renderer?.clearItemHighlight()
    }
    // Cancel paste mode on any tool change
    if (isPastingRef.current) {
      cancelPaste()
    }
  }, [activeTool, renderer])

  const undo = useCallback(() => { mutator?.undo() }, [mutator])
  const redo = useCallback(() => { mutator?.redo() }, [mutator])

  const copy = useCallback(() => {
    if (!mapData) return
    const items = selectedItemsRef.current
    if (items.length === 0) return

    // Group selected items by tile
    const byTile = new Map<string, { pos: { x: number; y: number; z: number }; indices: Set<number> }>()
    for (const item of items) {
      const key = `${item.x},${item.y},${item.z}`
      let entry = byTile.get(key)
      if (!entry) {
        entry = { pos: { x: item.x, y: item.y, z: item.z }, indices: new Set() }
        byTile.set(key, entry)
      }
      entry.indices.add(item.itemIndex)
    }

    const positions = [...byTile.values()].map(e => e.pos)
    const minX = Math.min(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const z = positions[0].z
    const tiles: ClipboardData['tiles'] = []

    for (const [key, entry] of byTile) {
      const tile = mapData.tiles.get(key)
      if (tile && tile.items.length > 0) {
        const copiedItems = tile.items
          .filter((_, i) => entry.indices.has(i))
          .map(deepCloneItem)
        if (copiedItems.length > 0) {
          tiles.push({
            dx: entry.pos.x - minX,
            dy: entry.pos.y - minY,
            items: copiedItems,
          })
        }
      }
    }
    if (tiles.length > 0) {
      setClipboard({ originX: minX, originY: minY, z, tiles })
    }
  }, [mapData])

  const cancelPaste = useCallback(() => {
    isPastingRef.current = false
    setIsPasting(false)
    renderer?.clearDragPreview()
    renderer?.updateBrushCursor([])
  }, [renderer])

  const executePasteAt = useCallback((targetX: number, targetY: number, targetZ: number) => {
    const cb = clipboardRef.current
    if (!cb || !mutator || !renderer || !mapData) return
    mutator.beginBatch('Paste')
    const pastedTilePositions: { x: number; y: number; z: number }[] = []
    for (const t of cb.tiles) {
      const tx = targetX + t.dx
      const ty = targetY + t.dy
      mutator.mergePasteItems(tx, ty, targetZ, t.items)
      const tile = mutator.getTile(tx, ty, targetZ)
      if (tile) renderer.updateChunkIndex(tile)
      pastedTilePositions.push({ x: tx, y: ty, z: targetZ })
    }
    mutator.commitBatch()

    // Select the pasted tiles (expand to per-item)
    const pastedItems = selectAllItemsOnTiles(pastedTilePositions, mapData)
    setSelectedItems(pastedItems)
    selectedItemsRef.current = pastedItems
    applyHighlights(renderer, pastedItems)
  }, [mutator, renderer, mapData])

  const paste = useCallback(() => {
    if (!clipboard || !renderer) return
    // Toggle paste preview mode
    if (isPastingRef.current) {
      cancelPaste()
      return
    }
    isPastingRef.current = true
    setIsPasting(true)
    // Clear current selection highlights
    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
    // Show preview at current hover position immediately
    const hover = hoverPosRef.current
    if (hover) {
      renderer.updatePastePreview(clipboard, hover.x, hover.y, renderer.floor)
      renderer.updateBrushCursor(getClipboardFootprint(clipboard, hover.x, hover.y, renderer.floor))
    }
  }, [clipboard, renderer, cancelPaste])

  const deleteSelection = useCallback(() => {
    const items = selectedItemsRef.current
    if (!mutator || !renderer || !mapData) return
    if (items.length === 0) return

    mutator.beginBatch('Delete selection')

    // Group by tile, sort indices descending per tile for safe removal
    const byTile = new Map<string, SelectedItemInfo[]>()
    for (const item of items) {
      const key = `${item.x},${item.y},${item.z}`
      const list = byTile.get(key) ?? []
      list.push(item)
      byTile.set(key, list)
    }

    for (const [key, tileItems] of byTile) {
      const tile = mapData.tiles.get(key)
      if (!tile) continue
      // Check if all items on tile are selected → wipe whole tile
      if (tileItems.length >= tile.items.length) {
        mutator.setTileItems(tileItems[0].x, tileItems[0].y, tileItems[0].z, [])
      } else {
        // Remove individual items, descending index order
        const indices = [...new Set(tileItems.map(t => t.itemIndex))].sort((a, b) => b - a)
        for (const idx of indices) {
          mutator.removeItem(tileItems[0].x, tileItems[0].y, tileItems[0].z, idx)
        }
      }
    }

    mutator.commitBatch()

    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
  }, [mutator, renderer, mapData])

  const cut = useCallback(() => {
    copy()
    deleteSelection()
  }, [copy, deleteSelection])

  const selectTiles = useCallback((tiles: { x: number; y: number; z: number }[]) => {
    if (!mapData) {
      setSelectedItems([])
      selectedItemsRef.current = []
      renderer?.clearItemHighlight()
      return
    }
    const items = selectAllItemsOnTiles(tiles, mapData)
    setSelectedItems(items)
    selectedItemsRef.current = items
    if (renderer) applyHighlights(renderer, items)
  }, [renderer, mapData])

  return {
    activeTool,
    setActiveTool,
    selectedItemId,
    setSelectedItemId,
    selectedItems,
    setSelectedItems,
    hasSelection: selectedItems.length > 0,
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
    isPasting,
    cancelPaste,
  }
}
