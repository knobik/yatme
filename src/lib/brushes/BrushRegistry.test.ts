import { describe, it, expect } from 'vitest'
import { BrushRegistry } from './BrushRegistry'
import { createWallBrush, WALL_HORIZONTAL } from './WallTypes'
import { createCarpetBrush, CARPET_CENTER } from './CarpetTypes'
import { makeGroundBrush, makeAutoBorder } from '../../test/brushFixtures'

function makeRegistryWithGroundBrushes() {
  const grass = makeGroundBrush({
    id: 1, name: 'grass',
    items: [{ id: 10, chance: 50 }, { id: 11, chance: 50 }],
    totalChance: 100,
  })
  const sand = makeGroundBrush({
    id: 2, name: 'sand',
    friends: new Set(['grass']),
    items: [{ id: 20, chance: 100 }],
    totalChance: 100,
  })

  const border1 = makeAutoBorder(1, 100, [500, 501, 502])
  const borders = new Map<number, ReturnType<typeof makeAutoBorder>>()
  borders.set(1, border1)

  return { grass, sand, borders, border1 }
}

describe('BrushRegistry', () => {
  describe('ground brush lookup', () => {
    it('getBrushByName returns correct brush', () => {
      const { grass, sand, borders } = makeRegistryWithGroundBrushes()
      const reg = new BrushRegistry([grass, sand], borders)
      expect(reg.getBrushByName('grass')).toBe(grass)
      expect(reg.getBrushByName('sand')).toBe(sand)
    })

    it('getBrushForItem returns brush owning that item ID', () => {
      const { grass, sand, borders } = makeRegistryWithGroundBrushes()
      const reg = new BrushRegistry([grass, sand], borders)
      expect(reg.getBrushForItem(10)).toBe(grass)
      expect(reg.getBrushForItem(20)).toBe(sand)
    })

    it('unknown name/ID returns undefined', () => {
      const { grass, borders } = makeRegistryWithGroundBrushes()
      const reg = new BrushRegistry([grass], borders)
      expect(reg.getBrushByName('nonexistent')).toBeUndefined()
      expect(reg.getBrushForItem(999)).toBeUndefined()
    })
  })

  describe('friend resolution', () => {
    it('friend names resolved to numeric IDs', () => {
      const { grass, sand, borders } = makeRegistryWithGroundBrushes()
      new BrushRegistry([grass, sand], borders)
      // sand has friend 'grass', grass.id = 1
      expect(sand.friendIds.has(1)).toBe(true)
    })

    it('"all" friend maps to 0xFFFFFFFF', () => {
      const brush = makeGroundBrush({
        id: 1, name: 'allFriend',
        friends: new Set(['all']),
        items: [{ id: 10, chance: 100 }],
        totalChance: 100,
      })
      new BrushRegistry([brush], new Map())
      expect(brush.friendIds.has(0xFFFFFFFF)).toBe(true)
    })

    it('unresolved friend name is silently skipped', () => {
      const brush = makeGroundBrush({
        id: 1, name: 'lonely',
        friends: new Set(['missing_brush']),
        items: [{ id: 10, chance: 100 }],
        totalChance: 100,
      })
      new BrushRegistry([brush], new Map())
      expect(brush.friendIds.size).toBe(0)
    })
  })

  describe('border item tracking', () => {
    it('isBorderItem returns true for items in AutoBorder tiles', () => {
      const { grass, borders } = makeRegistryWithGroundBrushes()
      const reg = new BrushRegistry([grass], borders)
      expect(reg.isBorderItem(500)).toBe(true)
      expect(reg.isBorderItem(501)).toBe(true)
      expect(reg.isBorderItem(999)).toBe(false)
    })

    it('getBorderItemGroup / getBorderItemAlignment return correct values', () => {
      const { grass, borders } = makeRegistryWithGroundBrushes()
      const reg = new BrushRegistry([grass], borders)
      expect(reg.getBorderItemGroup(500)).toBe(100) // group from border1
      expect(reg.getBorderItemAlignment(500)).toBe(0) // index 0
      expect(reg.getBorderItemAlignment(502)).toBe(2) // index 2
    })

    it('isOptionalBorderItem tracks optional border items', () => {
      const optBorder = makeAutoBorder(99, 200, [600, 601])
      const brush = makeGroundBrush({
        id: 1, name: 'mountain',
        items: [{ id: 10, chance: 100 }],
        totalChance: 100,
        optionalBorder: optBorder,
      })
      const reg = new BrushRegistry([brush], new Map())
      expect(reg.isOptionalBorderItem(600)).toBe(true)
      expect(reg.isOptionalBorderItem(601)).toBe(true)
      expect(reg.isOptionalBorderItem(999)).toBe(false)
    })
  })

  describe('wall/carpet/doodad lookup', () => {
    it('wall brush lookup works', () => {
      const wall = createWallBrush()
      wall.id = 1
      wall.name = 'stone_wall'
      wall.wallItems[WALL_HORIZONTAL].items.push({ id: 700, chance: 100 })
      wall.wallItems[WALL_HORIZONTAL].totalChance = 100

      const reg = new BrushRegistry([], new Map(), [wall])
      expect(reg.getWallBrushByName('stone_wall')).toBe(wall)
      expect(reg.isWallItem(700)).toBe(true)
      expect(reg.isWallItem(999)).toBe(false)
    })

    it('carpet brush lookup works', () => {
      const carpet = createCarpetBrush()
      carpet.id = 1
      carpet.name = 'red_carpet'
      carpet.carpetItems[CARPET_CENTER].items.push({ id: 800, chance: 100 })
      carpet.carpetItems[CARPET_CENTER].totalChance = 100

      const reg = new BrushRegistry([], new Map(), [], [carpet])
      expect(reg.getCarpetBrushByName('red_carpet')).toBe(carpet)
      expect(reg.getCarpetBrushForItem(800)).toBe(carpet)
      expect(reg.isCarpetItem(800)).toBe(true)
    })
  })

  describe('border block toName resolution', () => {
    it('resolves toName to brush ID', () => {
      const grass = makeGroundBrush({
        id: 1, name: 'grass',
        items: [{ id: 10, chance: 100 }],
        totalChance: 100,
        borders: [{ outer: false, to: 0, toName: 'sand', autoborder: null, specificCases: [] }],
      })
      const sand = makeGroundBrush({
        id: 2, name: 'sand',
        items: [{ id: 20, chance: 100 }],
        totalChance: 100,
      })
      new BrushRegistry([grass, sand], new Map())
      expect(grass.borders[0].to).toBe(2)
    })

    it('missing target sets to = -1', () => {
      const brush = makeGroundBrush({
        id: 1, name: 'test',
        items: [{ id: 10, chance: 100 }],
        totalChance: 100,
        borders: [{ outer: false, to: 0, toName: 'nonexistent', autoborder: null, specificCases: [] }],
      })
      new BrushRegistry([brush], new Map())
      expect(brush.borders[0].to).toBe(-1)
    })
  })

  describe('pickRandomItem', () => {
    it('returns valid item ID from brush', () => {
      const { grass, borders } = makeRegistryWithGroundBrushes()
      const reg = new BrushRegistry([grass], borders)
      const itemId = reg.pickRandomItem(grass)
      expect([10, 11]).toContain(itemId)
    })

    it('returns 0 for empty brush', () => {
      const brush = makeGroundBrush({ id: 1, name: 'empty' })
      const reg = new BrushRegistry([brush], new Map())
      expect(reg.pickRandomItem(brush)).toBe(0)
    })

    it('returns first item when totalChance is 0', () => {
      const brush = makeGroundBrush({
        id: 1, name: 'zero',
        items: [{ id: 42, chance: 0 }],
        totalChance: 0,
      })
      const reg = new BrushRegistry([brush], new Map())
      expect(reg.pickRandomItem(brush)).toBe(42)
    })
  })

  describe('door items', () => {
    it('door items tracked correctly', () => {
      const wall = createWallBrush()
      wall.id = 1
      wall.name = 'test_wall'
      wall.doorItems[WALL_HORIZONTAL] = [
        { id: 900, type: 2, open: false },
        { id: 901, type: 2, open: true },
      ]

      const reg = new BrushRegistry([], new Map(), [wall])
      expect(reg.isDoorItem(900)).toBe(true)
      expect(reg.isDoorItem(901)).toBe(true)
      expect(reg.isDoorItem(999)).toBe(false)
      expect(reg.getDoorInfo(900)).toEqual({ id: 900, type: 2, open: false })
    })
  })
})
