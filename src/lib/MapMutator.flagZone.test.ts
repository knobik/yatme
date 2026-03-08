import { describe, it, expect } from 'vitest'
import { MapMutator } from './MapMutator'
import { makeAppearanceData, makeMapData, makeTile, makeItem } from '../test/fixtures'

function setup(tiles: ReturnType<typeof makeTile>[]) {
  const appearances = makeAppearanceData([[100, { bank: { waypoints: 0 } as any }]])
  const mapData = makeMapData(tiles)
  const mutator = new MapMutator(mapData, appearances)
  return { mapData, mutator }
}

describe('MapMutator flag mutations', () => {
  it('sets a flag on a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.setTileFlag(10, 10, 7, 0x0001)

    expect(mapData.tiles.get('10,10,7')!.flags).toBe(0x0001)
  })

  it('sets multiple flags via OR', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.flags = 0x0001
    const { mapData, mutator } = setup([tile])

    mutator.setTileFlag(10, 10, 7, 0x0004)

    expect(mapData.tiles.get('10,10,7')!.flags).toBe(0x0005)
  })

  it('clears a flag from a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.flags = 0x0005
    const { mapData, mutator } = setup([tile])

    mutator.clearTileFlag(10, 10, 7, 0x0001)

    expect(mapData.tiles.get('10,10,7')!.flags).toBe(0x0004)
  })

  it('is idempotent when setting already-set flag', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.flags = 0x0001
    const { mutator } = setup([tile])

    mutator.setTileFlag(10, 10, 7, 0x0001)

    expect(mutator.canUndo()).toBe(false)
  })

  it('is idempotent when clearing already-clear flag', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mutator } = setup([tile])

    mutator.clearTileFlag(10, 10, 7, 0x0001)

    expect(mutator.canUndo()).toBe(false)
  })

  it('undoes setTileFlag', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.setTileFlag(10, 10, 7, 0x0001)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.flags).toBe(0)
  })

  it('redoes setTileFlag', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.setTileFlag(10, 10, 7, 0x0001)
    mutator.undo()
    mutator.redo()

    expect(mapData.tiles.get('10,10,7')!.flags).toBe(0x0001)
  })

  it('no-op on nonexistent tile', () => {
    const { mutator } = setup([])

    mutator.setTileFlag(99, 99, 7, 0x0001)

    expect(mutator.canUndo()).toBe(false)
  })
})

describe('MapMutator zone mutations', () => {
  it('adds a zone to a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.addTileZone(10, 10, 7, 5)

    expect(mapData.tiles.get('10,10,7')!.zones).toEqual([5])
  })

  it('adds multiple zones', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.addTileZone(10, 10, 7, 5)
    mutator.addTileZone(10, 10, 7, 10)

    expect(mapData.tiles.get('10,10,7')!.zones).toEqual([5, 10])
  })

  it('is idempotent when adding same zone twice', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.addTileZone(10, 10, 7, 5)
    mutator.addTileZone(10, 10, 7, 5)

    expect(mapData.tiles.get('10,10,7')!.zones).toEqual([5])
  })

  it('removes a zone from a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.zones = [5, 10]
    const { mapData, mutator } = setup([tile])

    mutator.removeTileZone(10, 10, 7, 5)

    expect(mapData.tiles.get('10,10,7')!.zones).toEqual([10])
  })

  it('clears zones array when last zone removed', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.zones = [5]
    const { mapData, mutator } = setup([tile])

    mutator.removeTileZone(10, 10, 7, 5)

    expect(mapData.tiles.get('10,10,7')!.zones).toBeUndefined()
  })

  it('is idempotent when removing absent zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mutator } = setup([tile])

    mutator.removeTileZone(10, 10, 7, 99)

    expect(mutator.canUndo()).toBe(false)
  })

  it('undoes addTileZone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.addTileZone(10, 10, 7, 5)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.zones).toBeUndefined()
  })

  it('redoes addTileZone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.addTileZone(10, 10, 7, 5)
    mutator.undo()
    mutator.redo()

    expect(mapData.tiles.get('10,10,7')!.zones).toEqual([5])
  })

  it('undoes removeTileZone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.zones = [5, 10]
    const { mapData, mutator } = setup([tile])

    mutator.removeTileZone(10, 10, 7, 5)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.zones).toEqual([5, 10])
  })

  it('no-op on nonexistent tile', () => {
    const { mutator } = setup([])

    mutator.addTileZone(99, 99, 7, 1)

    expect(mutator.canUndo()).toBe(false)
  })
})
