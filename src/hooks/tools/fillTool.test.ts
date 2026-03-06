import { describe, it, expect, vi } from 'vitest'
import { createFillHandlers } from './fillTool'
import { makeGroundBrush, makeMinimalRegistry } from '../../test/brushFixtures'
import { makeMapData, makeTile, makeItem } from '../../test/fixtures'
import type { ToolContext } from './types'

// Mock resolveBrush — we control what brush is "selected"
vi.mock('./types', async (importOriginal) => {
  const original = await importOriginal<typeof import('./types')>()
  return {
    ...original,
    resolveBrush: vi.fn(() => ({ type: 'raw' as const, itemId: 0 })),
  }
})

import { resolveBrush } from './types'
const mockResolveBrush = vi.mocked(resolveBrush)

function makeMockMutator() {
  return {
    beginBatch: vi.fn(),
    paintGround: vi.fn(),
    flushChunkUpdates: vi.fn(),
    commitBatch: vi.fn(),
  }
}

function makeFillContext(overrides: Partial<{
  mutator: ReturnType<typeof makeMockMutator>
  mapData: ReturnType<typeof makeMapData>
  selectedBrush: { mode: 'brush'; brushType: 'ground'; brushName: string } | null
  registry: ReturnType<typeof makeMinimalRegistry> | null
}>): { ctx: ToolContext; mutator: ReturnType<typeof makeMockMutator> } {
  const mutator = overrides.mutator ?? makeMockMutator()
  const mapData = overrides.mapData ?? makeMapData([])
  const registry = overrides.registry ?? null
  const selectedBrush = overrides.selectedBrush ?? null

  const ctx = {
    mutator,
    mapData,
    selectedBrushRef: { current: selectedBrush },
    brushSizeRef: { current: 0 },
    brushShapeRef: { current: 'square' },
    brushRegistryRef: { current: registry },
    activeDoorTypeRef: { current: 0 },
    paintedTilesRef: { current: new Set() },
    isDraggingRef: { current: false },
    selectedItemsRef: { current: [] },
    setSelectedItems: vi.fn(),
    applyHighlights: vi.fn(),
    selectStartRef: { current: null },
    isShiftDragRef: { current: false },
    isCtrlDragRef: { current: false },
    selectedItemsSnapshotRef: { current: [] },
    isDragMovingRef: { current: false },
    dragMoveOriginRef: { current: null },
    dragMoveLastPosRef: { current: null },
    hoverPosRef: { current: null },
    onRequestEditItemRef: { current: undefined },
    clickToInspectRef: { current: false },
    isPastingRef: { current: false },
    copyBufferRef: { current: {} },
    executePasteAt: vi.fn(),
    cancelPaste: vi.fn(),
    activeToolRef: { current: 'fill' },
    renderer: {} as any,
  } as unknown as ToolContext

  return { ctx, mutator }
}

function setupBrushes() {
  const grassBrush = makeGroundBrush({
    id: 1, name: 'grass',
    items: [{ id: 10, chance: 100 }], totalChance: 100,
  })
  const sandBrush = makeGroundBrush({
    id: 2, name: 'sand',
    items: [{ id: 20, chance: 100 }], totalChance: 100,
  })
  const registry = makeMinimalRegistry({ groundBrushes: [grassBrush, sandBrush] })
  return { grassBrush, sandBrush, registry }
}

