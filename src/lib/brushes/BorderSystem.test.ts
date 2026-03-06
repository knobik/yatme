import { describe, it, expect } from 'vitest'
import { computeBorders } from './BorderSystem'
import {
  makeGroundBrush, makeAutoBorder, makeBorderBlock, makeSpecificCase,
  makeMinimalRegistry,
} from '../../test/brushFixtures'
import { makeMapData, makeTile, makeItem } from '../../test/fixtures'

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a grass/sand pair with border blocks for testing. */
function makeGrassSandSetup() {
  const borderAB = makeAutoBorder(1, 100, [
    null,               // 0: BORDER_NONE
    3001,               // 1: NORTH_HORIZONTAL
    3002,               // 2: EAST_HORIZONTAL
    3003,               // 3: SOUTH_HORIZONTAL
    3004,               // 4: WEST_HORIZONTAL
    3005,               // 5: NORTHWEST_CORNER
    3006,               // 6: NORTHEAST_CORNER
    3007,               // 7: SOUTHWEST_CORNER
    3008,               // 8: SOUTHEAST_CORNER
    3009,               // 9: NORTHWEST_DIAGONAL
    3010,               // 10: NORTHEAST_DIAGONAL
    3011,               // 11: SOUTHEAST_DIAGONAL
    3012,               // 12: SOUTHWEST_DIAGONAL
  ])

  const grass = makeGroundBrush({
    id: 1, name: 'grass', zOrder: 100,
    items: [{ id: 10, chance: 100 }], totalChance: 100,
    hasInnerBorder: true,
    borders: [makeBorderBlock({ outer: false, to: 2, autoborder: borderAB })],
  })

  const sand = makeGroundBrush({
    id: 2, name: 'sand', zOrder: 50,
    items: [{ id: 20, chance: 100 }], totalChance: 100,
    hasOuterBorder: true,
  })

  const borders = new Map([[1, borderAB]])
  return { grass, sand, borderAB, borders }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('computeBorders', () => {
  describe('basic neighbor tests', () => {
    it('returns empty array when no neighbors and no zilch border', () => {
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
      })
      const registry = makeMinimalRegistry({ groundBrushes: [grass] })
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])

      const result = computeBorders(5, 5, 7, map, registry)
      expect(result).toEqual([])
    })

    it('generates inner zilch border when all 8 neighbors empty', () => {
      const zilchBorder = makeAutoBorder(2, 200, [
        null, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010, 4011, 4012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerZilchBorder: true,
        borders: [makeBorderBlock({ outer: false, to: 0, autoborder: zilchBorder })],
      })
      const borders = new Map([[2, zilchBorder]])
      const registry = makeMinimalRegistry({ groundBrushes: [grass], borders })
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])

      const result = computeBorders(5, 5, 7, map, registry)
      // All 8 empty = 255 → S_HORIZ, E_HORIZ, N_HORIZ, W_HORIZ
      expect(result).toEqual([{ id: 4003 }, { id: 4002 }, { id: 4001 }, { id: 4004 }])
    })

    it('north neighbor (different brush) produces border items', () => {
      const { grass, sand, borders } = makeGrassSandSetup()
      const registry = makeMinimalRegistry({ groundBrushes: [grass, sand], borders })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]), // grass center
        makeTile(5, 4, 7, [makeItem({ id: 20 })]), // sand north
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // North neighbor = bit 1 (index 1 in NEIGHBOR_OFFSETS = [0,-1])
      // Bitmask = 2 → BORDER_TYPES[2] = 0x00000001 → NORTH_HORIZONTAL
      expect(result).toEqual([{ id: 3001 }])
    })

    it('east neighbor produces EAST_HORIZONTAL', () => {
      const { grass, sand, borders } = makeGrassSandSetup()
      const registry = makeMinimalRegistry({ groundBrushes: [grass, sand], borders })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]), // grass center
        makeTile(6, 5, 7, [makeItem({ id: 20 })]), // sand east
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // East = NEIGHBOR_OFFSETS index 4 → bit 4 = 16 → EAST_HORIZONTAL
      expect(result).toEqual([{ id: 3002 }])
    })

    it('two cardinal neighbors (N+E) produce packed border', () => {
      const { grass, sand, borders } = makeGrassSandSetup()
      const registry = makeMinimalRegistry({ groundBrushes: [grass, sand], borders })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),  // grass center
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),  // sand north (bit 1)
        makeTile(6, 5, 7, [makeItem({ id: 20 })]),  // sand east (bit 4)
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // Bitmask = bit1 | bit4 = 2|16 = 18 → NORTHEAST_DIAGONAL
      expect(result).toEqual([{ id: 3010 }])
    })

    it('diagonal-only neighbor (NW) produces NW corner', () => {
      const { grass, sand, borders } = makeGrassSandSetup()
      const registry = makeMinimalRegistry({ groundBrushes: [grass, sand], borders })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),  // grass center
        makeTile(4, 4, 7, [makeItem({ id: 20 })]),  // sand NW (bit 0)
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // Bitmask = bit0 = 1 → BORDER_TYPES[1] = 0x00000005 → NORTHWEST_CORNER
      expect(result).toEqual([{ id: 3005 }])
    })
  })

  describe('friend/hate tests', () => {
    it('friend brushes skip borders', () => {
      const { grass, sand, borders } = makeGrassSandSetup()
      grass.friends = new Set(['sand'])
      grass.friendIds = new Set([2])
      const registry = makeMinimalRegistry({ groundBrushes: [grass, sand], borders })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      expect(result).toEqual([])
    })

    it('hateFriends inverts friend list', () => {
      const borderAB = makeAutoBorder(1, 100, [
        null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        hateFriends: true,
        // hateFriends=true with sand's ID (2) in friendIds:
        // friendOf finds match → returns !hateFriends = false → NOT friend → borders compute.
        friendIds: new Set([2]),
        borders: [makeBorderBlock({ outer: false, to: 2, autoborder: borderAB })],
      })
      const sand = makeGroundBrush({
        id: 2, name: 'sand', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
      })

      const registry = makeMinimalRegistry({
        groundBrushes: [grass, sand],
        borders: new Map([[1, borderAB]]),
      })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // hateFriends=true, sand IS in friendIds → friendOf returns false → borders computed
      expect(result).toEqual([{ id: 3001 }])
    })
  })

  describe('inner/outer/zilch tests', () => {
    it('outer border from higher-zOrder neighbor', () => {
      const borderBA = makeAutoBorder(3, 300, [
        null, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010, 5011, 5012,
      ])
      const sand = makeGroundBrush({
        id: 2, name: 'sand', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
      })
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
        borders: [makeBorderBlock({ outer: true, to: 2, autoborder: borderBA })],
      })
      const registry = makeMinimalRegistry({
        groundBrushes: [sand, grass],
        borders: new Map([[3, borderBA]]),
      })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 20 })]), // sand center (lower zOrder)
        makeTile(5, 4, 7, [makeItem({ id: 10 })]), // grass north (higher zOrder)
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // Sand center sees grass north; grass.zOrder > sand.zOrder, grass has outer border targeting sand
      // North = bit1 = 2 → NORTH_HORIZONTAL
      expect(result).toEqual([{ id: 5001 }])
    })

    it('outer zilch border when center is empty', () => {
      const zilchBorder = makeAutoBorder(4, 400, [
        null, 6001, 6002, 6003, 6004, 6005, 6006, 6007, 6008, 6009, 6010, 6011, 6012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasOuterZilchBorder: true,
        borders: [makeBorderBlock({ outer: true, to: 0, autoborder: zilchBorder })],
      })
      const registry = makeMinimalRegistry({
        groundBrushes: [grass],
        borders: new Map([[4, zilchBorder]]),
      })
      // Empty center, grass to the north
      const map = makeMapData([
        makeTile(5, 4, 7, [makeItem({ id: 10 })]), // grass north
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // North = bit1 = 2 → NORTH_HORIZONTAL
      expect(result).toEqual([{ id: 6001 }])
    })

    it('two different neighbor brushes produce separate border clusters sorted by zOrder', () => {
      const borderGS = makeAutoBorder(1, 100, [
        null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, null, null, null, null,
      ])
      const borderGD = makeAutoBorder(2, 200, [
        null, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, null, null, null, null,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [
          makeBorderBlock({ outer: false, to: 2, autoborder: borderGS }),
          makeBorderBlock({ outer: false, to: 3, autoborder: borderGD }),
        ],
      })
      const sand = makeGroundBrush({
        id: 2, name: 'sand', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
      })
      const dirt = makeGroundBrush({
        id: 3, name: 'dirt', zOrder: 75,
        items: [{ id: 30, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
      })
      const registry = makeMinimalRegistry({
        groundBrushes: [grass, sand, dirt],
        borders: new Map([[1, borderGS], [2, borderGD]]),
      })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),  // grass center
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),  // sand north
        makeTile(5, 6, 7, [makeItem({ id: 30 })]),  // dirt south
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // Two separate borders: sand (zOrder=50) first, dirt (zOrder=75) second
      expect(result.length).toBe(2)
      // Sand north → bit1=2 → BORDER_TYPES[2] → NORTH_HORIZONTAL
      expect(result[0].id).toBe(3001) // sand border (lower z)
      // Dirt south → bit6=64 → BORDER_TYPES[64] → SOUTH_HORIZONTAL
      expect(result[1].id).toBe(4003) // dirt border (higher z)
    })

    it('same autoborder from multiple neighbors merges tiledata', () => {
      const { grass, sand, borders } = makeGrassSandSetup()
      const registry = makeMinimalRegistry({ groundBrushes: [grass, sand], borders })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),  // grass center
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),  // sand north (bit 1)
        makeTile(5, 6, 7, [makeItem({ id: 20 })]),  // sand south (bit 6)
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // Both sand neighbors use same autoborder → merged bitmask = 2|64 = 66
      // BORDER_TYPES[66] → S_HORIZ + N_HORIZ
      expect(result).toEqual([{ id: 3003 }, { id: 3001 }])
    })
  })

  describe('diagonal fallback tests', () => {
    it('produces diagonal item when diagonal tile exists', () => {
      const border = makeAutoBorder(1, 100, [
        null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [makeBorderBlock({ outer: false, to: 2, autoborder: border })],
      })
      const sand = makeGroundBrush({
        id: 2, name: 'sand', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
      })
      const registry = makeMinimalRegistry({
        groundBrushes: [grass, sand],
        borders: new Map([[1, border]]),
      })
      // N+E neighbors → should produce NORTHEAST_DIAGONAL item
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),  // north
        makeTile(6, 5, 7, [makeItem({ id: 20 })]),  // east
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // N(bit1=2) + E(bit4=16) = 18 → BORDER_TYPES[18] = 0x0000000a → NORTHEAST_DIAGONAL
      expect(result).toEqual([{ id: 3010 }])
    })

    it('decomposes to two cardinal items when diagonal tile is null', () => {
      const border = makeAutoBorder(1, 100, [
        null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008,
        null, // 9: NW_DIAGONAL = null (missing)
        null, // 10: NE_DIAGONAL = null
        null, // 11: SE_DIAGONAL = null
        null, // 12: SW_DIAGONAL = null
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [makeBorderBlock({ outer: false, to: 2, autoborder: border })],
      })
      const sand = makeGroundBrush({
        id: 2, name: 'sand', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
      })
      const registry = makeMinimalRegistry({
        groundBrushes: [grass, sand],
        borders: new Map([[1, border]]),
      })
      // N+E → NORTHEAST_DIAGONAL is null → decomposes to EAST_HORIZONTAL + NORTH_HORIZONTAL
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),
        makeTile(6, 5, 7, [makeItem({ id: 20 })]),
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      expect(result).toEqual([
        { id: 3002 }, // EAST_HORIZONTAL
        { id: 3001 }, // NORTH_HORIZONTAL
      ])
    })
  })

  describe('optional/mountain border tests', () => {
    it('emits optional border when tile has optional border items', () => {
      const optBorder = makeAutoBorder(5, 500, [
        null, 7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008, 7009, 7010, 7011, 7012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [makeBorderBlock({ outer: false, to: 2, autoborder: makeAutoBorder(1, 100, [
          null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
        ]) })],
      })
      const mountain = makeGroundBrush({
        id: 2, name: 'mountain', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
        optionalBorder: optBorder,
      })
      const borders = new Map([
        [1, grass.borders[0].autoborder!],
        [5, optBorder],
      ])
      const registry = makeMinimalRegistry({ groundBrushes: [grass, mountain], borders })

      // Tile has an optional border item (7001) → tileHasOptionalBorder = true
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 }), makeItem({ id: 7001 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // North neighbor (index 1) → tiledata=2 → BORDER_TYPES[2] → direction 1 (NORTH_HORIZONTAL)
      // Regular border tiles[1]=3001, optional border tiles[1]=7001
      expect(result).toEqual([{ id: 3001 }, { id: 7001 }])
    })

    it('suppresses optional border when tile lacks optional items', () => {
      const optBorder = makeAutoBorder(5, 500, [
        null, 7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008, 7009, 7010, 7011, 7012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [makeBorderBlock({ outer: false, to: 2, autoborder: makeAutoBorder(1, 100, [
          null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
        ]) })],
      })
      const mountain = makeGroundBrush({
        id: 2, name: 'mountain', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
        optionalBorder: optBorder,
      })
      const borders = new Map([
        [1, grass.borders[0].autoborder!],
        [5, optBorder],
      ])
      const registry = makeMinimalRegistry({ groundBrushes: [grass, mountain], borders })

      // No optional border items on tile → optional border suppressed
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // No optional border items on tile → only regular border emitted
      expect(result).toEqual([{ id: 3001 }])
    })

    it('useSoloOptionalBorder suppresses regular border', () => {
      const optBorder = makeAutoBorder(5, 500, [
        null, 7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008, 7009, 7010, 7011, 7012,
      ])
      const regBorder = makeAutoBorder(1, 100, [
        null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [makeBorderBlock({ outer: false, to: 2, autoborder: regBorder })],
      })
      const mountain = makeGroundBrush({
        id: 2, name: 'mountain', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
        optionalBorder: optBorder,
        useSoloOptionalBorder: true,
      })
      const borders = new Map([[1, regBorder], [5, optBorder]])
      const registry = makeMinimalRegistry({ groundBrushes: [grass, mountain], borders })

      // Tile has optional border item → optional border emitted, regular suppressed
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 }), makeItem({ id: 7001 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // useSoloOptionalBorder → only optional border, regular suppressed
      expect(result).toEqual([{ id: 7001 }])
    })
  })

  describe('specific case tests', () => {
    it('replaces item via specific case', () => {
      const border = makeAutoBorder(1, 100, [
        null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [makeBorderBlock({
          outer: false, to: 2, autoborder: border,
          specificCases: [makeSpecificCase({
            itemsToMatch: [3001],
            toReplaceId: 3001,
            withId: 9999,
          })],
        })],
      })
      const sand = makeGroundBrush({
        id: 2, name: 'sand', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
      })
      const registry = makeMinimalRegistry({
        groundBrushes: [grass, sand],
        borders: new Map([[1, border]]),
      })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]), // north
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // North → NORTH_HORIZONTAL = 3001 → specific case replaces with 9999
      expect(result).toEqual([{ id: 9999 }])
    })

    it('deleteAll removes matching items', () => {
      const border = makeAutoBorder(1, 100, [
        null, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
      ])
      const grass = makeGroundBrush({
        id: 1, name: 'grass', zOrder: 100,
        items: [{ id: 10, chance: 100 }], totalChance: 100,
        hasInnerBorder: true,
        borders: [makeBorderBlock({
          outer: false, to: 2, autoborder: border,
          specificCases: [makeSpecificCase({
            itemsToMatch: [3001],
            deleteAll: true,
          })],
        })],
      })
      const sand = makeGroundBrush({
        id: 2, name: 'sand', zOrder: 50,
        items: [{ id: 20, chance: 100 }], totalChance: 100,
        hasOuterBorder: true,
      })
      const registry = makeMinimalRegistry({
        groundBrushes: [grass, sand],
        borders: new Map([[1, border]]),
      })
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(5, 4, 7, [makeItem({ id: 20 })]),
      ])

      const result = computeBorders(5, 5, 7, map, registry)
      // NORTH_HORIZONTAL = 3001 → deleteAll removes it
      expect(result).toEqual([])
    })
  })

  it('full surround (all 8 neighbors same brush) produces correct result', () => {
    const { grass, sand, borders } = makeGrassSandSetup()
    const registry = makeMinimalRegistry({ groundBrushes: [grass, sand], borders })
    const tiles = [makeTile(5, 5, 7, [makeItem({ id: 10 })])]
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        tiles.push(makeTile(5 + dx, 5 + dy, 7, [makeItem({ id: 20 })]))
      }
    }
    const map = makeMapData(tiles)

    const result = computeBorders(5, 5, 7, map, registry)
    // All 8 bits = 255 → BORDER_TYPES[255] → S_HORIZ, E_HORIZ, N_HORIZ, W_HORIZ
    expect(result).toEqual([{ id: 3003 }, { id: 3002 }, { id: 3001 }, { id: 3004 }])
  })
})
