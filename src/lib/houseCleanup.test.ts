import { describe, it, expect } from 'vitest'
import { scrubHouseFromTiles, updateAllHouseSizes } from './houseCleanup'
import type { OtbmTile } from './otbm'
import type { HouseData } from './sidecars'

function makeTile(x: number, y: number, z: number, houseId?: number): OtbmTile {
  const tile: OtbmTile = { x, y, z, flags: 0, items: [] }
  if (houseId != null) {
    tile.houseId = houseId
    tile.flags = 0x0001 // PZ
  }
  return tile
}

function makeHouse(id: number): HouseData {
  return {
    id, name: `House ${id}`, entryX: 0, entryY: 0, entryZ: 7,
    rent: 0, townId: 0, size: 0, clientId: 0, guildhall: false, beds: 0,
  }
}

describe('scrubHouseFromTiles', () => {
  it('removes house ID and PZ flag from matching tiles', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,2,7', makeTile(1, 2, 7, 5)],
      ['3,4,7', makeTile(3, 4, 7, 5)],
    ])

    const modified = scrubHouseFromTiles(tiles, 5)

    expect(modified).toBe(2)
    expect(tiles.get('1,2,7')!.houseId).toBeUndefined()
    expect(tiles.get('1,2,7')!.flags & 0x0001).toBe(0)
    expect(tiles.get('3,4,7')!.houseId).toBeUndefined()
  })

  it('skips tiles with different house IDs', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,1,7', makeTile(1, 1, 7, 5)],
      ['2,2,7', makeTile(2, 2, 7, 10)],
    ])

    const modified = scrubHouseFromTiles(tiles, 5)

    expect(modified).toBe(1)
    expect(tiles.get('2,2,7')!.houseId).toBe(10)
  })

  it('skips tiles without house IDs', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,1,7', makeTile(1, 1, 7)],
    ])

    const modified = scrubHouseFromTiles(tiles, 5)

    expect(modified).toBe(0)
  })

  it('returns 0 for empty tile map', () => {
    const tiles = new Map<string, OtbmTile>()
    expect(scrubHouseFromTiles(tiles, 1)).toBe(0)
  })
})

describe('updateAllHouseSizes', () => {
  it('computes correct sizes from tile counts', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,1,7', makeTile(1, 1, 7, 1)],
      ['2,1,7', makeTile(2, 1, 7, 1)],
      ['3,1,7', makeTile(3, 1, 7, 1)],
      ['1,2,7', makeTile(1, 2, 7, 2)],
    ])
    const houses = [makeHouse(1), makeHouse(2), makeHouse(3)]

    updateAllHouseSizes(tiles, houses)

    expect(houses[0].size).toBe(3)
    expect(houses[1].size).toBe(1)
    expect(houses[2].size).toBe(0)
  })

  it('sets size to 0 for houses with no tiles', () => {
    const tiles = new Map<string, OtbmTile>()
    const houses = [makeHouse(1)]

    updateAllHouseSizes(tiles, houses)

    expect(houses[0].size).toBe(0)
  })
})
