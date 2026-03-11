// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { applyMonsterSpawns, applyNpcSpawns } from './applySpawns'
import { SpawnManager } from './SpawnManager'
import { CreatureDatabase } from './CreatureDatabase'
import { createEmptyMap, tileKey } from '../otbm'
import type { SpawnPoint } from '../sidecars'

function makeDb(): CreatureDatabase {
  const db = new CreatureDatabase()
  db.addMonstersFromXml(`
    <monsters>
      <monster name="Rat" looktype="21" />
      <monster name="Cyclops" looktype="22" />
    </monsters>
  `)
  db.addNpcsFromXml(`
    <npcs>
      <npc name="Sam" looktype="128" />
    </npcs>
  `)
  return db
}

describe('applyMonsterSpawns', () => {
  it('applies spawn center and creatures to tiles', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 3,
      creatures: [
        { name: 'Rat', x: 101, y: 100, z: 7, spawnTime: 60, direction: 2, weight: 50 },
        { name: 'Cyclops', x: 100, y: 101, z: 7, spawnTime: 120, direction: 1 },
      ],
    }]

    const result = applyMonsterSpawns(spawns, mapData, sm, db)

    expect(result.spawnsApplied).toBe(1)
    expect(result.creaturesApplied).toBe(2)
    expect(result.unknownCreatures).toEqual([])

    // Center tile has spawnMonster
    const center = mapData.tiles.get(tileKey(100, 100, 7))!
    expect(center.spawnMonster).toEqual({ radius: 3 })

    // Creature tiles have monsters
    const ratTile = mapData.tiles.get(tileKey(101, 100, 7))!
    expect(ratTile.monsters).toHaveLength(1)
    expect(ratTile.monsters![0].name).toBe('Rat')
    expect(ratTile.monsters![0].direction).toBe(2)
    expect(ratTile.monsters![0].weight).toBe(50)
    expect(ratTile.monsters![0].isNpc).toBe(false)

    const cyclopsTile = mapData.tiles.get(tileKey(100, 101, 7))!
    expect(cyclopsTile.monsters).toHaveLength(1)
    expect(cyclopsTile.monsters![0].name).toBe('Cyclops')
  })

  it('tracks unknown creatures but still applies them', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 50, centerY: 50, centerZ: 7, radius: 2,
      creatures: [
        { name: 'Dragon', x: 51, y: 50, z: 7, spawnTime: 300, direction: 0 },
        { name: 'Dragon', x: 52, y: 50, z: 7, spawnTime: 300, direction: 0 },
      ],
    }]

    const result = applyMonsterSpawns(spawns, mapData, sm, db)

    expect(result.unknownCreatures).toEqual(['Dragon'])
    expect(result.creaturesApplied).toBe(2)
    // Creature is still on the tile
    const tile = mapData.tiles.get(tileKey(51, 50, 7))!
    expect(tile.monsters![0].name).toBe('Dragon')
  })

  it('returns zero stats for empty spawns', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const result = applyMonsterSpawns([], mapData, sm, db)

    expect(result.spawnsApplied).toBe(0)
    expect(result.creaturesApplied).toBe(0)
    expect(result.unknownCreatures).toEqual([])
  })

  it('handles multiple creatures on the same tile', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 3,
      creatures: [
        { name: 'Rat', x: 100, y: 100, z: 7, spawnTime: 60, direction: 0 },
        { name: 'Cyclops', x: 100, y: 100, z: 7, spawnTime: 120, direction: 1 },
      ],
    }]

    applyMonsterSpawns(spawns, mapData, sm, db)

    const tile = mapData.tiles.get(tileKey(100, 100, 7))!
    expect(tile.monsters).toHaveLength(2)
    expect(tile.monsters![0].name).toBe('Rat')
    expect(tile.monsters![1].name).toBe('Cyclops')
  })

  it('skips creatures with empty names', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 2,
      creatures: [
        { name: '', x: 101, y: 100, z: 7, spawnTime: 60, direction: 0 },
        { name: 'Rat', x: 102, y: 100, z: 7, spawnTime: 60, direction: 0 },
      ],
    }]

    const result = applyMonsterSpawns(spawns, mapData, sm, db)

    expect(result.creaturesApplied).toBe(1)
    expect(mapData.tiles.has(tileKey(101, 100, 7))).toBe(false)
  })

  it('creates tiles when missing from mapData', () => {
    const mapData = createEmptyMap()
    expect(mapData.tiles.size).toBe(0)

    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 200, centerY: 200, centerZ: 7, radius: 1,
      creatures: [
        { name: 'Rat', x: 201, y: 200, z: 7, spawnTime: 60, direction: 0 },
      ],
    }]

    applyMonsterSpawns(spawns, mapData, sm, db)

    // Both center and creature tile created
    expect(mapData.tiles.has(tileKey(200, 200, 7))).toBe(true)
    expect(mapData.tiles.has(tileKey(201, 200, 7))).toBe(true)
  })

  it('integrates with SpawnManager correctly', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 2,
      creatures: [],
    }]

    applyMonsterSpawns(spawns, mapData, sm, db)

    expect(sm.isInMonsterSpawn(100, 100, 7)).toBe(true)
    expect(sm.isInMonsterSpawn(101, 100, 7)).toBe(true)
    expect(sm.isInMonsterSpawn(98, 100, 7)).toBe(true)
    expect(sm.isInMonsterSpawn(97, 100, 7)).toBe(false)
  })

  it('clamps invalid direction values to NORTH', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 2,
      creatures: [
        { name: 'Rat', x: 101, y: 100, z: 7, spawnTime: 60, direction: 5 },
        { name: 'Rat', x: 102, y: 100, z: 7, spawnTime: 60, direction: -1 },
      ],
    }]

    applyMonsterSpawns(spawns, mapData, sm, db)

    const t1 = mapData.tiles.get(tileKey(101, 100, 7))!
    expect(t1.monsters![0].direction).toBe(0)
    const t2 = mapData.tiles.get(tileKey(102, 100, 7))!
    expect(t2.monsters![0].direction).toBe(0)
  })
})

