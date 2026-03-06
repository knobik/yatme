import { describe, it, expect } from 'vitest'
import { doCarpets, doTables, getCarpetAlignment, getTableAlignment } from './CarpetSystem'
import { makeCarpetBrushWithItems, makeTableBrushWithItems, makeMinimalRegistry } from '../../test/brushFixtures'
import { makeMapData, makeTile, makeItem } from '../../test/fixtures'
import {
  CARPET_CENTER, CARPET_NORTH, CARPET_EAST, CARPET_SOUTH, CARPET_WEST,
  CARPET_CORNER_NW, CARPET_CORNER_NE, CARPET_CORNER_SW, CARPET_CORNER_SE,
  CARPET_DIAGONAL_NW, CARPET_DIAGONAL_NE, CARPET_DIAGONAL_SE, CARPET_DIAGONAL_SW,
  CARPET_TYPES,
  TABLE_ALONE, TABLE_NORTH_END, TABLE_SOUTH_END, TABLE_VERTICAL,
  TABLE_TYPES,
  TILE_NORTH, TILE_SOUTH,
} from './CarpetTypes'

// Full carpet with all 14 alignments
function makeFullCarpet() {
  return makeCarpetBrushWithItems(1, 'red_carpet', {
    [CARPET_CENTER]: 800,
    [CARPET_NORTH]: 801,
    [CARPET_EAST]: 802,
    [CARPET_SOUTH]: 803,
    [CARPET_WEST]: 804,
    [CARPET_CORNER_NW]: 805,
    [CARPET_CORNER_NE]: 806,
    [CARPET_CORNER_SW]: 807,
    [CARPET_CORNER_SE]: 808,
    [CARPET_DIAGONAL_NW]: 809,
    [CARPET_DIAGONAL_NE]: 810,
    [CARPET_DIAGONAL_SE]: 811,
    [CARPET_DIAGONAL_SW]: 812,
  })
}

describe('doCarpets', () => {
  it('isolated carpet gets center alignment', () => {
    const carpet = makeFullCarpet()
    const registry = makeMinimalRegistry({ carpetBrushes: [carpet] })
    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 800 })])])

    const result = doCarpets(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 800 }]) // CARPET_CENTER
  })

  it('north neighbor produces correct alignment', () => {
    const carpet = makeFullCarpet()
    const registry = makeMinimalRegistry({ carpetBrushes: [carpet] })
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 800 })]), // north neighbor
      makeTile(5, 5, 7, [makeItem({ id: 800 })]), // center
    ])

    const result = doCarpets(5, 5, 7, map, registry)
    // TILE_NORTH=2, CARPET_TYPES[2] determines alignment
    const expectedAlignment = CARPET_TYPES[TILE_NORTH]
    const expectedId = carpet.carpetItems[expectedAlignment].items[0].id
    expect(result).toEqual([{ id: expectedId }])
  })

  it('all 8 neighbors gives center alignment', () => {
    const carpet = makeFullCarpet()
    const registry = makeMinimalRegistry({ carpetBrushes: [carpet] })
    const tiles = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        tiles.push(makeTile(5 + dx, 5 + dy, 7, [makeItem({ id: 800 })]))
      }
    }
    const map = makeMapData(tiles)

    const result = doCarpets(5, 5, 7, map, registry)
    // All 8 bits set → 255 → CARPET_TYPES[255] = 13 = CARPET_CENTER
    expect(result).toEqual([{ id: 800 }])
  })

  it('preserves item when alignment already matches', () => {
    const carpet = makeFullCarpet()
    const registry = makeMinimalRegistry({ carpetBrushes: [carpet] })
    // Isolated tile, center alignment → item 800 is already CARPET_CENTER
    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 800 })])])

    const result = doCarpets(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 800 }])
  })

  it('falls back to center when alignment slot is empty', () => {
    // Carpet with only center defined
    const carpet = makeCarpetBrushWithItems(1, 'sparse_carpet', {
      [CARPET_CENTER]: 800,
    })
    const registry = makeMinimalRegistry({ carpetBrushes: [carpet] })
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 800 })]), // north neighbor
      makeTile(5, 5, 7, [makeItem({ id: 800 })]), // center
    ])

    const result = doCarpets(5, 5, 7, map, registry)
    // Alignment slot empty → fallback to center
    expect(result).toEqual([{ id: 800 }])
  })

  it('falls back to first non-empty slot when center is also empty', () => {
    // Carpet with only NORTH defined
    const carpet = makeCarpetBrushWithItems(1, 'weird_carpet', {
      [CARPET_NORTH]: 801,
    })
    const registry = makeMinimalRegistry({ carpetBrushes: [carpet] })
    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 801 })])])

    const result = doCarpets(5, 5, 7, map, registry)
    // Isolated → alignment=CENTER(13) → slot empty → center empty → first slot with items
    expect(result).toEqual([{ id: 801 }])
  })
})

describe('doTables', () => {
  it('isolated table gets TABLE_ALONE alignment', () => {
    const table = makeTableBrushWithItems(1, 'wooden_table', {
      [TABLE_ALONE]: 900,
      [TABLE_NORTH_END]: 901,
      [TABLE_SOUTH_END]: 902,
      [TABLE_VERTICAL]: 903,
    })
    const registry = makeMinimalRegistry({ tableBrushes: [table] })
    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 900 })])])

    const result = doTables(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 900 }])
  })

  it('N+S neighbors give correct table alignment', () => {
    const table = makeTableBrushWithItems(1, 'wooden_table', {
      [TABLE_ALONE]: 900,
      [TABLE_NORTH_END]: 901,
      [TABLE_SOUTH_END]: 902,
      [TABLE_VERTICAL]: 903,
    })
    const registry = makeMinimalRegistry({ tableBrushes: [table] })
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 900 })]), // north
      makeTile(5, 5, 7, [makeItem({ id: 900 })]), // center
      makeTile(5, 6, 7, [makeItem({ id: 900 })]), // south
    ])

    const result = doTables(5, 5, 7, map, registry)
    // N+S → TILE_NORTH(2)|TILE_SOUTH(64)=66 → TABLE_TYPES[66]=5=TABLE_VERTICAL
    const expectedAlignment = TABLE_TYPES[TILE_NORTH | TILE_SOUTH]
    expect(expectedAlignment).toBe(TABLE_VERTICAL)
    expect(result).toEqual([{ id: 903 }])
  })
})

describe('getCarpetAlignment', () => {
  it('returns correct alignment for known item', () => {
    const carpet = makeFullCarpet()
    expect(getCarpetAlignment(carpet, 801)).toBe(CARPET_NORTH)
    expect(getCarpetAlignment(carpet, 808)).toBe(CARPET_CORNER_SE)
  })

  it('returns -1 for unknown item', () => {
    const carpet = makeFullCarpet()
    expect(getCarpetAlignment(carpet, 9999)).toBe(-1)
  })
})

describe('getTableAlignment', () => {
  it('returns correct alignment for known item', () => {
    const table = makeTableBrushWithItems(1, 'test', {
      [TABLE_ALONE]: 900,
      [TABLE_VERTICAL]: 903,
    })
    expect(getTableAlignment(table, 900)).toBe(TABLE_ALONE)
    expect(getTableAlignment(table, 903)).toBe(TABLE_VERTICAL)
  })

  it('returns -1 for unknown item', () => {
    const table = makeTableBrushWithItems(1, 'test', { [TABLE_ALONE]: 900 })
    expect(getTableAlignment(table, 9999)).toBe(-1)
  })
})
