// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  parseHousesXml, serializeHousesXml,
  parseSpawnsXml, serializeSpawnsXml,
  parseZonesXml, serializeZonesXml,
  parseSidecars, serializeSidecars,
  emptySidecars,
  type HouseData, type SpawnPoint,
} from './sidecars'
import type { OtbmMap } from './otbm'
import type { MapBundle } from './storage/MapStorageProvider'

// --- Houses ---

const HOUSES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<houses>
\t<house houseid="1" name="Test House" entryx="100" entryy="200" entryz="7" rent="500" townid="1" size="20" clientid="10" guildhall="true" beds="3" />
\t<house houseid="2" name="Simple &amp; Small" entryx="110" entryy="210" entryz="7" rent="100" townid="1" size="5" />
</houses>`

describe('parseHousesXml', () => {
  it('parses house attributes', () => {
    const houses = parseHousesXml(HOUSES_XML)
    expect(houses).toHaveLength(2)
    expect(houses[0]).toEqual({
      id: 1, name: 'Test House',
      entryX: 100, entryY: 200, entryZ: 7,
      rent: 500, townId: 1, size: 20, clientId: 10,
      guildhall: true, beds: 3,
    })
    expect(houses[1]).toMatchObject({
      id: 2, name: 'Simple & Small',
      guildhall: false, beds: 0, clientId: 0,
    })
  })

  it('returns empty for empty XML', () => {
    expect(parseHousesXml('<houses></houses>')).toEqual([])
  })
})

describe('serializeHousesXml', () => {
  it('round-trips parsed houses', () => {
    const houses = parseHousesXml(HOUSES_XML)
    const xml = serializeHousesXml(houses)
    const reparsed = parseHousesXml(xml)
    expect(reparsed).toEqual(houses)
  })

  it('escapes special characters in names', () => {
    const houses: HouseData[] = [{
      id: 1, name: 'A & B "house"',
      entryX: 0, entryY: 0, entryZ: 7,
      rent: 0, townId: 0, size: 0, clientId: 0,
      guildhall: false, beds: 0,
    }]
    const xml = serializeHousesXml(houses)
    expect(xml).toContain('A &amp; B &quot;house&quot;')
    const reparsed = parseHousesXml(xml)
    expect(reparsed[0].name).toBe('A & B "house"')
  })
})

// --- Spawns ---

const MONSTER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<monsters>
\t<monster centerx="100" centery="200" centerz="7" radius="5">
\t\t<monster name="Rat" x="2" y="-1" z="7" spawntime="60" direction="2" weight="3" />
\t\t<monster name="Wolf" x="0" y="1" z="7" spawntime="90" />
\t</monster>
</monsters>`

const NPC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<npcs>
\t<npc centerx="50" centery="60" centerz="7" radius="1">
\t\t<npc name="Shopkeeper" x="0" y="0" z="7" spawntime="60" />
\t</npc>
</npcs>`

describe('parseSpawnsXml', () => {
  it('parses monster spawns with absolute positions', () => {
    const spawns = parseSpawnsXml(MONSTER_XML, 'monsters')
    expect(spawns).toHaveLength(1)
    expect(spawns[0].centerX).toBe(100)
    expect(spawns[0].radius).toBe(5)
    expect(spawns[0].creatures).toHaveLength(2)
    // Positions are absolute (center + offset)
    expect(spawns[0].creatures[0]).toMatchObject({
      name: 'Rat', x: 102, y: 199, z: 7,
      spawnTime: 60, direction: 2, weight: 3,
    })
    expect(spawns[0].creatures[1]).toMatchObject({
      name: 'Wolf', x: 100, y: 201, z: 7,
      spawnTime: 90, direction: 0,
    })
    // Wolf should not have weight
    expect(spawns[0].creatures[1].weight).toBeUndefined()
  })

  it('parses NPC spawns', () => {
    const spawns = parseSpawnsXml(NPC_XML, 'npcs')
    expect(spawns).toHaveLength(1)
    expect(spawns[0].creatures[0]).toMatchObject({
      name: 'Shopkeeper', x: 50, y: 60, z: 7,
    })
  })

  it('returns empty for empty XML', () => {
    expect(parseSpawnsXml('<monsters></monsters>', 'monsters')).toEqual([])
  })
})

describe('serializeSpawnsXml', () => {
  it('round-trips monster spawns with relative offsets', () => {
    const spawns = parseSpawnsXml(MONSTER_XML, 'monsters')
    const xml = serializeSpawnsXml(spawns, 'monsters')
    const reparsed = parseSpawnsXml(xml, 'monsters')
    expect(reparsed).toEqual(spawns)
  })

  it('round-trips NPC spawns', () => {
    const spawns = parseSpawnsXml(NPC_XML, 'npcs')
    const xml = serializeSpawnsXml(spawns, 'npcs')
    const reparsed = parseSpawnsXml(xml, 'npcs')
    expect(reparsed).toEqual(spawns)
  })

  it('serializes relative offsets correctly', () => {
    const spawns: SpawnPoint[] = [{
      centerX: 100, centerY: 200, centerZ: 7, radius: 3,
      creatures: [{ name: 'Rat', x: 102, y: 198, z: 7, spawnTime: 60, direction: 0 }],
    }]
    const xml = serializeSpawnsXml(spawns, 'monsters')
    expect(xml).toContain('x="2"')
    expect(xml).toContain('y="-2"')
  })
})

// --- Zones ---

const ZONES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<zones>
\t<zone name="boss.brain-head" zoneid="1" />
\t<zone name="protection_zone" zoneid="2" />
</zones>`

