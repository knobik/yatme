// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { collectMonsterSpawns, collectNpcSpawns } from './spawnXmlWriter'
import { SpawnManager } from './SpawnManager'
import { createEmptyMap, tileKey } from '../otbm'
import type { OtbmTile } from '../otbm'
import { parseSpawnsXml, serializeSpawnsXml } from '../sidecars'
import { Direction } from './types'
import { makeMonster, makeNpc } from '../../test/fixtures'

/** Local makeTile that accepts partial OtbmTile overrides (creature fields, etc.) */
function makeTile(x: number, y: number, z: number, extra?: Partial<OtbmTile>): OtbmTile {
  return { x, y, z, flags: 0, items: [], ...extra }
}

describe('collectMonsterSpawns', () => {
  it('collects monsters from a single spawn center', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    // Set up spawn center at 100,100,7 with radius 3
    const center = makeTile(100, 100, 7, { spawnMonster: { radius: 3 } })
    map.tiles.set(tileKey(100, 100, 7), center)
    sm.addMonsterSpawn(100, 100, 7, 3)

    // Place two monsters within radius
    const t1 = makeTile(101, 100, 7, { monsters: [makeMonster('Rat', { weight: 50 })] })
    map.tiles.set(tileKey(101, 100, 7), t1)
    const t2 = makeTile(100, 101, 7, { monsters: [makeMonster('Cyclops', { spawnTime: 120 })] })
    map.tiles.set(tileKey(100, 101, 7), t2)

    const { spawns, orphans } = collectMonsterSpawns(map, sm)

    expect(spawns).toHaveLength(1)
    expect(spawns[0].centerX).toBe(100)
    expect(spawns[0].centerY).toBe(100)
    expect(spawns[0].centerZ).toBe(7)
    expect(spawns[0].radius).toBe(3)
    expect(spawns[0].creatures).toHaveLength(2)

    const rat = spawns[0].creatures.find(c => c.name === 'Rat')!
    expect(rat.x).toBe(101)
    expect(rat.y).toBe(100)
    expect(rat.weight).toBe(50)

    const cyclops = spawns[0].creatures.find(c => c.name === 'Cyclops')!
    expect(cyclops.spawnTime).toBe(120)

    expect(orphans).toHaveLength(0)
  })

  it('collects from multiple spawn centers', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    // Spawn 1 at 50,50,7
    map.tiles.set(tileKey(50, 50, 7), makeTile(50, 50, 7, { spawnMonster: { radius: 2 } }))
    sm.addMonsterSpawn(50, 50, 7, 2)
    map.tiles.set(tileKey(51, 50, 7), makeTile(51, 50, 7, { monsters: [makeMonster('Rat')] }))

    // Spawn 2 at 200,200,7
    map.tiles.set(tileKey(200, 200, 7), makeTile(200, 200, 7, { spawnMonster: { radius: 1 } }))
    sm.addMonsterSpawn(200, 200, 7, 1)
    map.tiles.set(tileKey(200, 201, 7), makeTile(200, 201, 7, { monsters: [makeMonster('Cyclops')] }))

    const { spawns } = collectMonsterSpawns(map, sm)
    expect(spawns).toHaveLength(2)

    const names = spawns.flatMap(s => s.creatures.map(c => c.name)).sort()
    expect(names).toEqual(['Cyclops', 'Rat'])
  })

  it('reports orphan monsters outside any spawn zone', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    // Spawn center at 100,100,7 radius 1
    map.tiles.set(tileKey(100, 100, 7), makeTile(100, 100, 7, { spawnMonster: { radius: 1 } }))
    sm.addMonsterSpawn(100, 100, 7, 1)

    // Monster outside radius (at 200,200)
    map.tiles.set(tileKey(200, 200, 7), makeTile(200, 200, 7, { monsters: [makeMonster('Rat')] }))

    const { spawns, orphans } = collectMonsterSpawns(map, sm)
    expect(spawns).toHaveLength(1)
    expect(spawns[0].creatures).toHaveLength(0)
    expect(orphans).toHaveLength(1)
    expect(orphans[0]).toContain('Rat')
    expect(orphans[0]).toContain('200,200,7')
  })

  it('produces an empty creatures array for spawn centers with no creatures', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    map.tiles.set(tileKey(100, 100, 7), makeTile(100, 100, 7, { spawnMonster: { radius: 2 } }))
    sm.addMonsterSpawn(100, 100, 7, 2)

    const { spawns } = collectMonsterSpawns(map, sm)
    expect(spawns).toHaveLength(1)
    expect(spawns[0].creatures).toHaveLength(0)
  })

  it('avoids duplicating creatures in overlapping spawn zones', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    // Two overlapping spawns: centers at 100,100 and 102,100, both radius 3
    map.tiles.set(tileKey(100, 100, 7), makeTile(100, 100, 7, { spawnMonster: { radius: 3 } }))
    sm.addMonsterSpawn(100, 100, 7, 3)
    map.tiles.set(tileKey(102, 100, 7), makeTile(102, 100, 7, { spawnMonster: { radius: 3 } }))
    sm.addMonsterSpawn(102, 100, 7, 3)

    // Monster at 101,100 — within radius of BOTH spawns
    map.tiles.set(tileKey(101, 100, 7), makeTile(101, 100, 7, { monsters: [makeMonster('Rat')] }))

    const { spawns } = collectMonsterSpawns(map, sm)
    const allCreatures = spawns.flatMap(s => s.creatures)
    // Rat should appear exactly once, not duplicated
    expect(allCreatures.filter(c => c.name === 'Rat')).toHaveLength(1)
  })

  it('round-trips through serialize → parse correctly', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    map.tiles.set(tileKey(100, 100, 7), makeTile(100, 100, 7, { spawnMonster: { radius: 5 } }))
    sm.addMonsterSpawn(100, 100, 7, 5)
    map.tiles.set(tileKey(102, 101, 7), makeTile(102, 101, 7, {
      monsters: [makeMonster('Rat', { direction: Direction.EAST, spawnTime: 90, weight: 100 })],
    }))
    map.tiles.set(tileKey(99, 100, 7), makeTile(99, 100, 7, {
      monsters: [makeMonster('Cyclops', { direction: Direction.WEST, spawnTime: 120 })],
    }))

    const { spawns } = collectMonsterSpawns(map, sm)
    const xml = serializeSpawnsXml(spawns, 'monsters')
    const parsed = parseSpawnsXml(xml, 'monsters')

    expect(parsed).toHaveLength(1)
    expect(parsed[0].centerX).toBe(100)
    expect(parsed[0].centerY).toBe(100)
    expect(parsed[0].radius).toBe(5)
    expect(parsed[0].creatures).toHaveLength(2)

    const rat = parsed[0].creatures.find(c => c.name === 'Rat')!
    expect(rat.x).toBe(102) // absolute coords after parse
    expect(rat.y).toBe(101)
    expect(rat.spawnTime).toBe(90)
    expect(rat.direction).toBe(Direction.EAST)
    expect(rat.weight).toBe(100)

    const cyclops = parsed[0].creatures.find(c => c.name === 'Cyclops')!
    expect(cyclops.x).toBe(99)
    expect(cyclops.y).toBe(100)
    expect(cyclops.direction).toBe(Direction.WEST)
  })
})

