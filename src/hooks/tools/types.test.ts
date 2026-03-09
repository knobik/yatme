import { describe, it, expect, vi } from 'vitest'
import {
  getTilesInBrush,
  resolveBrush,
  brushBatchName,
  applyBrushToTile,
  getSelectionPreviewId,
  getPreviewItemId,
  getCopyBufferFootprint,
} from './types'
import { makeGroundBrush, makeWallBrush, makeCarpetBrushWithItems, makeTableBrushWithItems, makeMinimalRegistry } from '../../test/brushFixtures'
import { makeDoodadBrush } from '../../test/brushFixtures'
import { makeMockMutator } from '../../test/toolFixtures'

describe('getTilesInBrush', () => {
  it('size=0 returns single tile', () => {
    expect(getTilesInBrush(5, 10, 0, 'square')).toEqual([{ x: 5, y: 10 }])
  })

  it('size=0 circle returns single tile', () => {
    expect(getTilesInBrush(5, 10, 0, 'circle')).toEqual([{ x: 5, y: 10 }])
  })

  it('size=1 square returns 9 tiles', () => {
    const tiles = getTilesInBrush(100, 100, 1, 'square')
    expect(tiles).toHaveLength(9)
    expect(tiles).toContainEqual({ x: 99, y: 99 })
    expect(tiles).toContainEqual({ x: 100, y: 100 })
    expect(tiles).toContainEqual({ x: 101, y: 101 })
  })

  it('size=2 square returns 25 tiles', () => {
    const tiles = getTilesInBrush(100, 100, 2, 'square')
    expect(tiles).toHaveLength(25)
  })

  it('size=1 circle excludes corners', () => {
    const tiles = getTilesInBrush(100, 100, 1, 'circle')
    // Corners are at distance sqrt(2) ≈ 1.414 which is >= 1.005, so excluded
    expect(tiles).not.toContainEqual({ x: 99, y: 99 })
    expect(tiles).not.toContainEqual({ x: 101, y: 101 })
    // Center and cardinal directions included
    expect(tiles).toContainEqual({ x: 100, y: 100 })
    expect(tiles).toContainEqual({ x: 101, y: 100 })
    expect(tiles).toContainEqual({ x: 100, y: 101 })
  })

  it('circle is smaller than square for same size', () => {
    const square = getTilesInBrush(100, 100, 2, 'square')
    const circle = getTilesInBrush(100, 100, 2, 'circle')
    expect(circle.length).toBeLessThan(square.length)
  })

  it('clips tiles outside map bounds', () => {
    // Brush at (0,0) with size=1 should clip negative coordinates
    const tiles = getTilesInBrush(0, 0, 1, 'square')
    expect(tiles).toHaveLength(4) // only (0,0), (1,0), (0,1), (1,1)
    expect(tiles).not.toContainEqual({ x: -1, y: -1 })
    expect(tiles).toContainEqual({ x: 0, y: 0 })
    expect(tiles).toContainEqual({ x: 1, y: 1 })
  })
})

describe('resolveBrush', () => {
  it('returns { type: "raw", itemId } for raw mode selection', () => {
    const result = resolveBrush({ mode: 'raw', itemId: 42 }, null)
    expect(result).toEqual({ type: 'raw', itemId: 42 })
  })

  it('looks up ground brush by name from registry', () => {
    const brush = makeGroundBrush({ id: 1, name: 'grass' })
    const registry = makeMinimalRegistry({ groundBrushes: [brush] })
    const result = resolveBrush({ mode: 'brush', brushType: 'ground', brushName: 'grass' }, registry)
    expect(result).toEqual({ type: 'ground', brush })
  })

  it('looks up wall brush by name from registry', () => {
    const brush = makeWallBrush({ id: 1, name: 'stone_wall' })
    const registry = makeMinimalRegistry({ wallBrushes: [brush] })
    const result = resolveBrush({ mode: 'brush', brushType: 'wall', brushName: 'stone_wall' }, registry)
    expect(result).toEqual({ type: 'wall', brush })
  })

  it('falls back to { type: "raw", itemId: 0 } when brush not found', () => {
    const registry = makeMinimalRegistry()
    const result = resolveBrush({ mode: 'brush', brushType: 'ground', brushName: 'nonexistent' }, registry)
    expect(result).toEqual({ type: 'raw', itemId: 0 })
  })

  it('returns correct type for carpet/table/doodad brushes', () => {
    const carpet = makeCarpetBrushWithItems(1, 'red_carpet', { 0: 100 })
    const table = makeTableBrushWithItems(2, 'wood_table', { 0: 200 })
    const doodad = makeDoodadBrush({ id: 3, name: 'tree', alternatives: [] })
    const registry = makeMinimalRegistry({
      carpetBrushes: [carpet],
      tableBrushes: [table],
      doodadBrushes: [doodad],
    })

    expect(resolveBrush({ mode: 'brush', brushType: 'carpet', brushName: 'red_carpet' }, registry))
      .toEqual({ type: 'carpet', brush: carpet })
    expect(resolveBrush({ mode: 'brush', brushType: 'table', brushName: 'wood_table' }, registry))
      .toEqual({ type: 'table', brush: table })
    expect(resolveBrush({ mode: 'brush', brushType: 'doodad', brushName: 'tree' }, registry))
      .toEqual({ type: 'doodad', brush: doodad })
  })
})