describe('fillTool', () => {
  it('fills a single tile', () => {
    const { sandBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    expect(mutator.paintGround).toHaveBeenCalledTimes(1)
    expect(mutator.paintGround).toHaveBeenCalledWith(5, 5, 7, sandBrush)
  })

  it('no-op when same brush name', () => {
    const { grassBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })

    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    expect(mutator.beginBatch).not.toHaveBeenCalled()
  })

  it('no-op when no brush selected', () => {
    const { registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'raw', itemId: 0 })

    const { ctx, mutator } = makeFillContext({
      selectedBrush: null,
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    expect(mutator.beginBatch).not.toHaveBeenCalled()
  })

  it('flood fills connected same-brush region (3x1 strip)', () => {
    const { sandBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    const map = makeMapData([
      makeTile(4, 5, 7, [makeItem({ id: 10 })]),
      makeTile(5, 5, 7, [makeItem({ id: 10 })]),
      makeTile(6, 5, 7, [makeItem({ id: 10 })]),
    ])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    expect(mutator.paintGround).toHaveBeenCalledTimes(3)
  })

  it('stops at different-brush boundary', () => {
    const { grassBrush, sandBrush } = setupBrushes()
    const dirtBrush = makeGroundBrush({
      id: 3, name: 'dirt',
      items: [{ id: 30, chance: 100 }], totalChance: 100,
    })
    const reg = makeMinimalRegistry({ groundBrushes: [grassBrush, sandBrush, dirtBrush] })
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    const map = makeMapData([
      makeTile(4, 5, 7, [makeItem({ id: 10 })]), // grass
      makeTile(5, 5, 7, [makeItem({ id: 10 })]), // grass (click here)
      makeTile(6, 5, 7, [makeItem({ id: 30 })]), // dirt (boundary)
      makeTile(7, 5, 7, [makeItem({ id: 10 })]), // grass (unreachable)
    ])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry: reg,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    expect(mutator.paintGround).toHaveBeenCalledTimes(2) // only 4,5 and 5,5
  })

  it('fills empty tiles when clicking empty area', () => {
    const { sandBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    // No tiles in map → clicking empty area should fill empty tiles
    const map = makeMapData([])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    // Empty tiles connect to all empty neighbors → fills up to MAX_FILL_TILES (4096)
    expect(mutator.paintGround).toHaveBeenCalledTimes(4096)
  })

  it('respects MAX_FILL_TILES limit (4096)', () => {
    const { sandBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    // Empty map → all tiles are "empty brush", BFS expands everywhere
    const map = makeMapData([])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    expect(mutator.paintGround).toHaveBeenCalledTimes(4096)
  })

  it('respects MAX_FILL_RADIUS limit (64)', () => {
    const { sandBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    // Create a horizontal strip of grass tiles from x=0 to x=200 (well beyond radius 64)
    const tiles = Array.from({ length: 200 }, (_, i) =>
      makeTile(i, 5, 7, [makeItem({ id: 10 })]),
    )
    const map = makeMapData(tiles)
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 100, y: 5, z: 7 })

    // Only tiles within radius 64 of click (x=100) should be filled: x in [36..164] = 129 tiles
    // But strip is [0..199], so intersection is [36..164] = 129 tiles
    const calls = (mutator.paintGround as ReturnType<typeof vi.fn>).mock.calls
    for (const call of calls) {
      const x = call[0] as number
      expect(Math.abs(x - 100)).toBeLessThanOrEqual(64)
    }
    expect(calls.length).toBeLessThan(200) // Not all tiles filled
  })

  it('uses 4-neighbor connectivity only (diagonals not connected)', () => {
    const { sandBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    // Diagonal grass tile only, not 4-connected
    const map = makeMapData([
      makeTile(5, 5, 7, [makeItem({ id: 10 })]), // grass center
      makeTile(6, 6, 7, [makeItem({ id: 10 })]), // grass diagonal (unreachable)
    ])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry,
    })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    // Only center tile filled, diagonal not connected
    expect(mutator.paintGround).toHaveBeenCalledTimes(1)
  })

  it('batch lifecycle: beginBatch → paintGround × N → flushChunkUpdates → commitBatch', () => {
    const { sandBrush, registry } = setupBrushes()
    mockResolveBrush.mockReturnValue({ type: 'ground', brush: sandBrush })

    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
    const { ctx, mutator } = makeFillContext({
      mapData: map,
      selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'sand' },
      registry,
    })

    const callOrder: string[] = []
    mutator.beginBatch.mockImplementation(() => { callOrder.push('beginBatch') })
    mutator.paintGround.mockImplementation(() => { callOrder.push('paintGround') })
    mutator.flushChunkUpdates.mockImplementation(() => { callOrder.push('flushChunkUpdates') })
    mutator.commitBatch.mockImplementation(() => { callOrder.push('commitBatch') })

    const { onDown } = createFillHandlers(ctx)
    onDown({ x: 5, y: 5, z: 7 })

    expect(callOrder[0]).toBe('beginBatch')
    expect(callOrder[callOrder.length - 1]).toBe('commitBatch')
    expect(callOrder[callOrder.length - 2]).toBe('flushChunkUpdates')
    expect(callOrder.filter(c => c === 'paintGround').length).toBe(1)
  })
})
