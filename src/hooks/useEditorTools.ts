import { useState, useCallback, useRef, useEffect } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import type { OtbmMap } from '../lib/otbm'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import { DOOR_NORMAL } from '../lib/brushes/WallTypes'
import type { SelectedItemInfo } from './useSelection'
import { useSelection } from './useSelection'
import { useClipboard } from './useClipboard'
import type { EditorSettings } from '../lib/EditorSettings'
import type { HouseData } from '../lib/sidecars'
import type { EditorTool, BrushShape, BrushSelection, ToolContext, TilePos, ZoneSelection } from './tools/types'
import { createDrawHandlers } from './tools/drawTool'
import { createEraseHandlers } from './tools/eraseTool'
import { createDoorHandlers } from './tools/doorTool'
import { createSelectHandlers } from './tools/selectTool'
import { createFillHandlers } from './tools/fillTool'
import { createZoneHandlers } from './tools/zoneTool'
import { createHouseHandlers } from './tools/houseTool'
import { createHoverHandler } from './tools/hoverHandler'

// Re-export types for consumers
export type { EditorTool, BrushShape, BrushSelection, TilePos, ZoneSelection }
export type { HouseData }
export type { SelectedItemInfo }
export { deriveHighlights } from './useSelection'

export interface EditorToolsState {
  activeTool: EditorTool
  setActiveTool: (tool: EditorTool) => void
  selectedBrush: BrushSelection | null
  setSelectedBrush: (brush: BrushSelection | null) => void
  selectedItems: SelectedItemInfo[]
  setSelectedItems: (items: SelectedItemInfo[]) => void
  hasSelection: boolean
  canPaste: boolean
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
  selectedZone: ZoneSelection | null
  setSelectedZone: (zone: ZoneSelection | null) => void
  selectedHouse: HouseData | null
  setSelectedHouse: (house: HouseData | null) => void
  cursorPos: { x: number; y: number; z: number } | null
}

