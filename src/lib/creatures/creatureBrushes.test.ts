import { describe, it, expect } from 'vitest'
import { makeAppearanceData, makeItem, makeMapData, makeTile } from '../../test/fixtures'
import { MapMutator } from '../MapMutator'
import { SpawnManager } from './SpawnManager'
import type { CreatureBrushConfig } from './creatureBrushes'
import {
  canDrawMonster, drawMonster, eraseMonster,
  canDrawNpc, drawNpc, eraseNpc,
  canDrawSpawn, drawSpawn, eraseSpawn,
  applyCreatureBrush, eraseCreatureBrush,
} from './creatureBrushes'
import type { BrushSelection } from '../../hooks/tools/types'

// Ground item: id=100, bank flag makes it classify as 'ground'
const GROUND_ID = 100
const NON_GROUND_ID = 200

function makeTestAppearances() {
  return makeAppearanceData([
    [GROUND_ID, { bank: { waypoints: 0 } }],
    [NON_GROUND_ID, {}],
  ])
}

function makeDefaultConfig(overrides: Partial<CreatureBrushConfig> = {}): CreatureBrushConfig {
  return { spawnTime: 60, autoCreateSpawn: false, ...overrides }
}

describe('canDrawMonster', () => {
  const appearances = makeTestAppearances()

  it('returns false when tile is undefined', () => {
    const sm = new SpawnManager()
    expect(canDrawMonster(undefined, appearances, sm, false)).toBe(false)
  })

  it('returns false when tile has no ground', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: NON_GROUND_ID })])
    const sm = new SpawnManager()
    expect(canDrawMonster(tile, appearances, sm, false)).toBe(false)
  })

  it('returns false when tile is PZ', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.flags = 0x0001 // PZ
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    expect(canDrawMonster(tile, appearances, sm, false)).toBe(false)
  })

  it('returns false when no spawn coverage and autoCreate is false', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const sm = new SpawnManager()
    expect(canDrawMonster(tile, appearances, sm, false)).toBe(false)
  })

  it('returns true when in monster spawn', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    expect(canDrawMonster(tile, appearances, sm, false)).toBe(true)
  })

  it('returns true when autoCreateSpawn is true', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const sm = new SpawnManager()
    expect(canDrawMonster(tile, appearances, sm, true)).toBe(true)
  })
})

describe('drawMonster', () => {
  const appearances = makeTestAppearances()

  it('places a monster on a valid tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawMonster(mutator, 10, 10, 7, 'Rat', makeDefaultConfig(), mapData, appearances, sm)

    expect(tile.monsters).toHaveLength(1)
    expect(tile.monsters![0].name).toBe('Rat')
    expect(tile.monsters![0].isNpc).toBe(false)
    expect(tile.monsters![0].spawnTime).toBe(60)
  })

  it('skips duplicate monster', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.monsters = [{ name: 'Rat', direction: 2, spawnTime: 60, isNpc: false }]
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawMonster(mutator, 10, 10, 7, 'Rat', makeDefaultConfig(), mapData, appearances, sm)

    expect(tile.monsters).toHaveLength(1)
  })

  it('auto-creates spawn zone when needed', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawMonster(mutator, 10, 10, 7, 'Rat', makeDefaultConfig({ autoCreateSpawn: true }), mapData, appearances, sm)

    expect(tile.spawnMonster).toBeDefined()
    expect(tile.spawnMonster!.radius).toBe(1)
    expect(tile.monsters).toHaveLength(1)
  })

  it('does not place on PZ tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.flags = 0x0001
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawMonster(mutator, 10, 10, 7, 'Rat', makeDefaultConfig(), mapData, appearances, sm)

    expect(tile.monsters).toBeUndefined()
  })

  it('does not place on tile without ground', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: NON_GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawMonster(mutator, 10, 10, 7, 'Rat', makeDefaultConfig(), mapData, appearances, sm)

    expect(tile.monsters).toBeUndefined()
  })
})

describe('eraseMonster', () => {
  const appearances = makeTestAppearances()

  it('removes a monster by name', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.monsters = [{ name: 'Rat', direction: 2, spawnTime: 60, isNpc: false }]
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, appearances)

    eraseMonster(mutator, 10, 10, 7, 'Rat')

    expect(tile.monsters).toHaveLength(0)
  })
})

