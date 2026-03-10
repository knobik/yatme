import { describe, it, expect } from 'vitest'
import { MapMutator } from './MapMutator'
import { SpawnManager } from './creatures/SpawnManager'
import { Direction } from './creatures/types'
import type { TileCreature } from './creatures/types'
import { makeAppearanceData, makeMapData, makeTile, makeItem } from '../test/fixtures'

function makeCreature(overrides: Partial<TileCreature> = {}): TileCreature {
  return {
    name: 'Rat',
    direction: Direction.SOUTH,
    spawnTime: 60,
    isNpc: false,
    ...overrides,
  }
}

function setup(tiles: ReturnType<typeof makeTile>[] = [], withSpawnManager = false) {
  const appearances = makeAppearanceData([[100, { bank: { waypoints: 0 } }]])
  const mapData = makeMapData(tiles)
  const mutator = new MapMutator(mapData, appearances)
  const spawnManager = withSpawnManager ? new SpawnManager() : null
  if (spawnManager) mutator.spawnManager = spawnManager
  return { mapData, mutator, spawnManager }
}

describe('MapMutator creature mutations', () => {
  // --- placeCreature ---

  it('places a monster on a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature())

    const t = mapData.tiles.get('10,10,7')!
    expect(t.monsters).toHaveLength(1)
    expect(t.monsters![0].name).toBe('Rat')
  })

  it('places an NPC on a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature({ name: 'Sam', isNpc: true }))

    const t = mapData.tiles.get('10,10,7')!
    expect(t.npc).toBeDefined()
    expect(t.npc!.name).toBe('Sam')
  })

  it('skips duplicate monster (same name)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeCreature()]
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature())

    expect(mapData.tiles.get('10,10,7')!.monsters).toHaveLength(1)
    expect(mutator.canUndo()).toBe(false)
  })

  it('replaces existing NPC', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.npc = makeCreature({ name: 'OldNpc', isNpc: true })
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature({ name: 'NewNpc', isNpc: true }))

    expect(mapData.tiles.get('10,10,7')!.npc!.name).toBe('NewNpc')
  })

  it('creates tile if needed when placing creature', () => {
    const { mapData, mutator } = setup([])

    mutator.placeCreature(5, 5, 7, makeCreature())

    const t = mapData.tiles.get('5,5,7')
    expect(t).toBeDefined()
    expect(t!.monsters).toHaveLength(1)
  })

  it('allows multiple different monsters on same tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature({ name: 'Rat' }))
    mutator.placeCreature(10, 10, 7, makeCreature({ name: 'Dragon' }))

    expect(mapData.tiles.get('10,10,7')!.monsters).toHaveLength(2)
  })

  // --- removeCreature ---

  it('removes a monster from a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeCreature(), makeCreature({ name: 'Dragon' })]
    const { mapData, mutator } = setup([tile])

    mutator.removeCreature(10, 10, 7, 'Rat', false)

    const t = mapData.tiles.get('10,10,7')!
    expect(t.monsters).toHaveLength(1)
    expect(t.monsters![0].name).toBe('Dragon')
  })

  it('removes NPC from a tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.npc = makeCreature({ name: 'Sam', isNpc: true })
    const { mapData, mutator } = setup([tile])

    mutator.removeCreature(10, 10, 7, 'Sam', true)

    expect(mapData.tiles.get('10,10,7')!.npc).toBeUndefined()
  })

  it('no-op when removing nonexistent monster', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mutator } = setup([tile])

    mutator.removeCreature(10, 10, 7, 'Ghost', false)

    expect(mutator.canUndo()).toBe(false)
  })

  // --- moveCreature ---

  it('moves a monster between tiles', () => {
    const tile1 = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile1.monsters = [makeCreature()]
    const tile2 = makeTile(11, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile1, tile2])

    mutator.moveCreature(10, 10, 7, 11, 10, 7, 'Rat', false)

    expect(mapData.tiles.get('10,10,7')!.monsters).toHaveLength(0)
    expect(mapData.tiles.get('11,10,7')!.monsters).toHaveLength(1)
    expect(mapData.tiles.get('11,10,7')!.monsters![0].name).toBe('Rat')
  })

  it('moves an NPC between tiles', () => {
    const tile1 = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile1.npc = makeCreature({ name: 'Sam', isNpc: true })
    const tile2 = makeTile(11, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile1, tile2])

    mutator.moveCreature(10, 10, 7, 11, 10, 7, 'Sam', true)

    expect(mapData.tiles.get('10,10,7')!.npc).toBeUndefined()
    expect(mapData.tiles.get('11,10,7')!.npc!.name).toBe('Sam')
  })

  // --- updateCreatureProperties ---

  it('updates monster properties', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeCreature()]
    const { mapData, mutator } = setup([tile])

    mutator.updateCreatureProperties(10, 10, 7, 'Rat', false, {
      direction: Direction.NORTH,
      spawnTime: 120,
      weight: 50,
    })

    const m = mapData.tiles.get('10,10,7')!.monsters![0]
    expect(m.direction).toBe(Direction.NORTH)
    expect(m.spawnTime).toBe(120)
    expect(m.weight).toBe(50)
  })

  it('updates NPC properties', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.npc = makeCreature({ name: 'Sam', isNpc: true })
    const { mapData, mutator } = setup([tile])

    mutator.updateCreatureProperties(10, 10, 7, 'Sam', true, {
      direction: Direction.EAST,
    })

    expect(mapData.tiles.get('10,10,7')!.npc!.direction).toBe(Direction.EAST)
  })

  // --- Undo / Redo for creatures ---

  it('undoes placeCreature (monster)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature())
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.monsters ?? []).toHaveLength(0)
  })

  it('redoes placeCreature (monster)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature())
    mutator.undo()
    mutator.redo()

    expect(mapData.tiles.get('10,10,7')!.monsters).toHaveLength(1)
    expect(mapData.tiles.get('10,10,7')!.monsters![0].name).toBe('Rat')
  })

  it('undoes placeCreature (NPC replacing existing)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.npc = makeCreature({ name: 'OldNpc', isNpc: true })
    const { mapData, mutator } = setup([tile])

    mutator.placeCreature(10, 10, 7, makeCreature({ name: 'NewNpc', isNpc: true }))
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.npc!.name).toBe('OldNpc')
  })

  it('undoes removeCreature (monster)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeCreature()]
    const { mapData, mutator } = setup([tile])

    mutator.removeCreature(10, 10, 7, 'Rat', false)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.monsters).toHaveLength(1)
    expect(mapData.tiles.get('10,10,7')!.monsters![0].name).toBe('Rat')
  })

  it('undoes removeCreature (NPC)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.npc = makeCreature({ name: 'Sam', isNpc: true })
    const { mapData, mutator } = setup([tile])

    mutator.removeCreature(10, 10, 7, 'Sam', true)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.npc!.name).toBe('Sam')
  })

  it('undoes moveCreature as single batch', () => {
    const tile1 = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile1.monsters = [makeCreature()]
    const tile2 = makeTile(11, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator } = setup([tile1, tile2])

    mutator.moveCreature(10, 10, 7, 11, 10, 7, 'Rat', false)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.monsters).toHaveLength(1)
    expect(mapData.tiles.get('11,10,7')!.monsters ?? []).toHaveLength(0)
  })

  it('undoes updateCreatureProperties (monster)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeCreature()]
    const { mapData, mutator } = setup([tile])

    mutator.updateCreatureProperties(10, 10, 7, 'Rat', false, { direction: Direction.NORTH })
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.monsters![0].direction).toBe(Direction.SOUTH)
  })

  it('undoes updateCreatureProperties (NPC)', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.npc = makeCreature({ name: 'Sam', isNpc: true, spawnTime: 60 })
    const { mapData, mutator } = setup([tile])

    mutator.updateCreatureProperties(10, 10, 7, 'Sam', true, { spawnTime: 300 })
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.npc!.spawnTime).toBe(60)
  })
})

