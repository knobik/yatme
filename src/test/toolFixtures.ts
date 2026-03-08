// Shared tool-test infrastructure: mock mutator, renderer, context, and pointer events.

import { vi } from 'vitest'
import type { ToolContext, TilePos, BrushSelection, BrushShape, EditorTool } from '../hooks/tools/types'

export function makeMockMutator(overrides: Record<string, unknown> = {}) {
  return {
    beginBatch: vi.fn(),
    commitBatch: vi.fn(),
    flushChunkUpdates: vi.fn(),
    paintGround: vi.fn(),
    paintWall: vi.fn(),
    paintCarpet: vi.fn(),
    paintTable: vi.fn(),
    paintDoodad: vi.fn(),
    paintDoor: vi.fn(),
    eraseGround: vi.fn(),
    eraseWall: vi.fn(),
    eraseCarpet: vi.fn(),
    eraseTable: vi.fn(),
    removeTopItem: vi.fn(),
    removeBrushItems: vi.fn(),
    removeItem: vi.fn(),
    addItem: vi.fn(),
    setTileItems: vi.fn(),
    mergePasteItems: vi.fn(),
    getOrCreateTile: vi.fn(),
    getTile: vi.fn(),
    ...overrides,
  }
}

export function makeMockRenderer(overrides: Record<string, unknown> = {}) {
  return {
    floor: 7,
    setHighlights: vi.fn(),
    clearItemHighlight: vi.fn(),
    updateDragPreview: vi.fn(),
    clearDragPreview: vi.fn(),
    updateBrushCursor: vi.fn(),
    updateGhostPreview: vi.fn(),
    clearGhostPreview: vi.fn(),
    updatePastePreview: vi.fn(),
    setCursorStyle: vi.fn(),
    onTileClick: vi.fn(),
    ...overrides,
  }
}

export interface MakeToolContextOptions {
  mutator?: ReturnType<typeof makeMockMutator>
  renderer?: ReturnType<typeof makeMockRenderer>
  mapData?: any
  selectedBrush?: BrushSelection | null
  brushSize?: number
  brushShape?: BrushShape
  registry?: any
  activeDoorType?: number
  activeTool?: EditorTool
  isPasting?: boolean
  copyBuffer?: any
  selectedItems?: any[]
  clickToInspect?: boolean
}

export function makeToolContext(opts: MakeToolContextOptions = {}) {
  const mutator = opts.mutator ?? makeMockMutator()
  const renderer = opts.renderer ?? makeMockRenderer()

  const ctx = {
    mutator,
    renderer,
    mapData: opts.mapData ?? { version: 2, width: 1024, height: 1024, description: '', spawnFile: '', houseFile: '', tiles: new Map(), towns: [], waypoints: [] },
    selectedBrushRef: { current: opts.selectedBrush ?? null },
    brushSizeRef: { current: opts.brushSize ?? 0 },
    brushShapeRef: { current: opts.brushShape ?? 'square' as BrushShape },
    brushRegistryRef: { current: opts.registry ?? null },
    activeDoorTypeRef: { current: opts.activeDoorType ?? 0 },
    paintedTilesRef: { current: new Set<string>() },
    isDraggingRef: { current: false },
    selectedItemsRef: { current: opts.selectedItems ?? [] },
    setSelectedItems: vi.fn(),
    applyHighlights: vi.fn(),
    selectStartRef: { current: null as TilePos | null },
    isShiftDragRef: { current: false },
    isCtrlDragRef: { current: false },
    selectedItemsSnapshotRef: { current: [] as any[] },
    isDragMovingRef: { current: false },
    dragMoveOriginRef: { current: null as TilePos | null },
    dragMoveLastPosRef: { current: null as TilePos | null },
    hoverPosRef: { current: null as TilePos | null },
    onRequestEditItemRef: { current: undefined as any },
    clickToInspectRef: { current: opts.clickToInspect ?? false },
    isPastingRef: { current: opts.isPasting ?? false },
    copyBufferRef: { current: opts.copyBuffer ?? { canPaste: () => false, getTiles: () => [] } },
    executePasteAt: vi.fn(),
    cancelPaste: vi.fn(),
    activeToolRef: { current: opts.activeTool ?? 'draw' as EditorTool },
  } as unknown as ToolContext

  return { ctx, mutator, renderer }
}

export function makePointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    button: 0,
    ...overrides,
  } as unknown as PointerEvent
}
