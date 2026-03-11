// Shared tool-test infrastructure: mock mutator, renderer, context, and pointer events.

import { vi } from 'vitest'
import type { ToolContext, TilePos, BrushSelection, BrushShape, EditorTool } from '../hooks/tools/types'
import type { OtbmMap } from '../lib/otbm'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import type { SelectedItemInfo } from '../hooks/useSelection'
import type { EditorSettings } from '../lib/EditorSettings'
import { DEFAULT_SETTINGS } from '../lib/EditorSettings'

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
    eraseAllItems: vi.fn(),
    reborderAfterErase: vi.fn(),
    clearAllTileFlags: vi.fn(),
    clearAllTileZones: vi.fn(),
    removeBrushItems: vi.fn(),
    removeItem: vi.fn(),
    addItem: vi.fn(),
    setTileItems: vi.fn(),
    mergePasteItems: vi.fn(),
    getOrCreateTile: vi.fn(),
    getTile: vi.fn(),
    placeCreature: vi.fn(),
    removeCreature: vi.fn(),
    moveCreature: vi.fn(),
    placeSpawnZone: vi.fn(),
    removeSpawnZone: vi.fn(),
    setTileFlag: vi.fn(),
    clearTileFlag: vi.fn(),
    addTileZone: vi.fn(),
    removeTileZone: vi.fn(),
    getAppearances: vi.fn(() => ({ objects: new Map() })),
    spawnManager: null,
    waypointManager: null,
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
    setWaypointDragGhost: vi.fn(),
    clearWaypointDragGhost: vi.fn(),
    setSpawnDragGhost: vi.fn(),
    clearSpawnDragGhost: vi.fn(),
    updateBrushCursor: vi.fn(),
    updateGhostPreview: vi.fn(),
    clearGhostPreview: vi.fn(),
    updatePastePreview: vi.fn(),
    setCursorStyle: vi.fn(),
    onTileClick: vi.fn(),
    showWaypointOverlay: false,
    ...overrides,
  }
}

export interface MakeToolContextOptions {
  mutator?: ReturnType<typeof makeMockMutator>
  renderer?: ReturnType<typeof makeMockRenderer>
  mapData?: OtbmMap
  selectedBrush?: BrushSelection | null
  brushSize?: number
  brushShape?: BrushShape
  spawnRadius?: number
  registry?: BrushRegistry | null
  activeDoorType?: number
  activeTool?: EditorTool
  settings?: Partial<EditorSettings>
  isPasting?: boolean
  copyBuffer?: { canPaste: () => boolean; getTiles: () => unknown[] }
  selectedItems?: SelectedItemInfo[]
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
    selectedItemsSnapshotRef: { current: [] as SelectedItemInfo[] },
    isDragMovingRef: { current: false },
    dragMoveOriginRef: { current: null as TilePos | null },
    dragMoveLastPosRef: { current: null as TilePos | null },
    hoverPosRef: { current: null as TilePos | null },
    onRequestEditItemRef: { current: undefined as ((x: number, y: number, z: number, idx: number) => void) | undefined },
    onRequestEditCreatureRef: { current: undefined as ((x: number, y: number, z: number, name: string, isNpc: boolean) => void) | undefined },
    onRequestEditSpawnRef: { current: undefined as ((x: number, y: number, z: number, spawnType: 'monster' | 'npc') => void) | undefined },
    clickToInspectRef: { current: opts.clickToInspect ?? false },
    isPastingRef: { current: opts.isPasting ?? false },
    copyBufferRef: { current: opts.copyBuffer ?? { canPaste: () => false, getTiles: () => [] } },
    executePasteAt: vi.fn(),
    cancelPaste: vi.fn(),
    activeToolRef: { current: opts.activeTool ?? 'draw' as EditorTool },
    selectedZoneRef: { current: null },
    selectedHouseRef: { current: null },
    creatureSpawnTimeRef: { current: 60 },
    creatureWeightRef: { current: 100 },
    spawnRadiusRef: { current: opts.spawnRadius ?? 1 },
    selectedCreatureRef: { current: null },
    setSelectedCreature: vi.fn(),
    isCreatureDragRef: { current: false },
    isWaypointDragRef: { current: false },
    dragWaypointNameRef: { current: null as string | null },
    settingsRef: { current: { ...DEFAULT_SETTINGS, ...opts.settings } },
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
