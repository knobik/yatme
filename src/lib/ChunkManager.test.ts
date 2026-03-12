import { describe, it, expect, vi } from 'vitest'
import { chunkKeyStr, chunkKeyForTile, buildChunkIndex, ChunkCache } from './ChunkManager'
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

  it('builds floorIndex grouping chunk keys by z', () => {
    const tiles = new Map([
      ['0,0,7', makeTile(0, 0, 7)],
      ['32,0,7', makeTile(32, 0, 7)],
      ['0,0,5', makeTile(0, 0, 5)],
    ])
    const appearances = makeAppearanceData([])
    const { floorIndex } = buildChunkIndex(tiles, appearances)

    // Floor 7 should have two chunk keys (0,0,7 and 1,0,7)
    expect(floorIndex.get(7)?.size).toBe(2)
    expect(floorIndex.get(7)?.has('0,0,7')).toBe(true)
    expect(floorIndex.get(7)?.has('1,0,7')).toBe(true)

    // Floor 5 should have one chunk key
    expect(floorIndex.get(5)?.size).toBe(1)
    expect(floorIndex.get(5)?.has('0,0,5')).toBe(true)

    // Floor 0 should not exist
    expect(floorIndex.has(0)).toBe(false)
  })

  it('returns empty floorIndex for empty tiles', () => {
    const { floorIndex } = buildChunkIndex(new Map(), makeAppearanceData([]))
    expect(floorIndex.size).toBe(0)
  })
})

import type { Container } from 'pixi.js'

function mockContainer(): Container {
  return {
    isCachedAsTexture: false,
    cacheAsTexture: vi.fn(),
    parent: null,
    removeChildren: vi.fn(),
    destroy: vi.fn(),
    destroyed: false,
  } as unknown as Container
}

describe('ChunkCache', () => {
  it('set and take round-trip', () => {
    const cache = new ChunkCache(10)
    const c = mockContainer()
    cache.set('a', c)
    expect(cache.take('a')).toBe(c)
    expect(cache.has('a')).toBe(false) // removed after take
  })

  it('take returns undefined for missing key', () => {
    const cache = new ChunkCache(10)
    expect(cache.take('missing')).toBeUndefined()
  })

  it('has returns true for stored, false for missing', () => {
    const cache = new ChunkCache(10)
    cache.set('a', mockContainer())
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  it('LRU eviction when over maxSize', () => {
    const cache = new ChunkCache(2)
    const c1 = mockContainer()
    const c2 = mockContainer()
    const c3 = mockContainer()
    cache.set('a', c1)
    cache.set('b', c2)
    cache.set('c', c3) // should evict 'a'
    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(true)
    expect(cache.has('c')).toBe(true)
  })

  it('eviction destroys container', () => {
    const cache = new ChunkCache(1)
    const c1 = mockContainer()
    const c2 = mockContainer()
    cache.set('a', c1)
    cache.set('b', c2) // evicts 'a'
    expect(c1.removeChildren).toHaveBeenCalled()
    expect(c1.destroy).toHaveBeenCalled()
  })

  it('onEvict callback fires on eviction', () => {
    const cache = new ChunkCache(1)
    const spy = vi.fn()
    cache.onEvict = spy
    cache.set('a', mockContainer())
    cache.set('b', mockContainer()) // evicts 'a'
    expect(spy).toHaveBeenCalledWith('a')
  })

  it('set replaces existing key and destroys old container', () => {
    const cache = new ChunkCache(10)
    const c1 = mockContainer()
    const c2 = mockContainer()
    cache.set('a', c1)
    cache.set('a', c2) // replaces
    expect(c1.destroy).toHaveBeenCalled()
    expect(cache.take('a')).toBe(c2)
  })

  it('delete removes and destroys container', () => {
    const cache = new ChunkCache(10)
    const c = mockContainer()
    cache.set('a', c)
    cache.delete('a')
    expect(c.destroy).toHaveBeenCalled()
    expect(cache.has('a')).toBe(false)
  })

  it('delete is no-op for missing key', () => {
    const cache = new ChunkCache(10)
    cache.delete('missing') // should not throw
  })

  it('clear destroys all containers', () => {
    const cache = new ChunkCache(10)
    const c1 = mockContainer()
    const c2 = mockContainer()
    cache.set('a', c1)
    cache.set('b', c2)
    cache.clear()
    expect(c1.destroy).toHaveBeenCalled()
    expect(c2.destroy).toHaveBeenCalled()
    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(false)
  })
})