describe('MapMutator spawn zone mutations', () => {
  it('places a monster spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator, spawnManager } = setup([tile], true)

    mutator.placeSpawnZone(10, 10, 7, 'monster', 3)

    expect(mapData.tiles.get('10,10,7')!.spawnMonster).toEqual({ radius: 3 })
    expect(spawnManager!.isInMonsterSpawn(10, 10, 7)).toBe(true)
  })

  it('places an NPC spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator, spawnManager } = setup([tile], true)

    mutator.placeSpawnZone(10, 10, 7, 'npc', 2)

    expect(mapData.tiles.get('10,10,7')!.spawnNpc).toEqual({ radius: 2 })
    expect(spawnManager!.isInNpcSpawn(10, 10, 7)).toBe(true)
  })

  it('skips if spawn already exists on tile', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.spawnMonster = { radius: 3 }
    const { mutator } = setup([tile], true)

    mutator.placeSpawnZone(10, 10, 7, 'monster', 5)

    expect(mutator.canUndo()).toBe(false)
  })

  it('removes a monster spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.spawnMonster = { radius: 3 }
    const { mapData, mutator, spawnManager } = setup([tile], true)
    // Sync spawn manager with existing spawn
    spawnManager!.addMonsterSpawn(10, 10, 7, 3)

    mutator.removeSpawnZone(10, 10, 7, 'monster')

    expect(mapData.tiles.get('10,10,7')!.spawnMonster).toBeUndefined()
    expect(spawnManager!.isInMonsterSpawn(10, 10, 7)).toBe(false)
  })

  it('removes an NPC spawn zone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.spawnNpc = { radius: 2 }
    const { mapData, mutator, spawnManager } = setup([tile], true)
    spawnManager!.addNpcSpawn(10, 10, 7, 2)

    mutator.removeSpawnZone(10, 10, 7, 'npc')

    expect(mapData.tiles.get('10,10,7')!.spawnNpc).toBeUndefined()
    expect(spawnManager!.isInNpcSpawn(10, 10, 7)).toBe(false)
  })

  it('updates spawn radius', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.spawnMonster = { radius: 3 }
    const { mapData, mutator, spawnManager } = setup([tile], true)
    spawnManager!.addMonsterSpawn(10, 10, 7, 3)

    mutator.updateSpawnRadius(10, 10, 7, 'monster', 5)

    expect(mapData.tiles.get('10,10,7')!.spawnMonster).toEqual({ radius: 5 })
    // Old radius tiles should be recalculated
    expect(spawnManager!.isInMonsterSpawn(10, 10, 7)).toBe(true)
  })

  it('no-op when updating to same radius', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.spawnMonster = { radius: 3 }
    const { mutator } = setup([tile], true)

    mutator.updateSpawnRadius(10, 10, 7, 'monster', 3)

    expect(mutator.canUndo()).toBe(false)
  })

  // --- Undo / Redo for spawn zones ---

  it('undoes placeSpawnZone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator, spawnManager } = setup([tile], true)

    mutator.placeSpawnZone(10, 10, 7, 'monster', 3)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.spawnMonster).toBeUndefined()
    expect(spawnManager!.isInMonsterSpawn(10, 10, 7)).toBe(false)
  })

  it('redoes placeSpawnZone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    const { mapData, mutator, spawnManager } = setup([tile], true)

    mutator.placeSpawnZone(10, 10, 7, 'monster', 3)
    mutator.undo()
    mutator.redo()

    expect(mapData.tiles.get('10,10,7')!.spawnMonster).toEqual({ radius: 3 })
    expect(spawnManager!.isInMonsterSpawn(10, 10, 7)).toBe(true)
  })

  it('undoes removeSpawnZone', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.spawnMonster = { radius: 3 }
    const { mapData, mutator, spawnManager } = setup([tile], true)
    spawnManager!.addMonsterSpawn(10, 10, 7, 3)

    mutator.removeSpawnZone(10, 10, 7, 'monster')
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.spawnMonster).toEqual({ radius: 3 })
    expect(spawnManager!.isInMonsterSpawn(10, 10, 7)).toBe(true)
  })

  it('undoes updateSpawnRadius', () => {
    const tile = makeTile(10, 10, 7, [makeItem({ id: 100 })])
    tile.spawnMonster = { radius: 3 }
    const { mapData, mutator, spawnManager } = setup([tile], true)
    spawnManager!.addMonsterSpawn(10, 10, 7, 3)

    mutator.updateSpawnRadius(10, 10, 7, 'monster', 5)
    mutator.undo()

    expect(mapData.tiles.get('10,10,7')!.spawnMonster).toEqual({ radius: 3 })
    expect(spawnManager!.isInMonsterSpawn(10, 10, 7)).toBe(true)
  })

  it('creates tile if needed when placing spawn zone', () => {
    const { mapData, mutator, spawnManager } = setup([], true)

    mutator.placeSpawnZone(5, 5, 7, 'monster', 3)

    expect(mapData.tiles.get('5,5,7')!.spawnMonster).toEqual({ radius: 3 })
    expect(spawnManager!.isInMonsterSpawn(5, 5, 7)).toBe(true)
  })
})
