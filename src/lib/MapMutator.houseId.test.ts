import { describe, it, expect } from 'vitest'
import { MapMutator } from './MapMutator'
import { makeAppearanceData, makeMapData, makeTile, makeItem } from '../test/fixtures'

function setup(tiles: ReturnType<typeof makeTile>[]) {
  const appearances = makeAppearanceData([[100, { bank: { waypoints: 0 } }]])
  const mapData = makeMapData(tiles)
  const mutator = new MapMutator(mapData, appearances)
  return { mapData, mutator }
}

describe('MapMutator house ID mutations', () => {
  it('sets a house ID on a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.setTileHouseId(10, 10, 7, 42)

    expect(mapData.tiles.get('10,10,7')!.houseId).toBe(42)
  })

  it('sets PZ flag when setting house ID', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.setTileHouseId(10, 10, 7, 42)

    expect(mapData.tiles.get('10,10,7')!.flags & 0x0001).toBe(0x0001)
  })

  it('creates tile if it does not exist', () => {
    const { mapData, mutator } = setup([])

    mutator.setTileHouseId(5, 5, 7, 10)

    expect(mapData.tiles.get('5,5,7')!.houseId).toBe(10)
  })

  it('is idempotent when setting same house ID', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.houseId = 42
    tile.flags = 0x0001
    const { mutator } = setup([tile])

    mutator.setTileHouseId(10, 10, 7, 42)

    expect(mutator.canUndo()).toBe(false)
  })

  it('replaces existing house ID', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.houseId = 10
    const { mapData, mutator } = setup([tile])

    mutator.setTileHouseId(10, 10, 7, 20)

    expect(mapData.tiles.get('10,10,7')!.houseId).toBe(20)
  })

  it('clears house ID from a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.houseId = 42
    tile.flags = 0x0001
    const { mapData, mutator } = setup([tile])

    mutator.clearTileHouseId(10, 10, 7)

    expect(mapData.tiles.get('10,10,7')!.houseId).toBeUndefined()
  })

  it('clears PZ flag when clearing house ID', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.houseId = 42
    tile.flags = 0x0001
    const { mapData, mutator } = setup([tile])

    mutator.clearTileHouseId(10, 10, 7)

    expect(mapData.tiles.get('10,10,7')!.flags & 0x0001).toBe(0)
  })

  it('is idempotent when clearing nonexistent house ID', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mutator } = setup([tile])

    mutator.clearTileHouseId(10, 10, 7)

    expect(mutator.canUndo()).toBe(false)
  })

  it('no-op on nonexistent tile when clearing', () => {
    const { mutator } = setup([])

    mutator.clearTileHouseId(99, 99, 7)

    expect(mutator.canUndo()).toBe(false)
  })

  it('undoes setTileHouseId', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.setTileHouseId(10, 10, 7, 42)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.houseId).toBeUndefined()
    expect(mapData.tiles.get('10,10,7')!.flags & 0x0001).toBe(0)
  })

  it('redoes setTileHouseId', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.setTileHouseId(10, 10, 7, 42)
    mutator.undo()
    mutator.redo()

    expect(mapData.tiles.get('10,10,7')!.houseId).toBe(42)
    expect(mapData.tiles.get('10,10,7')!.flags & 0x0001).toBe(0x0001)
  })

  it('undoes clearTileHouseId', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.houseId = 42
    tile.flags = 0x0001
    const { mapData, mutator } = setup([tile])

    mutator.clearTileHouseId(10, 10, 7)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.houseId).toBe(42)
    expect(mapData.tiles.get('10,10,7')!.flags & 0x0001).toBe(0x0001)
  })

  it('preserves other flags when setting PZ', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.flags = 0x0004 // No PvP
    const { mapData, mutator } = setup([tile])

    mutator.setTileHouseId(10, 10, 7, 42)

    expect(mapData.tiles.get('10,10,7')!.flags).toBe(0x0005) // PZ + No PvP
  })
})
