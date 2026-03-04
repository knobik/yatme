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

function toggleTileInSelection(
  tiles: { x: number; y: number; z: number }[],
  tile: { x: number; y: number; z: number },
): { x: number; y: number; z: number }[] {
  const idx = tiles.findIndex(t => t.x === tile.x && t.y === tile.y && t.z === tile.z)
  if (idx >= 0) {
    return tiles.filter((_, i) => i !== idx)
  }
  return [...tiles, tile]
}

/** Merge new rectangle tiles into existing selection, deduplicating by position. */
function mergeTileSelections(
  existing: { x: number; y: number; z: number }[],
  newTiles: { x: number; y: number; z: number }[],
): { x: number; y: number; z: number }[] {
  const set = new Set(existing.map(t => `${t.x},${t.y},${t.z}`))
  const merged = [...existing]
  for (const t of newTiles) {
    const key = `${t.x},${t.y},${t.z}`
    if (!set.has(key)) {
      set.add(key)
      merged.push(t)
    }
  }
  return merged
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
  /** Per-item selections (click / Ctrl+Click) */
  selectedItems: SelectedItemInfo[]
  setSelectedItems: (items: SelectedItemInfo[]) => void
  /** Multi-tile selection (shift+drag / Ctrl+Shift+drag) */
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
  onRequestEditItem?: (x: number, y: number, z: number, itemIndex: number) => void,
  clickToInspect: boolean = true,
): EditorToolsState {
  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItemInfo[]>([])
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
  const selectedItemsRef = useRef(selectedItems)
  const selectionRef = useRef(selection)
  const brushSizeRef = useRef(brushSize)
  const brushShapeRef = useRef(brushShape)
  const brushRegistryRef = useRef(brushRegistry)
  const activeDoorTypeRef = useRef(activeDoorType)
  const onRequestEditItemRef = useRef(onRequestEditItem)
  const clickToInspectRef = useRef(clickToInspect)
  activeToolRef.current = activeTool
  selectedItemIdRef.current = selectedItemId
  selectedItemsRef.current = selectedItems
  selectionRef.current = selection
  brushSizeRef.current = brushSize
  brushShapeRef.current = brushShape
  brushRegistryRef.current = brushRegistry
  activeDoorTypeRef.current = activeDoorType
  onRequestEditItemRef.current = onRequestEditItem
  clickToInspectRef.current = clickToInspect

  // Drag state for tools
  const paintedTilesRef = useRef(new Set<string>())
  const selectStartRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const isDraggingRef = useRef(false)
  const isShiftDragRef = useRef(false)
  const isCtrlDragRef = useRef(false)
  // For Ctrl+Shift+Drag: snapshot of selection at drag start to merge with
  const selectionSnapshotRef = useRef<{ x: number; y: number; z: number }[]>([])

  // For drag-move: move selected items by dragging
  const isDragMovingRef = useRef(false)
  const dragMoveOriginRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const dragMoveLastPosRef = useRef<{ x: number; y: number; z: number } | null>(null)

  /** Apply combined highlights from both selectedItems and selection to the renderer. */
  const applyHighlights = (
    r: MapRenderer,
    items: SelectedItemInfo[],
    tiles: { x: number; y: number; z: number }[],
  ) => {
    if (items.length === 0 && tiles.length === 0) {
      r.clearItemHighlight()
    } else if (items.length === 0) {
      r.highlightTiles(tiles)
    } else if (tiles.length === 0 && items.length === 1) {
      r.highlightItem(items[0].x, items[0].y, items[0].z, items[0].itemIndex)
    } else {
      r.highlightCombined(items, tiles)
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

          // Check if clicking an already-selected tile (per-item or multi-tile selection)
          const hasSelectedItem = selectedItemsRef.current.some(
            s => s.x === pos.x && s.y === pos.y && s.z === pos.z
          )
          const hasSelectedTile = selectionRef.current.some(
            s => s.x === pos.x && s.y === pos.y && s.z === pos.z
          )
          const isAlreadySelected = hasSelectedItem || hasSelectedTile

          if (!isAlreadySelected && tile && tile.items.length > 0) {
            // Select top item immediately so drag can begin in same gesture
            const topIdx = tile.items.length - 1
            const newSel: SelectedItemInfo = { x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }
            setSelectedItems([newSel])
            selectedItemsRef.current = [newSel]
            setSelection([])
            selectionRef.current = []
            renderer.highlightItem(pos.x, pos.y, pos.z, topIdx)
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
            applyHighlights(renderer, newItems, selectionRef.current)
          }
        } else if (ctrlKey && event.shiftKey) {
          // Ctrl+Shift: boundbox mode, do NOT clear existing selection (append mode)
          // Snapshot current selection to merge with during drag
          selectionSnapshotRef.current = [...selectionRef.current]
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
            // Collect source tiles from both selection types
            const sourceTiles: { x: number; y: number; z: number }[] = []
            const seen = new Set<string>()
            for (const s of selectedItemsRef.current) {
              const key = `${s.x},${s.y},${s.z}`
              if (!seen.has(key)) { seen.add(key); sourceTiles.push({ x: s.x, y: s.y, z: s.z }) }
            }
            for (const t of selectionRef.current) {
              const key = `${t.x},${t.y},${t.z}`
              if (!seen.has(key)) { seen.add(key); sourceTiles.push(t) }
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

        if (isCtrlDragRef.current) {
          // Ctrl+Shift+Drag: append rectangle to existing selection
          const merged = mergeTileSelections(selectionSnapshotRef.current, rectTiles)
          setSelection(merged)
          selectionRef.current = merged
          // Keep selectedItems, highlight combined
          applyHighlights(renderer, selectedItemsRef.current, merged)
        } else {
          // Shift+Drag: replace selection with rectangle
          setSelectedItems([])
          selectedItemsRef.current = []
          setSelection(rectTiles)
          selectionRef.current = rectTiles
          renderer.highlightTiles(rectTiles)
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

            // Build a unified set of per-item selections to move.
            // If we have multi-tile selection, expand it to per-item (all non-ground items).
            const itemsToMove: SelectedItemInfo[] = [...selectedItemsRef.current]
            const tileSelection = selectionRef.current

            if (tileSelection.length > 0) {
              const alreadyCovered = new Set(
                itemsToMove.map(s => `${s.x},${s.y},${s.z}`)
              )
              for (const tilePos of tileSelection) {
                const key = `${tilePos.x},${tilePos.y},${tilePos.z}`
                if (alreadyCovered.has(key)) continue
                const tile = mapData?.tiles.get(key)
                if (!tile) continue
                // Select all non-ground items (skip index 0 if it's ground)
                for (let i = 0; i < tile.items.length; i++) {
                  itemsToMove.push({ x: tilePos.x, y: tilePos.y, z: tilePos.z, itemIndex: i })
                }
              }
            }

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
            const newSelection: { x: number; y: number; z: number }[] = []

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
              for (const item of removed) {
                mutator.addItem(destX, destY, srcZ, item)
              }

              newSelection.push({ x: destX, y: destY, z: srcZ })
            }

            mutator.commitBatch()

            // Update selection to new positions (use tile selection for multi-tile moves)
            setSelectedItems([])
            selectedItemsRef.current = []
            setSelection(newSelection)
            selectionRef.current = newSelection
            applyHighlights(renderer, [], newSelection)
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
            setSelection([])
            selectionRef.current = []
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
          // Ctrl+Shift+Click (no drag) — toggle entire tile in/out of selection
          const newSelection = toggleTileInSelection(selectionRef.current, pos)
          setSelection(newSelection)
          selectionRef.current = newSelection
          applyHighlights(renderer, selectedItemsRef.current, newSelection)
        }
        // If shift+drag ended, rectangle was already built during move

        selectStartRef.current = null
        isShiftDragRef.current = false
        isCtrlDragRef.current = false
      }
    }

    renderer.onTileHover = (pos) => {
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
      setSelection([])
      selectionRef.current = []

      // Open inspector with edit mode
      renderer.onTileClick?.(tile, pos.x, pos.y)
      renderer.highlightItem(pos.x, pos.y, pos.z, topIdx)
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
      setSelection([])
      selectionRef.current = []
      renderer?.clearItemHighlight()
    }
  }, [activeTool, renderer])

  const undo = useCallback(() => { mutator?.undo() }, [mutator])
  const redo = useCallback(() => { mutator?.redo() }, [mutator])

  const copy = useCallback(() => {
    if (!mapData) return
    const items = selectedItemsRef.current
    const sel = selectionRef.current

    // Build tile list from either selection mode
    let tilesToCopy: { x: number; y: number; z: number }[]
    if (items.length > 0) {
      // Deduplicate tile positions from selected items
      const seen = new Set<string>()
      tilesToCopy = []
      for (const item of items) {
        const key = `${item.x},${item.y},${item.z}`
        if (!seen.has(key)) {
          seen.add(key)
          tilesToCopy.push({ x: item.x, y: item.y, z: item.z })
        }
      }
    } else if (sel.length > 0) {
      tilesToCopy = sel
    } else {
      return
    }

    const minX = Math.min(...tilesToCopy.map(s => s.x))
    const minY = Math.min(...tilesToCopy.map(s => s.y))
    const z = tilesToCopy[0].z
    const tiles: ClipboardData['tiles'] = []
    for (const s of tilesToCopy) {
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
    const items = selectedItemsRef.current
    const sel = selectionRef.current
    // Paste at the selected tile (first selected item or first in selection), or at clipboard origin
    const targetX = items.length > 0 ? items[0].x : sel.length > 0 ? sel[0].x : clipboard.originX
    const targetY = items.length > 0 ? items[0].y : sel.length > 0 ? sel[0].y : clipboard.originY
    const targetZ = renderer.floor

    mutator.beginBatch('Paste')
    for (const t of clipboard.tiles) {
      const tileItems = t.items.map(deepCloneItem)
      mutator.setTileItems(targetX + t.dx, targetY + t.dy, targetZ, tileItems)
      // Update chunk index for any new tiles
      const tile = mutator.getTile(targetX + t.dx, targetY + t.dy, targetZ)
      if (tile) renderer.updateChunkIndex(tile)
    }
    mutator.commitBatch()
  }, [clipboard, mutator, renderer])

  const deleteSelection = useCallback(() => {
    const items = selectedItemsRef.current
    const sel = selectionRef.current
    if (!mutator || !renderer) return
    if (items.length === 0 && sel.length === 0) return

    mutator.beginBatch('Delete selection')

    // Build set of whole-tile positions so we skip per-item removal for those
    const wholeTileSet = new Set(sel.map(s => `${s.x},${s.y},${s.z}`))

    // Clear all items from whole-tile selections
    for (const s of sel) {
      mutator.setTileItems(s.x, s.y, s.z, [])
    }

    // Remove individual ctrl-clicked items (skip tiles already wiped above)
    // Sort by itemIndex descending so indices stay valid during removal
    const itemsToRemove = items
      .filter(i => !wholeTileSet.has(`${i.x},${i.y},${i.z}`))
      .sort((a, b) => {
        const tileCompare = `${a.x},${a.y},${a.z}`.localeCompare(`${b.x},${b.y},${b.z}`)
        if (tileCompare !== 0) return tileCompare
        return b.itemIndex - a.itemIndex // descending
      })
    for (const item of itemsToRemove) {
      mutator.removeItem(item.x, item.y, item.z, item.itemIndex)
    }

    mutator.commitBatch()

    setSelection([])
    selectionRef.current = []
    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
  }, [mutator, renderer, mapData])

  const cut = useCallback(() => {
    copy()
    deleteSelection()
  }, [copy, deleteSelection])

  const selectTiles = useCallback((tiles: { x: number; y: number; z: number }[]) => {
    setSelectedItems([])
    selectedItemsRef.current = []
    setSelection(tiles)
    selectionRef.current = tiles
    renderer?.highlightTiles(tiles)
  }, [renderer])

  return {
    activeTool,
    setActiveTool,
    selectedItemId,
    setSelectedItemId,
    selectedItems,
    setSelectedItems,
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
