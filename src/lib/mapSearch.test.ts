import { describe, it, expect, vi } from 'vitest'
import { findItemsOnMap, replaceItemsOnMap } from './mapSearch'
import { makeMapData, makeTile, makeItem } from '../test/fixtures'
import type { MapMutator } from './MapMutator'

function makeMockMutator(): MapMutator {
  return {
    setTileItems: vi.fn(),
  } as unknown as MapMutator
}

describe('findItemsOnMap', () => {
  it('finds item on single tile', async () => {
    const map = makeMapData([makeTile(1, 1, 7, [makeItem({ id: 42 })])])
    const results = await findItemsOnMap(map, 42)
    expect(results).toEqual([{ x: 1, y: 1, z: 7, itemIndices: [0] }])
  })

  it('finds multiple matches on same tile', async () => {
    const map = makeMapData([
      makeTile(1, 1, 7, [makeItem({ id: 42 }), makeItem({ id: 99 }), makeItem({ id: 42 })]),
    ])
    const results = await findItemsOnMap(map, 42)
    expect(results).toEqual([{ x: 1, y: 1, z: 7, itemIndices: [0, 2] }])
  })

  it('returns empty array when no matches', async () => {
    const map = makeMapData([makeTile(1, 1, 7, [makeItem({ id: 10 })])])
    const results = await findItemsOnMap(map, 42)
    expect(results).toEqual([])
  })

  it('detects nested item at parent index', async () => {
    const map = makeMapData([
      makeTile(1, 1, 7, [
        makeItem({ id: 100, items: [makeItem({ id: 42 })] }),
      ]),
    ])
    const results = await findItemsOnMap(map, 42)
    expect(results).toEqual([{ x: 1, y: 1, z: 7, itemIndices: [0] }])
  })

  it('respects scope filtering', async () => {
    const map = makeMapData([
      makeTile(1, 1, 7, [makeItem({ id: 42 })]),
      makeTile(2, 2, 7, [makeItem({ id: 42 })]),
    ])
    const scope = new Set(['1,1,7'])
    const results = await findItemsOnMap(map, 42, scope)
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ x: 1, y: 1, z: 7, itemIndices: [0] })
  })

  it('respects AbortSignal cancellation', async () => {
    const tiles = Array.from({ length: 100 }, (_, i) =>
      makeTile(i, 0, 7, [makeItem({ id: 42 })]),
    )
    const map = makeMapData(tiles)
    const controller = new AbortController()
    controller.abort()
    const results = await findItemsOnMap(map, 42, undefined, undefined, controller.signal)
    // Pre-aborted signal → abort check fires before any tile is processed
    expect(results).toEqual([])
  })

  it('calls onProgress callback', async () => {
    const tiles = Array.from({ length: 5 }, (_, i) =>
      makeTile(i, 0, 7, [makeItem({ id: 42 })]),
    )
    const map = makeMapData(tiles)
    const onProgress = vi.fn()
    await findItemsOnMap(map, 42, undefined, onProgress)
    // Final call should be (total, total)
    expect(onProgress).toHaveBeenCalledWith(5, 5)
  })
})

describe('replaceItemsOnMap', () => {
  it('replaces item ID', async () => {
    const map = makeMapData([makeTile(1, 1, 7, [makeItem({ id: 42 })])])
    const mutator = makeMockMutator()
    const count = await replaceItemsOnMap(map, mutator, 42, 99)
    expect(count).toBe(1)
    expect(mutator.setTileItems).toHaveBeenCalledWith(1, 1, 7, [expect.objectContaining({ id: 99 })])
  })

  it('replaces nested item', async () => {
    const map = makeMapData([
      makeTile(1, 1, 7, [makeItem({ id: 100, items: [makeItem({ id: 42 })] })]),
    ])
    const mutator = makeMockMutator()
    const count = await replaceItemsOnMap(map, mutator, 42, 99)
    expect(count).toBe(1)
    const call = (mutator.setTileItems as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[3][0].items[0].id).toBe(99)
  })

  it('returns total replacement count', async () => {
    const map = makeMapData([
      makeTile(1, 1, 7, [makeItem({ id: 42 }), makeItem({ id: 42 })]),
      makeTile(2, 2, 7, [makeItem({ id: 42 })]),
    ])
    const mutator = makeMockMutator()
    const count = await replaceItemsOnMap(map, mutator, 42, 99)
    expect(count).toBe(3)
  })

  it('respects scope filtering', async () => {
    const map = makeMapData([
      makeTile(1, 1, 7, [makeItem({ id: 42 })]),
      makeTile(2, 2, 7, [makeItem({ id: 42 })]),
    ])
    const mutator = makeMockMutator()
    const scope = new Set(['1,1,7'])
    const count = await replaceItemsOnMap(map, mutator, 42, 99, scope)
    expect(count).toBe(1)
    expect(mutator.setTileItems).toHaveBeenCalledTimes(1)
  })

  it('respects AbortSignal cancellation', async () => {
    const tiles = Array.from({ length: 100 }, (_, i) =>
      makeTile(i, 0, 7, [makeItem({ id: 42 })]),
    )
    const map = makeMapData(tiles)
    const mutator = makeMockMutator()
    const controller = new AbortController()
    controller.abort()
    const count = await replaceItemsOnMap(map, mutator, 42, 99, undefined, undefined, controller.signal)
    // Pre-aborted signal → abort check fires before any tile is processed
    expect(count).toBe(0)
  })
})