export function useEditorTools(
  renderer: MapRenderer | null,
  mutator: MapMutator | null,
  mapData: OtbmMap | null,
  brushRegistry: BrushRegistry | null,
  onRequestEditItem: ((x: number, y: number, z: number, itemIndex: number) => void) | undefined,
  clickToInspect: boolean,
  settingsRef: React.MutableRefObject<EditorSettings>,
): EditorToolsState {
  // ── Tool & brush config state ────────────────────────────────────
  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [selectedBrush, setSelectedBrush] = useState<BrushSelection | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [brushSize, setBrushSize] = useState(0)
  const [brushShape, setBrushShape] = useState<BrushShape>('square')
  const [activeDoorType, setActiveDoorType] = useState<number>(DOOR_NORMAL)
  const [selectedZone, setSelectedZone] = useState<ZoneSelection | null>(null)
  const [selectedHouse, setSelectedHouse] = useState<HouseData | null>(null)

  // ── Refs (avoid stale closures in pointer handlers) ──────────────
  const activeToolRef = useRef(activeTool)
  const selectedBrushRef = useRef(selectedBrush)
  const brushSizeRef = useRef(brushSize)
  const brushShapeRef = useRef(brushShape)
  const brushRegistryRef = useRef(brushRegistry)
  const activeDoorTypeRef = useRef(activeDoorType)
  const selectedZoneRef = useRef(selectedZone)
  const selectedHouseRef = useRef<number | null>(selectedHouse?.id ?? null)
  const onRequestEditItemRef = useRef(onRequestEditItem)
  const clickToInspectRef = useRef(clickToInspect)
  useEffect(() => {
    activeToolRef.current = activeTool
    selectedBrushRef.current = selectedBrush
    brushSizeRef.current = brushSize
    brushShapeRef.current = brushShape
    brushRegistryRef.current = brushRegistry
    activeDoorTypeRef.current = activeDoorType
    selectedZoneRef.current = selectedZone
    selectedHouseRef.current = selectedHouse?.id ?? null
    onRequestEditItemRef.current = onRequestEditItem
    clickToInspectRef.current = clickToInspect
  })

  // Drag state refs
  const paintedTilesRef = useRef(new Set<string>())
  const isDraggingRef = useRef(false)
  const selectStartRef = useRef<TilePos | null>(null)
  const isShiftDragRef = useRef(false)
  const isCtrlDragRef = useRef(false)
  const selectedItemsSnapshotRef = useRef<SelectedItemInfo[]>([])
  const isDragMovingRef = useRef(false)
  const dragMoveOriginRef = useRef<TilePos | null>(null)
  const dragMoveLastPosRef = useRef<TilePos | null>(null)
  const hoverPosRef = useRef<TilePos | null>(null)
  const [cursorPos, setCursorPos] = useState<TilePos | null>(null)

  // ── Compose sub-hooks ────────────────────────────────────────────
  const selection = useSelection(renderer, mapData)
  const clipboard = useClipboard(
    renderer, mutator, mapData,
    selection.selectedItemsRef, selection.setSelectedItems, selection.applyHighlights,
    hoverPosRef, settingsRef,
  )

  // ── Wire mutator undo/redo ───────────────────────────────────────
  useEffect(() => {
    if (!mutator) return
    mutator.onUndoRedoChanged = (u, r) => { setCanUndo(u); setCanRedo(r) }
  }, [mutator])

  // ── Wire renderer pointer callbacks ──────────────────────────────
  useEffect(() => {
    if (!renderer || !mutator || !mapData) return

    const ctx: ToolContext = {
      mutator, renderer, mapData,
      selectedBrushRef, brushSizeRef, brushShapeRef, brushRegistryRef,
      activeDoorTypeRef, paintedTilesRef, isDraggingRef,
      selectedItemsRef: selection.selectedItemsRef,
      setSelectedItems: selection.setSelectedItems,
      applyHighlights: selection.applyHighlights,
      selectStartRef, isShiftDragRef, isCtrlDragRef, selectedItemsSnapshotRef,
      isDragMovingRef, dragMoveOriginRef, dragMoveLastPosRef, hoverPosRef,
      onRequestEditItemRef, clickToInspectRef,
      isPastingRef: clipboard.isPastingRef,
      copyBufferRef: clipboard.copyBufferRef,
      executePasteAt: clipboard.executePasteAt,
      cancelPaste: clipboard.cancelPaste,
      activeToolRef,
      selectedZoneRef,
      selectedHouseRef,
    }

    const draw = createDrawHandlers(ctx)
    const erase = createEraseHandlers(ctx)
    const door = createDoorHandlers(ctx)
    const fill = createFillHandlers(ctx)
    const zone = createZoneHandlers(ctx)
    const house = createHouseHandlers(ctx)
    const select = createSelectHandlers(ctx)
    const hover = createHoverHandler(ctx)

    renderer.onTilePointerDown = (pos, event) => {
      if (ctx.isPastingRef.current && ctx.copyBufferRef.current.canPaste()) {
        ctx.executePasteAt(pos.x, pos.y, renderer.floor)
        ctx.cancelPaste()
        return
      }
      isDraggingRef.current = true
      switch (activeToolRef.current) {
        case 'draw': draw.onDown(pos, event); break
        case 'erase': erase.onDown(pos); break
        case 'door': door.onDown(pos); break
        case 'fill': fill.onDown(pos); break
        case 'zone': zone.onDown(pos, event); break
        case 'house': house.onDown(pos, event); break
        case 'select': select.onDown(pos, event); break
      }
    }

    renderer.onTilePointerMove = (pos) => {
      if (!isDraggingRef.current) return
      switch (activeToolRef.current) {
        case 'draw': draw.onMove(pos); break
        case 'erase': erase.onMove(pos); break
        case 'door': door.onMove(pos); break
        case 'zone': zone.onMove(pos); break
        case 'house': house.onMove(pos); break
        case 'select': select.onMove(pos); break
      }
    }

    renderer.onTilePointerUp = (pos) => {
      isDraggingRef.current = false
      const tool = activeToolRef.current
      if (tool === 'draw') {
        draw.onUp()
      } else if (tool === 'erase' || tool === 'door') {
        paintedTilesRef.current.clear()
        mutator.commitBatch()
      } else if (tool === 'zone') {
        zone.onUp()
      } else if (tool === 'house') {
        house.onUp()
      } else if (tool === 'select') {
        select.onUp(pos)
      }
    }

    renderer.onTileHover = (pos) => {
      const prev = hoverPosRef.current
      hover.onHover(pos)
      if (!prev || prev.x !== pos.x || prev.y !== pos.y || prev.z !== pos.z) {
        setCursorPos(pos)
      }
    }

    renderer.onTileDoubleClick = (pos) => {
      if (activeToolRef.current !== 'select') return
      const key = `${pos.x},${pos.y},${pos.z}`
      const tile = mapData.tiles.get(key) ?? null
      if (!tile || tile.items.length === 0) return
      const topIdx = tile.items.length - 1

      const newSel: SelectedItemInfo = { x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }
      selection.setSelectedItems([newSel])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, mutator, mapData, brushRegistry])

  // ── Tool-switch side effects ─────────────────────────────────────
  useEffect(() => {
    if (!renderer) return
    switch (activeTool) {
      case 'select': renderer.setCursorStyle('default'); renderer.clearGhostPreview(); break
      case 'draw': renderer.setCursorStyle('crosshair'); break
      case 'erase': renderer.setCursorStyle('crosshair'); renderer.clearGhostPreview(); break
      case 'door': renderer.setCursorStyle('crosshair'); renderer.clearGhostPreview(); break
      case 'fill': renderer.setCursorStyle('crosshair'); break
      case 'zone': renderer.setCursorStyle('crosshair'); renderer.clearGhostPreview(); break
      case 'house': renderer.setCursorStyle('crosshair'); renderer.clearGhostPreview(); break
    }
  }, [renderer, activeTool])

  useEffect(() => {
    if (!renderer || (activeTool !== 'draw' && activeTool !== 'fill')) return
    renderer.clearGhostPreview()
  }, [renderer, selectedBrush, activeTool])

  useEffect(() => {
    if (activeTool !== 'select') {
      selection.setSelectedItems([])
      renderer?.clearItemHighlight()
    }
    if (clipboard.isPastingRef.current) {
      clipboard.cancelPaste()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, renderer])

  // ── Undo/redo ────────────────────────────────────────────────────
  const undo = useCallback(() => { mutator?.undo() }, [mutator])
  const redo = useCallback(() => { mutator?.redo() }, [mutator])

  return {
    activeTool,
    setActiveTool,
    selectedBrush,
    setSelectedBrush,
    selectedItems: selection.selectedItems,
    setSelectedItems: selection.setSelectedItems,
    hasSelection: selection.hasSelection,
    canPaste: clipboard.canPaste,
    canUndo,
    canRedo,
    undo,
    redo,
    copy: clipboard.copy,
    cut: clipboard.cut,
    paste: clipboard.paste,
    deleteSelection: clipboard.deleteSelection,
    selectTiles: selection.selectTiles,
    brushSize,
    setBrushSize,
    brushShape,
    setBrushShape,
    activeDoorType,
    setActiveDoorType,
    isPasting: clipboard.isPasting,
    cancelPaste: clipboard.cancelPaste,
    selectedZone,
    setSelectedZone,
    selectedHouse,
    setSelectedHouse,
    cursorPos,
  }
}