describe('collectNpcSpawns', () => {
  it('collects NPCs from a single spawn center', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    map.tiles.set(tileKey(50, 50, 7), makeTile(50, 50, 7, { spawnNpc: { radius: 2 } }))
    sm.addNpcSpawn(50, 50, 7, 2)
    map.tiles.set(tileKey(51, 50, 7), makeTile(51, 50, 7, { npc: makeNpc('Sam') }))

    const { spawns, orphans } = collectNpcSpawns(map, sm)

    expect(spawns).toHaveLength(1)
    expect(spawns[0].creatures).toHaveLength(1)
    expect(spawns[0].creatures[0].name).toBe('Sam')
    expect(spawns[0].creatures[0].x).toBe(51)
    expect(orphans).toHaveLength(0)
  })

  it('reports orphan NPCs', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    // NPC on tile with no spawn coverage
    map.tiles.set(tileKey(300, 300, 7), makeTile(300, 300, 7, { npc: makeNpc('Josef') }))

    const { spawns, orphans } = collectNpcSpawns(map, sm)
    expect(spawns).toHaveLength(0)
    expect(orphans).toHaveLength(1)
    expect(orphans[0]).toContain('Josef')
  })

  it('round-trips NPC spawns through serialize → parse', () => {
    const map = createEmptyMap()
    const sm = new SpawnManager()

    map.tiles.set(tileKey(80, 80, 7), makeTile(80, 80, 7, { spawnNpc: { radius: 3 } }))
    sm.addNpcSpawn(80, 80, 7, 3)
    map.tiles.set(tileKey(81, 80, 7), makeTile(81, 80, 7, {
      npc: makeNpc('Sam', { direction: Direction.SOUTH, spawnTime: 30 }),
    }))

    const { spawns } = collectNpcSpawns(map, sm)
    const xml = serializeSpawnsXml(spawns, 'npcs')
    const parsed = parseSpawnsXml(xml, 'npcs')

    expect(parsed).toHaveLength(1)
    expect(parsed[0].creatures).toHaveLength(1)
    expect(parsed[0].creatures[0].name).toBe('Sam')
    expect(parsed[0].creatures[0].x).toBe(81)
    expect(parsed[0].creatures[0].direction).toBe(Direction.SOUTH)
  })
})
