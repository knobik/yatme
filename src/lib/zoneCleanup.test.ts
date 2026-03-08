import { describe, it, expect } from 'vitest'
import { scrubZoneFromTiles } from './zoneCleanup'
import type { OtbmTile } from './otbm'

function makeTile(x: number, y: number, z: number, zones?: number[]): OtbmTile {
  return { x, y, z, flags: 0, items: [], zones }
}

describe('scrubZoneFromTiles', () => {
  it('removes zone ID from tiles that have it', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,2,7', makeTile(1, 2, 7, [3, 5])],
      ['3,4,7', makeTile(3, 4, 7, [5, 8])],
    ])

    const modified = scrubZoneFromTiles(tiles, 5)

    expect(modified).toBe(2)
    expect(tiles.get('1,2,7')!.zones).toEqual([3])
    expect(tiles.get('3,4,7')!.zones).toEqual([8])
  })

  it('deletes the zones property when it becomes empty', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,1,7', makeTile(1, 1, 7, [5])],
    ])

    scrubZoneFromTiles(tiles, 5)

    expect(tiles.get('1,1,7')!.zones).toBeUndefined()
  })

  it('skips tiles without zones', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,1,7', makeTile(1, 1, 7)],
      ['2,2,7', makeTile(2, 2, 7, [3])],
    ])

    const modified = scrubZoneFromTiles(tiles, 3)

    expect(modified).toBe(1)
    expect(tiles.get('1,1,7')!.zones).toBeUndefined()
  })

  it('skips tiles that do not contain the target zone', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,1,7', makeTile(1, 1, 7, [1, 2])],
    ])

    const modified = scrubZoneFromTiles(tiles, 99)

    expect(modified).toBe(0)
    expect(tiles.get('1,1,7')!.zones).toEqual([1, 2])
  })

  it('returns 0 for an empty tile map', () => {
    const tiles = new Map<string, OtbmTile>()
    expect(scrubZoneFromTiles(tiles, 1)).toBe(0)
  })

  it('handles tiles with duplicate zone IDs gracefully', () => {
    const tiles = new Map<string, OtbmTile>([
      ['1,1,7', makeTile(1, 1, 7, [5, 5])],
    ])

    const modified = scrubZoneFromTiles(tiles, 5)

    expect(modified).toBe(1)
    expect(tiles.get('1,1,7')!.zones).toEqual([5])
  })
})
