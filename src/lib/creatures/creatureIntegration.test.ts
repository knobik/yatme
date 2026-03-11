// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { SpawnManager } from './SpawnManager'
import { MapMutator } from '../MapMutator'
import { CreatureDatabase } from './CreatureDatabase'
import { collectMonsterSpawns, collectNpcSpawns } from './spawnXmlWriter'
import { applyMonsterSpawns, applyNpcSpawns } from './applySpawns'
import { drawMonster, drawNpc } from './creatureBrushes'
import type { CreatureBrushConfig } from './creatureBrushes'
import { serializeSpawnsXml, parseSpawnsXml } from '../sidecars'
import { Direction, type TileCreature } from './types'
import { creatureAppearances as appearances, groundTile, makeMapData } from '../../test/fixtures'

function makeCreatureDb(): CreatureDatabase {
  const db = new CreatureDatabase()
  db.addMonstersFromXml(`
    <monsters>
      <monster name="Rat" looktype="21"/>
      <monster name="Bug" looktype="42"/>
    </monsters>
  `)
  db.addNpcsFromXml(`
    <npcs>
      <npc name="Josef" looktype="131"/>
    </npcs>
  `)
  return db
}

function setupEditor(tiles: ReturnType<typeof groundTile>[]) {
  const mapData = makeMapData(tiles)
  const sm = new SpawnManager()
  const mutator = new MapMutator(mapData, appearances)
  mutator.spawnManager = sm
  return { mapData, sm, mutator }
}

describe('Integration: Monster spawn round-trip', () => {
  it('place spawn → place creatures → export XML → reimport → verify', () => {
    const db = makeCreatureDb()
    const { mapData, sm, mutator } = setupEditor([
      groundTile(100, 100, 7),
      groundTile(101, 100, 7),
      groundTile(100, 101, 7),
    ])

    // Place spawn zone
    mutator.placeSpawnZone(100, 100, 7, 'monster', 2)

    // Place creatures
    const rat: TileCreature = { name: 'Rat', direction: Direction.EAST, spawnTime: 120, weight: 50, isNpc: false }
    const bug: TileCreature = { name: 'Bug', direction: Direction.WEST, spawnTime: 90, weight: 30, isNpc: false }
    mutator.placeCreature(100, 100, 7, rat)
    mutator.placeCreature(101, 100, 7, bug)

    // Export
    const collectResult = collectMonsterSpawns(mapData, sm)
    expect(collectResult.orphans).toHaveLength(0)
    expect(collectResult.spawns).toHaveLength(1)
    const xml = serializeSpawnsXml(collectResult.spawns, 'monsters')

    // Reimport into fresh map
    const parsed = parseSpawnsXml(xml, 'monsters')
    const freshMapData = makeMapData([
      groundTile(100, 100, 7),
      groundTile(101, 100, 7),
      groundTile(100, 101, 7),
    ])
    const freshSm = new SpawnManager()
    const result = applyMonsterSpawns(parsed, freshMapData, freshSm, db)

    // Verify spawn center
    expect(result.spawnsApplied).toBe(1)
    const centerTile = freshMapData.tiles.get('100,100,7')!
    expect(centerTile.spawnMonster).toBeDefined()
    expect(centerTile.spawnMonster!.radius).toBe(2)

    // Verify creatures preserved
    expect(result.creaturesApplied).toBe(2)
    const ratTile = freshMapData.tiles.get('100,100,7')!
    const ratCreature = ratTile.monsters?.find(m => m.name === 'Rat')
    expect(ratCreature).toBeDefined()
    expect(ratCreature!.direction).toBe(Direction.EAST)
    expect(ratCreature!.spawnTime).toBe(120)
    expect(ratCreature!.weight).toBe(50)

    const bugTile = freshMapData.tiles.get('101,100,7')!
    const bugCreature = bugTile.monsters?.find(m => m.name === 'Bug')
    expect(bugCreature).toBeDefined()
    expect(bugCreature!.direction).toBe(Direction.WEST)
    expect(bugCreature!.spawnTime).toBe(90)

    // Verify SpawnManager coverage
    expect(freshSm.isInMonsterSpawn(100, 100, 7)).toBe(true)
    expect(freshSm.isInMonsterSpawn(102, 102, 7)).toBe(true)

    // Verify no orphans after reimport
    const recheck = collectMonsterSpawns(freshMapData, freshSm)
    expect(recheck.orphans).toHaveLength(0)
  })
})

describe('Integration: NPC spawn round-trip', () => {
  it('place NPC spawn → place NPC → export XML → reimport → verify', () => {
    const db = makeCreatureDb()
    const { mapData, sm, mutator } = setupEditor([groundTile(200, 200, 7)])

    mutator.placeSpawnZone(200, 200, 7, 'npc', 1)

    const npc: TileCreature = { name: 'Josef', direction: Direction.NORTH, spawnTime: 180, isNpc: true }
    mutator.placeCreature(200, 200, 7, npc)

    // Export
    const collectResult = collectNpcSpawns(mapData, sm)
    expect(collectResult.orphans).toHaveLength(0)
    const xml = serializeSpawnsXml(collectResult.spawns, 'npcs')

    // Reimport
    const parsed = parseSpawnsXml(xml, 'npcs')
    const freshMap = makeMapData([groundTile(200, 200, 7)])
    const freshSm = new SpawnManager()
    const result = applyNpcSpawns(parsed, freshMap, freshSm, db)

    expect(result.spawnsApplied).toBe(1)
    expect(result.creaturesApplied).toBe(1)

    const tile = freshMap.tiles.get('200,200,7')!
    expect(tile.spawnNpc).toBeDefined()
    expect(tile.npc).toBeDefined()
    expect(tile.npc!.name).toBe('Josef')
    expect(tile.npc!.direction).toBe(Direction.NORTH)
    expect(tile.npc!.spawnTime).toBe(180)

    const recheck = collectNpcSpawns(freshMap, freshSm)
    expect(recheck.orphans).toHaveLength(0)
  })
})

