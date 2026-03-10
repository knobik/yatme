import { describe, it, expect, vi } from 'vitest'
import { classifyItem, isComplexItem, MapMutator } from './MapMutator'
import { makeAppearanceData, makeItem, makeTile, makeMapData } from '../test/fixtures'
import type { AppearanceFlags } from '../proto/appearances'

describe('classifyItem', () => {
  it.each<[string, Partial<AppearanceFlags>, string]>([
    ['bank flag', { bank: { waypoints: 0 } as AppearanceFlags['bank'] }, 'ground'],
    ['clip flag', { clip: true }, 'bottom'],
    ['bottom flag', { bottom: true }, 'bottom'],
    ['top flag', { top: true }, 'top'],
    ['no special flags', {}, 'common'],
  ])('classifies %s as %s', (_desc, flags, expected) => {
    const appearances = makeAppearanceData([[1, flags]])
    expect(classifyItem(1, appearances)).toBe(expected)
  })

  it('classifies unknown item as common', () => {
    const appearances = makeAppearanceData([])
    expect(classifyItem(999, appearances)).toBe('common')
  })
})

describe('isComplexItem', () => {
  it('returns false for plain item', () => {
    expect(isComplexItem(makeItem({ id: 1 }))).toBe(false)
  })

  it.each([
    ['actionId', { actionId: 100 }],
    ['uniqueId', { uniqueId: 200 }],
    ['text', { text: 'hello' }],
    ['description', { description: 'desc' }],
    ['teleportDestination', { teleportDestination: { x: 1, y: 2, z: 3 } }],
    ['depotId', { depotId: 5 }],
    ['customAttributes', { customAttributes: new Map([['key', { type: 1, value: 'v' }]]) }],
    ['items (container)', { items: [makeItem()] }],
  ] as const)('returns true for item with %s', (_label, props) => {
    expect(isComplexItem(makeItem(props as Record<string, unknown>))).toBe(true)
  })
})

describe('MapMutator eraseAllItems', () => {
  function setup(tileItems: { id: number; actionId?: number }[], appearances: [number, Partial<AppearanceFlags>][]) {
    const app = makeAppearanceData(appearances)
    const tile = makeTile(5, 5, 7, tileItems.map(i => makeItem(i)))
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, app)
    mutator.onTileChanged = vi.fn()
    return { mutator, mapData, tile }
  }

  it('removes all non-ground items', () => {
    const { mutator, tile } = setup(
      [{ id: 100 }, { id: 200 }, { id: 300 }],
      [[100, { bank: { waypoints: 0 } as AppearanceFlags['bank'] }], [200, {}], [300, {}]],
    )
    mutator.eraseAllItems(5, 5, 7, { leaveUnique: false })
    expect(tile.items).toHaveLength(1)
    expect(tile.items[0].id).toBe(100) // ground kept
  })

  it('never removes ground', () => {
    const { mutator, tile } = setup(
      [{ id: 100 }],
      [[100, { bank: { waypoints: 0 } as AppearanceFlags['bank'] }]],
    )
    mutator.eraseAllItems(5, 5, 7, { leaveUnique: false })
    expect(tile.items).toHaveLength(1)
  })

  it('preserves complex items when leaveUnique is true', () => {
    const { mutator, tile } = setup(
      [{ id: 100 }, { id: 200, actionId: 50 }, { id: 300 }],
      [[100, { bank: { waypoints: 0 } as AppearanceFlags['bank'] }], [200, {}], [300, {}]],
    )
    mutator.eraseAllItems(5, 5, 7, { leaveUnique: true })
    expect(tile.items).toHaveLength(2)
    expect(tile.items.map(i => i.id)).toEqual([100, 200])
  })

  it('preserves border items when leaveUnique is true', () => {
    const mockRegistry = { isBorderItem: vi.fn((id: number) => id === 200) }
    const { mutator, tile } = setup(
      [{ id: 100 }, { id: 200 }, { id: 300 }],
      [[100, { bank: { waypoints: 0 } as AppearanceFlags['bank'] }], [200, {}], [300, {}]],
    )
    mutator.brushRegistry = mockRegistry as never
    mutator.eraseAllItems(5, 5, 7, { leaveUnique: true })
    expect(tile.items.map(i => i.id)).toEqual([100, 200])
  })

  it('no-ops for empty tile', () => {
    const app = makeAppearanceData([])
    const mapData = makeMapData([])
    const mutator = new MapMutator(mapData, app)
    mutator.onTileChanged = vi.fn()
    mutator.eraseAllItems(5, 5, 7, { leaveUnique: false })
    expect(mutator.onTileChanged).not.toHaveBeenCalled()
  })
})

describe('MapMutator clearAllTileFlags', () => {
  it('zeroes flags on a tile', () => {
    const app = makeAppearanceData([])
    const tile = makeTile(5, 5, 7)
    tile.flags = 0x15
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, app)
    mutator.onTileChanged = vi.fn()

    mutator.clearAllTileFlags(5, 5, 7)
    expect(tile.flags).toBe(0)
    expect(mutator.onTileChanged).toHaveBeenCalledWith(5, 5, 7)
  })

  it('no-ops if flags are already 0', () => {
    const app = makeAppearanceData([])
    const tile = makeTile(5, 5, 7)
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, app)
    mutator.onTileChanged = vi.fn()

    mutator.clearAllTileFlags(5, 5, 7)
    expect(mutator.onTileChanged).not.toHaveBeenCalled()
  })
})

describe('MapMutator clearAllTileZones', () => {
  it('clears zones array', () => {
    const app = makeAppearanceData([])
    const tile = makeTile(5, 5, 7)
    ;(tile as Record<string, unknown>).zones = [1, 2, 3]
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, app)
    mutator.onTileChanged = vi.fn()

    mutator.clearAllTileZones(5, 5, 7)
    expect(tile.zones).toBeUndefined()
    expect(mutator.onTileChanged).toHaveBeenCalledWith(5, 5, 7)
  })

  it('no-ops if tile has no zones', () => {
    const app = makeAppearanceData([])
    const tile = makeTile(5, 5, 7)
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, app)
    mutator.onTileChanged = vi.fn()

    mutator.clearAllTileZones(5, 5, 7)
    expect(mutator.onTileChanged).not.toHaveBeenCalled()
  })
})