describe('applyNpcSpawns', () => {
  it('applies NPC spawn center and creature to tile', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 5,
      creatures: [
        { name: 'Sam', x: 100, y: 100, z: 7, spawnTime: 60, direction: 2 },
      ],
    }]

    const result = applyNpcSpawns(spawns, mapData, sm, db)

    expect(result.spawnsApplied).toBe(1)
    expect(result.creaturesApplied).toBe(1)

    const tile = mapData.tiles.get(tileKey(100, 100, 7))!
    expect(tile.spawnNpc).toEqual({ radius: 5 })
    expect(tile.npc).toBeDefined()
    expect(tile.npc!.name).toBe('Sam')
    expect(tile.npc!.isNpc).toBe(true)
    expect(tile.npc!.direction).toBe(2)
  })

  it('replaces NPC on same tile', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [
      {
        centerX: 100, centerY: 100, centerZ: 7, radius: 3,
        creatures: [
          { name: 'Sam', x: 100, y: 100, z: 7, spawnTime: 60, direction: 0 },
        ],
      },
      {
        centerX: 100, centerY: 100, centerZ: 7, radius: 3,
        creatures: [
          { name: 'Unknown NPC', x: 100, y: 100, z: 7, spawnTime: 60, direction: 1 },
        ],
      },
    ]

    const result = applyNpcSpawns(spawns, mapData, sm, db)

    expect(result.creaturesApplied).toBe(2)
    const tile = mapData.tiles.get(tileKey(100, 100, 7))!
    expect(tile.npc!.name).toBe('Unknown NPC')
  })

  it('integrates with SpawnManager for NPC spawns', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 2,
      creatures: [],
    }]

    applyNpcSpawns(spawns, mapData, sm, db)

    expect(sm.isInNpcSpawn(100, 100, 7)).toBe(true)
    expect(sm.isInNpcSpawn(101, 101, 7)).toBe(true)
    expect(sm.isInNpcSpawn(97, 100, 7)).toBe(false)
  })

  it('NPC has no weight property', () => {
    const mapData = createEmptyMap()
    const sm = new SpawnManager()
    const db = makeDb()

    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 100, centerZ: 7, radius: 2,
      creatures: [
        { name: 'Sam', x: 100, y: 100, z: 7, spawnTime: 60, direction: 0 },
      ],
    }]

    applyNpcSpawns(spawns, mapData, sm, db)

    const tile = mapData.tiles.get(tileKey(100, 100, 7))!
    expect(tile.npc!.weight).toBeUndefined()
  })
})
