import { describe, it, expect, beforeEach } from 'vitest'
import { SpawnManager } from './SpawnManager'
import { MapMutator } from '../MapMutator'
import { collectMonsterSpawns } from './spawnXmlWriter'
import { canDrawMonster, drawMonster } from './creatureBrushes'
import type { CreatureBrushConfig } from './creatureBrushes'
import { creatureAppearances as appearances, groundTile, makeMapData, makeMonster } from '../../test/fixtures'

describe('Edge Cases: Orphan creatures', () => {
  let sm: SpawnManager

  beforeEach(() => {
    sm = new SpawnManager()
  })

  it('detects multiple orphan monsters on the same tile', () => {
    const tile = groundTile(10, 10, 7)
    tile.monsters = [makeMonster('Rat'), makeMonster('Bug')]
    const mapData = makeMapData([tile])
    // No spawn zone → both are orphans
    const result = collectMonsterSpawns(mapData, sm)
    expect(result.orphans).toHaveLength(2)
    expect(result.orphans).toContainEqual('Rat at 10,10,7')
    expect(result.orphans).toContainEqual('Bug at 10,10,7')
  })

  it('detects orphan after spawn zone deletion', () => {
    const center = groundTile(10, 10, 7)
    center.spawnMonster = { radius: 1 }
    center.monsters = [makeMonster('Rat')]
    const mapData = makeMapData([center])
    sm.addMonsterSpawn(10, 10, 7, 1)

    // Before deletion: not orphan
    const before = collectMonsterSpawns(mapData, sm)
    expect(before.orphans).toHaveLength(0)

    // Remove spawn zone from tile + SpawnManager
    delete center.spawnMonster
    sm.removeMonsterSpawn(10, 10, 7, 1)

    // After deletion: orphan
    const after = collectMonsterSpawns(mapData, sm)
    expect(after.orphans).toHaveLength(1)
    expect(after.orphans[0]).toBe('Rat at 10,10,7')
  })

  it('respects z-level: creature on z=7 is orphan when spawn is on z=8', () => {
    const spawnCenter = groundTile(10, 10, 8)
    spawnCenter.spawnMonster = { radius: 2 }
    const creatureTile = groundTile(10, 10, 7)
    creatureTile.monsters = [makeMonster('Rat')]
    const mapData = makeMapData([spawnCenter, creatureTile])
    sm.addMonsterSpawn(10, 10, 8, 2)

    const result = collectMonsterSpawns(mapData, sm)
    // Spawn is on z=8, creature is on z=7 → orphan
    expect(result.orphans).toHaveLength(1)
    expect(result.orphans[0]).toBe('Rat at 10,10,7')
  })
})

describe('Edge Cases: Overlapping spawn zones', () => {
  let sm: SpawnManager

  beforeEach(() => {
    sm = new SpawnManager()
  })

  it('three overlapping spawns give count=3 on shared tile', () => {
    sm.addMonsterSpawn(10, 10, 7, 1)
    sm.addMonsterSpawn(11, 10, 7, 1)
    sm.addMonsterSpawn(10, 11, 7, 1)
    // Tile (10,10,7) is within all three spawns
    expect(sm.getMonsterSpawnCount(10, 10, 7)).toBe(3)
  })

  it('creature in overlap exported to exactly one spawn (no duplicates)', () => {
    const c1 = groundTile(10, 10, 7)
    c1.spawnMonster = { radius: 2 }
    const c2 = groundTile(11, 10, 7)
    c2.spawnMonster = { radius: 2 }
    // Shared tile with a monster
    const shared = groundTile(10, 10, 7)
    shared.monsters = [makeMonster('Rat')]
    // Use c1 as the shared tile (it has the spawn center + monsters)
    c1.monsters = [makeMonster('Rat')]
    const mapData = makeMapData([c1, c2])
    sm.addMonsterSpawn(10, 10, 7, 2)
    sm.addMonsterSpawn(11, 10, 7, 2)

    const result = collectMonsterSpawns(mapData, sm)
    // Count total Rat creatures across all spawns — should be exactly 1
    let ratCount = 0
    for (const sp of result.spawns) {
      ratCount += sp.creatures.filter(c => c.name === 'Rat' && c.x === 10 && c.y === 10).length
    }
    expect(ratCount).toBe(1)
    expect(result.orphans).toHaveLength(0)
  })

  it('removing one overlapping spawn decrements count correctly on shared tiles', () => {
    sm.addMonsterSpawn(10, 10, 7, 1)
    sm.addMonsterSpawn(11, 10, 7, 1)
    sm.addMonsterSpawn(10, 11, 7, 1)
    expect(sm.getMonsterSpawnCount(10, 10, 7)).toBe(3)

    sm.removeMonsterSpawn(10, 11, 7, 1)
    expect(sm.getMonsterSpawnCount(10, 10, 7)).toBe(2)

    sm.removeMonsterSpawn(11, 10, 7, 1)
    expect(sm.getMonsterSpawnCount(10, 10, 7)).toBe(1)
  })
})