describe('parseZonesXml', () => {
  it('parses zone entries', () => {
    const zones = parseZonesXml(ZONES_XML)
    expect(zones).toEqual([
      { id: 1, name: 'boss.brain-head' },
      { id: 2, name: 'protection_zone' },
    ])
  })
})

describe('serializeZonesXml', () => {
  it('round-trips zones', () => {
    const zones = parseZonesXml(ZONES_XML)
    const xml = serializeZonesXml(zones)
    const reparsed = parseZonesXml(xml)
    expect(reparsed).toEqual(zones)
  })
})

// --- Orchestrators ---

describe('parseSidecars', () => {
  function makeBundle(sidecars: Record<string, string>): MapBundle {
    const encoder = new TextEncoder()
    const map = new Map<string, Uint8Array>()
    for (const [k, v] of Object.entries(sidecars)) {
      map.set(k, encoder.encode(v))
    }
    return { otbm: new Uint8Array(), sidecars: map, filename: 'test.otbm' }
  }

  function makeMap(overrides: Partial<OtbmMap> = {}): OtbmMap {
    return {
      version: 2, width: 100, height: 100,
      majorItems: 0, minorItems: 0,
      description: '', rawDescriptions: [],
      spawnFile: '', npcFile: '', houseFile: '', zoneFile: '',
      tiles: new Map(), towns: [], waypoints: [],
      ...overrides,
    }
  }

  it('parses all sidecar types from bundle', () => {
    const bundle = makeBundle({
      'map-house.xml': HOUSES_XML,
      'map-monster.xml': MONSTER_XML,
      'map-npc.xml': NPC_XML,
      'map-zones.xml': ZONES_XML,
    })
    const map = makeMap({
      houseFile: 'map-house.xml',
      spawnFile: 'map-monster.xml',
      npcFile: 'map-npc.xml',
      zoneFile: 'map-zones.xml',
    })

    const result = parseSidecars(bundle, map)
    expect(result.houses).toHaveLength(2)
    expect(result.monsterSpawns).toHaveLength(1)
    expect(result.npcSpawns).toHaveLength(1)
    expect(result.zones).toHaveLength(2)
  })

  it('returns empty arrays for missing sidecars', () => {
    const bundle = makeBundle({})
    const map = makeMap({ houseFile: 'missing.xml' })
    const result = parseSidecars(bundle, map)
    expect(result).toEqual(emptySidecars())
  })

  it('returns empty arrays when filenames are empty strings', () => {
    const bundle = makeBundle({})
    const map = makeMap()
    const result = parseSidecars(bundle, map)
    expect(result).toEqual(emptySidecars())
  })
})

describe('serializeSidecars', () => {
  it('serializes all sidecar types to bundle', () => {
    const sidecars = {
      houses: parseHousesXml(HOUSES_XML),
      monsterSpawns: parseSpawnsXml(MONSTER_XML, 'monsters'),
      npcSpawns: parseSpawnsXml(NPC_XML, 'npcs'),
      zones: parseZonesXml(ZONES_XML),
    }
    const map = {
      houseFile: 'h.xml', spawnFile: 's.xml', npcFile: 'n.xml', zoneFile: 'z.xml',
    } as OtbmMap

    const result = serializeSidecars(sidecars, map)
    expect(result.size).toBe(4)
    expect(result.has('h.xml')).toBe(true)
    expect(result.has('s.xml')).toBe(true)
    expect(result.has('n.xml')).toBe(true)
    expect(result.has('z.xml')).toBe(true)
  })

  it('skips sidecars with empty data', () => {
    const sidecars = emptySidecars()
    const map = { houseFile: 'h.xml', spawnFile: 's.xml', npcFile: '', zoneFile: '' } as OtbmMap
    const result = serializeSidecars(sidecars, map)
    expect(result.size).toBe(0)
  })
})