describe('canDrawNpc', () => {
  const appearances = makeTestAppearances()

  it('returns false when tile is undefined', () => {
    const sm = new SpawnManager()
    expect(canDrawNpc(undefined, appearances, sm, false)).toBe(false)
  })

  it('returns false when tile has no ground', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: NON_GROUND_ID })])
    const sm = new SpawnManager()
    expect(canDrawNpc(tile, appearances, sm, false)).toBe(false)
  })

  it('allows PZ tiles (NPCs can be in PZ)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.flags = 0x0001
    const sm = new SpawnManager()
    sm.addNpcSpawn(10, 10, 7, 1)
    expect(canDrawNpc(tile, appearances, sm, false)).toBe(true)
  })

  it('returns false when no spawn and no autoCreate', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const sm = new SpawnManager()
    expect(canDrawNpc(tile, appearances, sm, false)).toBe(false)
  })

  it('returns true with autoCreate', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const sm = new SpawnManager()
    expect(canDrawNpc(tile, appearances, sm, true)).toBe(true)
  })
})

describe('drawNpc', () => {
  const appearances = makeTestAppearances()

  it('places an NPC on a valid tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addNpcSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawNpc(mutator, 10, 10, 7, 'Shopkeeper', makeDefaultConfig(), mapData, appearances, sm)

    expect(tile.npc).toBeDefined()
    expect(tile.npc!.name).toBe('Shopkeeper')
    expect(tile.npc!.isNpc).toBe(true)
  })

  it('replaces existing NPC', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.npc = { name: 'OldNpc', direction: 2, spawnTime: 60, isNpc: true }
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addNpcSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawNpc(mutator, 10, 10, 7, 'NewNpc', makeDefaultConfig(), mapData, appearances, sm)

    expect(tile.npc!.name).toBe('NewNpc')
  })

  it('auto-creates NPC spawn zone when needed', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawNpc(mutator, 10, 10, 7, 'Shopkeeper', makeDefaultConfig({ autoCreateSpawn: true }), mapData, appearances, sm)

    expect(tile.spawnNpc).toBeDefined()
    expect(tile.spawnNpc!.radius).toBe(1)
    expect(tile.npc).toBeDefined()
  })
})

describe('eraseNpc', () => {
  const appearances = makeTestAppearances()

  it('removes NPC from tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.npc = { name: 'Shopkeeper', direction: 2, spawnTime: 60, isNpc: true }
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, appearances)

    eraseNpc(mutator, 10, 10, 7, 'Shopkeeper')

    expect(tile.npc).toBeUndefined()
  })
})

describe('canDrawSpawn', () => {
  const appearances = makeTestAppearances()

  it('returns false when tile is undefined (monster)', () => {
    expect(canDrawSpawn(undefined, appearances, 'monster')).toBe(false)
  })

  it('returns false when no ground (monster)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: NON_GROUND_ID })])
    expect(canDrawSpawn(tile, appearances, 'monster')).toBe(false)
  })

  it('returns false when spawn already exists (monster)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.spawnMonster = { radius: 3 }
    expect(canDrawSpawn(tile, appearances, 'monster')).toBe(false)
  })

  it('returns true on valid tile without existing spawn (monster)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    expect(canDrawSpawn(tile, appearances, 'monster')).toBe(true)
  })

  it('returns false when tile is undefined (npc)', () => {
    expect(canDrawSpawn(undefined, appearances, 'npc')).toBe(false)
  })

  it('returns false when no ground (npc)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: NON_GROUND_ID })])
    expect(canDrawSpawn(tile, appearances, 'npc')).toBe(false)
  })

  it('returns false when NPC spawn already exists', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.spawnNpc = { radius: 2 }
    expect(canDrawSpawn(tile, appearances, 'npc')).toBe(false)
  })

  it('returns true on valid tile (npc)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    expect(canDrawSpawn(tile, appearances, 'npc')).toBe(true)
  })
})

describe('drawSpawn', () => {
  const appearances = makeTestAppearances()

  it('creates monster spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawSpawn(mutator, 10, 10, 7, 3, mapData, appearances, 'monster')

    expect(tile.spawnMonster).toBeDefined()
    expect(tile.spawnMonster!.radius).toBe(3)
  })

  it('does not overwrite existing spawn', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.spawnMonster = { radius: 5 }
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawSpawn(mutator, 10, 10, 7, 3, mapData, appearances, 'monster')

    expect(tile.spawnMonster!.radius).toBe(5)
  })

  it('creates NPC spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    drawSpawn(mutator, 10, 10, 7, 2, mapData, appearances, 'npc')

    expect(tile.spawnNpc).toBeDefined()
    expect(tile.spawnNpc!.radius).toBe(2)
  })
})