describe('Edge Cases: Auto-create spawn', () => {
  it('canDrawMonster returns false when autoCreateSpawn=false and no coverage', () => {
    const tile = groundTile(10, 10, 7)
    const sm = new SpawnManager()

    // canDrawMonster is the guard called by the tool before drawMonster
    const result = canDrawMonster(tile, appearances, sm, false)
    expect(result).toBe(false)

    // With autoCreate enabled, it returns true
    expect(canDrawMonster(tile, appearances, sm, true)).toBe(true)
  })

  it('auto-create on tile with existing opposite-type spawn creates separate spawn', () => {
    const tile = groundTile(10, 10, 7)
    tile.spawnNpc = { radius: 3 }
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addNpcSpawn(10, 10, 7, 3)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm
    const config: CreatureBrushConfig = { spawnTime: 60, autoCreateSpawn: true }

    drawMonster(mutator, 10, 10, 7, 'Rat', config, mapData, appearances, sm)

    // Monster placed, separate monster spawn auto-created
    expect(tile.monsters).toHaveLength(1)
    expect(tile.monsters![0].name).toBe('Rat')
    expect(tile.spawnMonster).toBeDefined()
    expect(tile.spawnMonster!.radius).toBe(1)
    // NPC spawn still there
    expect(tile.spawnNpc).toBeDefined()
    expect(tile.spawnNpc!.radius).toBe(3)
  })

  it('auto-created spawn always has radius=1', () => {
    const tile = groundTile(10, 10, 7)
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm
    const config: CreatureBrushConfig = { spawnTime: 60, autoCreateSpawn: true }

    drawMonster(mutator, 10, 10, 7, 'Rat', config, mapData, appearances, sm)

    expect(tile.spawnMonster).toBeDefined()
    expect(tile.spawnMonster!.radius).toBe(1)
  })
})

describe('Edge Cases: Deleting spawn zone with creatures inside', () => {
  it('creatures remain in tile after spawn deletion', () => {
    const tile = groundTile(10, 10, 7)
    tile.spawnMonster = { radius: 1 }
    tile.monsters = [makeMonster('Rat')]
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    mutator.removeSpawnZone(10, 10, 7, 'monster')

    // Creatures still on tile
    expect(tile.monsters).toHaveLength(1)
    expect(tile.monsters![0].name).toBe('Rat')
    // But spawn is gone
    expect(tile.spawnMonster).toBeUndefined()
  })

  it('creatures become orphans after spawn deletion in export', () => {
    const tile = groundTile(10, 10, 7)
    tile.spawnMonster = { radius: 1 }
    tile.monsters = [makeMonster('Rat')]
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    mutator.removeSpawnZone(10, 10, 7, 'monster')

    const result = collectMonsterSpawns(mapData, sm)
    expect(result.orphans).toHaveLength(1)
    expect(result.orphans[0]).toBe('Rat at 10,10,7')
  })

  it('undo restores spawn and creatures are no longer orphaned', () => {
    const tile = groundTile(10, 10, 7)
    tile.spawnMonster = { radius: 1 }
    tile.monsters = [makeMonster('Rat')]
    const mapData = makeMapData([tile])
    const sm = new SpawnManager()
    sm.addMonsterSpawn(10, 10, 7, 1)
    const mutator = new MapMutator(mapData, appearances)
    mutator.spawnManager = sm

    mutator.removeSpawnZone(10, 10, 7, 'monster')
    mutator.undo()

    // Spawn restored
    expect(tile.spawnMonster).toBeDefined()
    expect(tile.spawnMonster!.radius).toBe(1)
    // Creatures still there and no longer orphaned
    const result = collectMonsterSpawns(mapData, sm)
    expect(result.orphans).toHaveLength(0)
    expect(result.spawns).toHaveLength(1)
    expect(result.spawns[0].creatures).toHaveLength(1)
  })
})