describe('brushBatchName', () => {
  it('returns "Paint ground" for ground brush', () => {
    const brush = makeGroundBrush({ name: 'grass' })
    expect(brushBatchName({ type: 'ground', brush })).toBe('Paint ground')
  })

  it('returns correct names for wall/carpet/table/doodad', () => {
    expect(brushBatchName({ type: 'wall', brush: makeWallBrush() })).toBe('Paint wall')
    expect(brushBatchName({ type: 'carpet', brush: makeCarpetBrushWithItems(1, 'c', {}) })).toBe('Paint carpet')
    expect(brushBatchName({ type: 'table', brush: makeTableBrushWithItems(1, 't', {}) })).toBe('Paint table')
    expect(brushBatchName({ type: 'doodad', brush: makeDoodadBrush() })).toBe('Paint doodad')
  })

  it('returns "Draw items" for raw brush', () => {
    expect(brushBatchName({ type: 'raw', itemId: 42 })).toBe('Draw items')
  })
})

describe('applyBrushToTile', () => {
  it('dispatches to mutator.paintGround for ground brush', () => {
    const mutator = makeMockMutator()
    const brush = makeGroundBrush({ name: 'grass' })
    applyBrushToTile(mutator as any, 5, 5, 7, { type: 'ground', brush }, 0)
    expect(mutator.paintGround).toHaveBeenCalledWith(5, 5, 7, brush)
  })

  it('dispatches to mutator.paintWall for wall brush', () => {
    const mutator = makeMockMutator()
    const brush = makeWallBrush({ name: 'wall' })
    applyBrushToTile(mutator as any, 5, 5, 7, { type: 'wall', brush }, 0)
    expect(mutator.paintWall).toHaveBeenCalledWith(5, 5, 7, brush)
  })

  it('dispatches to mutator.addItem for raw brush with correct item id', () => {
    const mutator = makeMockMutator()
    applyBrushToTile(mutator as any, 5, 5, 7, { type: 'raw', itemId: 99 }, 0)
    expect(mutator.addItem).toHaveBeenCalledWith(5, 5, 7, { id: 99 })
  })

  it('doodad: respects thickness/thicknessCeiling via Math.random', () => {
    const mutator = makeMockMutator()
    const brush = makeDoodadBrush({ name: 'tree', thickness: 50, thicknessCeiling: 100 })

    // When Math.random returns 0, random * ceiling (0) < thickness (50), so it paints
    vi.spyOn(Math, 'random').mockReturnValue(0)
    applyBrushToTile(mutator as any, 5, 5, 7, { type: 'doodad', brush }, 1)
    expect(mutator.paintDoodad).toHaveBeenCalledTimes(1)

    // When Math.random returns 0.99, random * ceiling (99) >= thickness (50), so it skips
    mutator.paintDoodad.mockClear()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    applyBrushToTile(mutator as any, 5, 5, 7, { type: 'doodad', brush }, 1)
    expect(mutator.paintDoodad).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})

describe('getPreviewItemId', () => {
  it('returns brush.lookId for ground brush with lookId > 0', () => {
    const brush = makeGroundBrush({ name: 'grass', lookId: 55 })
    expect(getPreviewItemId({ type: 'ground', brush }, 999)).toBe(55)
  })

  it('returns fallback when brush.lookId is 0', () => {
    const brush = makeDoodadBrush({ name: 'tree', lookId: 0 })
    expect(getPreviewItemId({ type: 'doodad', brush }, 999)).toBe(999)
  })

  it('returns fallback for raw brush type', () => {
    expect(getPreviewItemId({ type: 'raw', itemId: 42 }, 999)).toBe(999)
  })
})

describe('getSelectionPreviewId', () => {
  it('returns itemId for raw selection', () => {
    expect(getSelectionPreviewId({ mode: 'raw', itemId: 42 }, null)).toBe(42)
  })

  it('returns brush.lookId for brush selection', () => {
    const brush = makeGroundBrush({ name: 'grass', lookId: 55 })
    const registry = makeMinimalRegistry({ groundBrushes: [brush] })
    expect(getSelectionPreviewId({ mode: 'brush', brushType: 'ground', brushName: 'grass' }, registry)).toBe(55)
  })
})

describe('getCopyBufferFootprint', () => {
  it('projects buffer tiles to absolute positions', () => {
    const buffer = {
      getTiles: () => [
        { dx: 0, dy: 0, dz: 0, items: [] },
        { dx: 1, dy: 0, dz: 0, items: [] },
        { dx: 0, dy: 1, dz: 0, items: [] },
      ],
    } as any

    const result = getCopyBufferFootprint(buffer, 10, 20, 7)
    expect(result).toEqual([
      { x: 10, y: 20, z: 7 },
      { x: 11, y: 20, z: 7 },
      { x: 10, y: 21, z: 7 },
    ])
  })

  it('filters to same floor only (dz === 0)', () => {
    const buffer = {
      getTiles: () => [
        { dx: 0, dy: 0, dz: 0, items: [] },
        { dx: 1, dy: 0, dz: 1, items: [] }, // different floor
        { dx: 0, dy: 1, dz: -1, items: [] }, // different floor
      ],
    } as any

    const result = getCopyBufferFootprint(buffer, 10, 20, 7)
    expect(result).toEqual([{ x: 10, y: 20, z: 7 }])
  })
})