describe('eraseSpawn', () => {
  const appearances = makeTestAppearances()

  it('removes monster spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.spawnMonster = { radius: 3 }
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 3)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    eraseSpawn(mutator, 10, 10, 7, 'monster')

    expect(tile.spawnMonster).toBeUndefined()
  })

  it('removes NPC spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.spawnNpc = { radius: 2 }
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addNpcSpawn(10, 10, 7, 2)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    eraseSpawn(mutator, 10, 10, 7, 'npc')

    expect(tile.spawnNpc).toBeUndefined()
  })
})

describe('applyCreatureBrush', () => {
  const appearances = makeTestAppearances()

  it('dispatches creature monster selection to drawMonster', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    const selection: BrushSelection = { mode: 'creature', creatureName: 'Rat', isNpc: false }
    applyCreatureBrush(selection, mutator, 10, 10, 7, makeDefaultConfig(), mapData, appearances, sm, 3)

    expect(tile.monsters).toHaveLength(1)
    expect(tile.monsters![0].name).toBe('Rat')
  })

  it('dispatches creature NPC selection to drawNpc', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addNpcSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    const selection: BrushSelection = { mode: 'creature', creatureName: 'Shopkeeper', isNpc: true }
    applyCreatureBrush(selection, mutator, 10, 10, 7, makeDefaultConfig(), mapData, appearances, sm, 3)

    expect(tile.npc).toBeDefined()
    expect(tile.npc!.name).toBe('Shopkeeper')
  })

  it('dispatches spawn monster selection to drawSpawnMonster', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    const selection: BrushSelection = { mode: 'spawn', spawnType: 'monster' }
    applyCreatureBrush(selection, mutator, 10, 10, 7, makeDefaultConfig(), mapData, appearances, sm, 5)

    expect(tile.spawnMonster).toBeDefined()
    expect(tile.spawnMonster!.radius).toBe(5)
  })

  it('dispatches spawn NPC selection to drawSpawnNpc', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    const selection: BrushSelection = { mode: 'spawn', spawnType: 'npc' }
    applyCreatureBrush(selection, mutator, 10, 10, 7, makeDefaultConfig(), mapData, appearances, sm, 4)

    expect(tile.spawnNpc).toBeDefined()
    expect(tile.spawnNpc!.radius).toBe(4)
  })
})

describe('eraseCreatureBrush', () => {
  const appearances = makeTestAppearances()

  it('dispatches creature monster erase', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.monsters = [{ name: 'Rat', direction: 2, spawnTime: 60, isNpc: false }]
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, appearances)

    const selection: BrushSelection = { mode: 'creature', creatureName: 'Rat', isNpc: false }
    eraseCreatureBrush(selection, mutator, 10, 10, 7)

    expect(tile.monsters).toHaveLength(0)
  })

  it('dispatches NPC erase', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.npc = { name: 'Shopkeeper', direction: 2, spawnTime: 60, isNpc: true }
    const mapData = makeMapData([tile])
    const mutator = new MapMutator(mapData, appearances)

    const selection: BrushSelection = { mode: 'creature', creatureName: 'Shopkeeper', isNpc: true }
    eraseCreatureBrush(selection, mutator, 10, 10, 7)

    expect(tile.npc).toBeUndefined()
  })

  it('dispatches spawn monster erase', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.spawnMonster = { radius: 3 }
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 3)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    const selection: BrushSelection = { mode: 'spawn', spawnType: 'monster' }
    eraseCreatureBrush(selection, mutator, 10, 10, 7)

    expect(tile.spawnMonster).toBeUndefined()
  })

  it('dispatches spawn NPC erase', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })])
    tile.spawnNpc = { radius: 2 }
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addNpcSpawn(10, 10, 7, 2)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    const selection: BrushSelection = { mode: 'spawn', spawnType: 'npc' }
    eraseCreatureBrush(selection, mutator, 10, 10, 7)

    expect(tile.spawnNpc).toBeUndefined()
  })
})