describe('Integration: Undo/redo preserves creature state', () => {
  it('placeCreature → undo → tile empty → redo → creature restored', () => {
    const { mapData, sm, mutator } = setupEditor([groundTile(10, 10, 7)])
    sm.addMonsterSpawn(10, 10, 7, 1)

    const rat: TileCreature = { name: 'Rat', direction: Direction.SOUTH, spawnTime: 60, isNpc: false }
    mutator.placeCreature(10, 10, 7, rat)

    const tile = mapData.tiles.get('10,10,7')!
    expect(tile.monsters).toHaveLength(1)

    mutator.undo()
    expect(tile.monsters).toHaveLength(0)

    mutator.redo()
    expect(tile.monsters).toHaveLength(1)
    expect(tile.monsters![0].name).toBe('Rat')
    expect(tile.monsters![0].direction).toBe(Direction.SOUTH)
    expect(tile.monsters![0].spawnTime).toBe(60)
  })

  it('NPC place → undo → redo preserves NPC', () => {
    const { mapData, sm, mutator } = setupEditor([groundTile(20, 20, 7)])
    sm.addNpcSpawn(20, 20, 7, 1)

    const npc: TileCreature = { name: 'Josef', direction: Direction.EAST, spawnTime: 120, isNpc: true }
    mutator.placeCreature(20, 20, 7, npc)

    const tile = mapData.tiles.get('20,20,7')!
    expect(tile.npc).toBeDefined()

    mutator.undo()
    expect(tile.npc).toBeUndefined()

    mutator.redo()
    expect(tile.npc).toBeDefined()
    expect(tile.npc!.name).toBe('Josef')
    expect(tile.npc!.direction).toBe(Direction.EAST)
  })
})

describe('Integration: Auto-create spawn round-trip', () => {
  it('drawMonster with autoCreateSpawn → export → reimport preserves both', () => {
    const db = makeCreatureDb()
    const { mapData, sm, mutator } = setupEditor([groundTile(50, 50, 7)])

    const config: CreatureBrushConfig = { spawnTime: 60, weight: 100, autoCreateSpawn: true }
    drawMonster(mutator, 50, 50, 7, 'Rat', config, mapData, appearances, sm)

    // Verify auto-created spawn + creature
    const tile = mapData.tiles.get('50,50,7')!
    expect(tile.spawnMonster).toBeDefined()
    expect(tile.spawnMonster!.radius).toBe(1)
    expect(tile.monsters).toHaveLength(1)

    // Export
    const collectResult = collectMonsterSpawns(mapData, sm)
    expect(collectResult.orphans).toHaveLength(0)
    const xml = serializeSpawnsXml(collectResult.spawns, 'monsters')

    // Reimport
    const parsed = parseSpawnsXml(xml, 'monsters')
    const freshMap = makeMapData([groundTile(50, 50, 7)])
    const freshSm = new SpawnManager()
    applyMonsterSpawns(parsed, freshMap, freshSm, db)

    const freshTile = freshMap.tiles.get('50,50,7')!
    expect(freshTile.spawnMonster).toBeDefined()
    expect(freshTile.spawnMonster!.radius).toBe(1)
    expect(freshTile.monsters).toHaveLength(1)
    expect(freshTile.monsters![0].name).toBe('Rat')
    expect(freshTile.monsters![0].weight).toBe(100)

    // No orphans after reimport
    const recheck = collectMonsterSpawns(freshMap, freshSm)
    expect(recheck.orphans).toHaveLength(0)
  })

  it('drawNpc with autoCreateSpawn → export → reimport preserves both', () => {
    const db = makeCreatureDb()
    const { mapData, sm, mutator } = setupEditor([groundTile(60, 60, 7)])

    const config: CreatureBrushConfig = { spawnTime: 180, autoCreateSpawn: true }
    drawNpc(mutator, 60, 60, 7, 'Josef', config, mapData, appearances, sm)

    const collectResult = collectNpcSpawns(mapData, sm)
    expect(collectResult.orphans).toHaveLength(0)
    const xml = serializeSpawnsXml(collectResult.spawns, 'npcs')

    const parsed = parseSpawnsXml(xml, 'npcs')
    const freshMap = makeMapData([groundTile(60, 60, 7)])
    const freshSm = new SpawnManager()
    applyNpcSpawns(parsed, freshMap, freshSm, db)

    const freshTile = freshMap.tiles.get('60,60,7')!
    expect(freshTile.spawnNpc).toBeDefined()
    expect(freshTile.npc).toBeDefined()
    expect(freshTile.npc!.name).toBe('Josef')

    const recheck = collectNpcSpawns(freshMap, freshSm)
    expect(recheck.orphans).toHaveLength(0)
  })
})
