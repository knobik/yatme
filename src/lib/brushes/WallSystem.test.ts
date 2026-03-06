import { describe, it, expect } from 'vitest'
import { doWalls, getWallAlignment } from './WallSystem'
import { makeWallBrushWithItems, makeMinimalRegistry } from '../../test/brushFixtures'
import { makeMapData, makeTile, makeItem } from '../../test/fixtures'
import {
  createWallBrush,
  WALL_POLE, WALL_SOUTH_END, WALL_VERTICAL, WALL_HORIZONTAL,
  WALL_INTERSECTION, WALL_UNTOUCHABLE, WALL_NORTHWEST_DIAGONAL,
  DOOR_NORMAL,
} from './WallTypes'

// All 17 alignments populated for a complete wall brush
function makeFullWallBrush(id: number, name: string, baseId: number) {
  const itemMap: Record<number, number> = {}
  for (let a = 0; a < 17; a++) {
    itemMap[a] = baseId + a
  }
  return makeWallBrushWithItems(id, name, itemMap)
}

describe('doWalls', () => {
  it('isolated wall gets WALL_POLE', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 100 })])])

    const result = doWalls(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 100 + WALL_POLE }])
  })

  it('north neighbor gives WALL_SOUTH_END', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 100 })]), // north
      makeTile(5, 5, 7, [makeItem({ id: 100 })]), // center
    ])

    const result = doWalls(5, 5, 7, map, registry)
    // N=1 → WALL_FULL_TYPES[1] = WALL_SOUTH_END
    expect(result).toEqual([{ id: 100 + WALL_SOUTH_END }])
  })

  it('N+S neighbors give WALL_VERTICAL', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 100 })]),
      makeTile(5, 5, 7, [makeItem({ id: 100 })]),
      makeTile(5, 6, 7, [makeItem({ id: 100 })]),
    ])

    const result = doWalls(5, 5, 7, map, registry)
    // N+S=1+8=9 → WALL_FULL_TYPES[9] = WALL_VERTICAL
    expect(result).toEqual([{ id: 100 + WALL_VERTICAL }])
  })

  it('W+E neighbors give WALL_HORIZONTAL', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    const map = makeMapData([
      makeTile(4, 5, 7, [makeItem({ id: 100 })]),
      makeTile(5, 5, 7, [makeItem({ id: 100 })]),
      makeTile(6, 5, 7, [makeItem({ id: 100 })]),
    ])

    const result = doWalls(5, 5, 7, map, registry)
    // W+E=2+4=6 → WALL_FULL_TYPES[6] = WALL_HORIZONTAL
    expect(result).toEqual([{ id: 100 + WALL_HORIZONTAL }])
  })

  it('all 4 neighbors give WALL_INTERSECTION', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 100 })]),
      makeTile(4, 5, 7, [makeItem({ id: 100 })]),
      makeTile(5, 5, 7, [makeItem({ id: 100 })]),
      makeTile(6, 5, 7, [makeItem({ id: 100 })]),
      makeTile(5, 6, 7, [makeItem({ id: 100 })]),
    ])

    const result = doWalls(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 100 + WALL_INTERSECTION }])
  })

  it('falls back to half type when full type slot is empty', () => {
    // Only WALL_POLE, WALL_VERTICAL, WALL_HORIZONTAL, WALL_NORTHWEST_DIAGONAL populated
    const wall = makeWallBrushWithItems(1, 'simple', {
      [WALL_POLE]: 100,
      [WALL_VERTICAL]: 109,
      [WALL_HORIZONTAL]: 106,
      [WALL_NORTHWEST_DIAGONAL]: 103,
    })
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    // N only → WALL_FULL_TYPES[1]=WALL_SOUTH_END (not populated) → WALL_HALF_TYPES[1]=WALL_VERTICAL
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 100 })]),
      makeTile(5, 5, 7, [makeItem({ id: 100 })]),
    ])

    const result = doWalls(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 109 }]) // WALL_VERTICAL from half type
  })

  it('walks redirect chain for items', () => {
    const primary = createWallBrush()
    primary.id = 1
    primary.name = 'primary'
    // Primary has no items at WALL_HORIZONTAL

    const redirect = makeWallBrushWithItems(2, 'redirect', {
      [WALL_POLE]: 200,
      [WALL_HORIZONTAL]: 206,
    })
    primary.redirectTo = redirect

    primary.wallItems[WALL_POLE].items.push({ id: 150, chance: 100 })
    primary.wallItems[WALL_POLE].totalChance = 100

    const reg2 = makeMinimalRegistry({ wallBrushes: [primary, redirect] })

    const map = makeMapData([
      makeTile(4, 5, 7, [makeItem({ id: 150 })]),
      makeTile(5, 5, 7, [makeItem({ id: 150 })]),
      makeTile(6, 5, 7, [makeItem({ id: 150 })]),
    ])

    const result = doWalls(5, 5, 7, map, reg2)
    // W+E=6 → WALL_HORIZONTAL, primary has no items there → follows redirect → 206
    expect(result).toEqual([{ id: 206 }])
  })

  it('prevents redirect loop', () => {
    const a = createWallBrush()
    a.id = 1
    a.name = 'a'
    a.wallItems[WALL_POLE].items.push({ id: 150, chance: 100 })
    a.wallItems[WALL_POLE].totalChance = 100

    const b = createWallBrush()
    b.id = 2
    b.name = 'b'

    a.redirectTo = b
    b.redirectTo = a

    const registry = makeMinimalRegistry({ wallBrushes: [a, b] })
    const map = makeMapData([
      makeTile(4, 5, 7, [makeItem({ id: 150 })]),
      makeTile(5, 5, 7, [makeItem({ id: 150 })]),
      makeTile(6, 5, 7, [makeItem({ id: 150 })]),
    ])

    // Should not hang — returns empty result (no item found via redirect loop)
    const result = doWalls(5, 5, 7, map, registry)
    expect(result).toEqual([])
  })

  it('friend walls count as matching neighbors', () => {
    const wall1 = makeFullWallBrush(1, 'stone', 100)
    const wall2 = makeFullWallBrush(2, 'brick', 200)
    wall1.friends = new Set(['brick'])

    const registry = makeMinimalRegistry({ wallBrushes: [wall1, wall2] })
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 200 })]), // north: brick (friend)
      makeTile(5, 5, 7, [makeItem({ id: 100 })]), // center: stone
    ])

    const result = doWalls(5, 5, 7, map, registry)
    // North friend detected → N=1 → WALL_SOUTH_END
    expect(result).toEqual([{ id: 100 + WALL_SOUTH_END }])
  })

  it('untouchable wall preserved despite neighbor changes', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    const untouchableId = 100 + WALL_UNTOUCHABLE

    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 100 })]),
      makeTile(5, 5, 7, [makeItem({ id: untouchableId })]),
    ])

    const result = doWalls(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: untouchableId }])
  })

  it('preserves item when alignment already matches', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })
    // Isolated tile → WALL_POLE, item is already 100 (WALL_POLE)
    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 100 })])])

    const result = doWalls(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 100 }])
  })

  it('preserves door with alignment change', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    wall.doorItems[WALL_HORIZONTAL] = [
      { id: 500, type: DOOR_NORMAL, open: false },
    ]
    wall.doorItems[WALL_VERTICAL] = [
      { id: 501, type: DOOR_NORMAL, open: false },
    ]
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })

    // Door at HORIZONTAL, but neighbors say VERTICAL
    const map = makeMapData([
      makeTile(5, 4, 7, [makeItem({ id: 100 })]),
      makeTile(5, 5, 7, [makeItem({ id: 500 })]), // door at horizontal
      makeTile(5, 6, 7, [makeItem({ id: 100 })]),
    ])

    const result = doWalls(5, 5, 7, map, registry)
    // N+S → VERTICAL → find door at VERTICAL → 501
    expect(result).toEqual([{ id: 501 }])
  })

  it('door falls back to regular wall when no door at new alignment', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    wall.doorItems[WALL_HORIZONTAL] = [
      { id: 500, type: DOOR_NORMAL, open: false },
    ]
    // No doors at WALL_POLE alignment
    const registry = makeMinimalRegistry({ wallBrushes: [wall] })

    // Isolated tile with door → should become WALL_POLE, no door there → regular wall
    const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 500 })])])

    const result = doWalls(5, 5, 7, map, registry)
    expect(result).toEqual([{ id: 100 + WALL_POLE }])
  })
})

describe('getWallAlignment', () => {
  it('returns correct alignment for known item', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    expect(getWallAlignment(wall, 100 + WALL_HORIZONTAL)).toBe(WALL_HORIZONTAL)
    expect(getWallAlignment(wall, 100 + WALL_VERTICAL)).toBe(WALL_VERTICAL)
  })

  it('returns -1 for unknown item', () => {
    const wall = makeFullWallBrush(1, 'stone', 100)
    expect(getWallAlignment(wall, 9999)).toBe(-1)
  })
})
