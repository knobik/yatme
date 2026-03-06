import { describe, it, expect } from 'vitest'
import { chunkKeyStr, chunkKeyForTile, buildChunkIndex } from './ChunkManager'
import { makeTile, makeAppearanceData } from '../test/fixtures'

describe('chunkKeyStr', () => {
  it('formats as cx,cy,z', () => {
    expect(chunkKeyStr(3, 5, 7)).toBe('3,5,7')
  })

  it('handles negative coords', () => {
    expect(chunkKeyStr(-1, -2, 0)).toBe('-1,-2,0')
  })

  it('handles zero', () => {
    expect(chunkKeyStr(0, 0, 0)).toBe('0,0,0')
  })
})

describe('chunkKeyForTile', () => {
  it('divides by CHUNK_SIZE (32)', () => {
    expect(chunkKeyForTile(0, 0, 7)).toBe('0,0,7')
    expect(chunkKeyForTile(31, 31, 7)).toBe('0,0,7')
    expect(chunkKeyForTile(32, 32, 7)).toBe('1,1,7')
  })

  it('handles large coordinates', () => {
    expect(chunkKeyForTile(1000, 2000, 5)).toBe('31,62,5')
  })

  it('floors negative coordinates', () => {
    expect(chunkKeyForTile(-1, -1, 7)).toBe('-1,-1,7')
  })
})

describe('buildChunkIndex', () => {
  it('groups tiles into chunks', () => {
    const tiles = new Map([
      ['0,0,7', makeTile(0, 0, 7)],
      ['1,1,7', makeTile(1, 1, 7)],
      ['32,0,7', makeTile(32, 0, 7)],
    ])
    const appearances = makeAppearanceData([])
    const { index } = buildChunkIndex(tiles, appearances)
    expect(index.get('0,0,7')).toHaveLength(2) // tiles at (0,0) and (1,1) same chunk
    expect(index.get('1,0,7')).toHaveLength(1) // tile at (32,0) in chunk (1,0)
  })

  it('sorts tiles by Y then X within chunk', () => {
    const tiles = new Map([
      ['5,10,7', makeTile(5, 10, 7)],
      ['3,5,7', makeTile(3, 5, 7)],
      ['10,5,7', makeTile(10, 5, 7)],
    ])
    const appearances = makeAppearanceData([])
    const { index } = buildChunkIndex(tiles, appearances)
    const chunk = index.get('0,0,7')!
    // Expected order: (3,5), (10,5), (5,10) — sorted by Y then X
    expect(chunk.map(t => [t.x, t.y])).toEqual([[3, 5], [10, 5], [5, 10]])
  })

  it('detects animated chunk keys', () => {
    const tile = makeTile(0, 0, 7, [{ id: 100 }])
    const tiles = new Map([['0,0,7', tile]])
    const appearances = makeAppearanceData([[100, {}]])
    // With no animation, animatedKeys should be empty
    const { animatedKeys } = buildChunkIndex(tiles, appearances)
    expect(animatedKeys.size).toBe(0)
  })

  it('returns empty index for empty tiles', () => {
    const { index } = buildChunkIndex(new Map(), makeAppearanceData([]))
    expect(index.size).toBe(0)
  })
})
