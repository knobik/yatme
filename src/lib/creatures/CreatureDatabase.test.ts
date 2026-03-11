// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CreatureDatabase, loadCreatureDatabase } from './CreatureDatabase'

const MONSTERS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<monsters>
  <monster name="Rat" looktype="21"/>
  <monster name="A Shielded Astral Glyph" lookitem="24226"/>
  <monster name="Achad" looktype="146" lookhead="95" lookbody="93" looklegs="38" lookfeet="59" lookaddons="3"/>
  <monster name="Dragon" looktype="34" lookmount="5"/>
</monsters>`

const NPCS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<npcs>
  <npc name="Josef" looktype="131" lookitem="0" lookaddon="2" lookhead="78" lookbody="85" looklegs="9" lookfeet="76" />
  <npc name="A Behemoth" looktype="55" lookitem="0" lookaddon="0" lookhead="0" lookbody="0" looklegs="0" lookfeet="0" />
  <npc name="Item NPC" looktype="0" lookitem="1234" lookaddon="0" />
</npcs>`

// --- Monster parsing ---

describe('addMonstersFromXml', () => {
  it('parses basic monster with looktype only', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)

    const rat = db.getByName('Rat')
    expect(rat).toBeDefined()
    expect(rat!.name).toBe('Rat')
    expect(rat!.lookType).toBe(21)
    expect(rat!.isNpc).toBe(false)
    expect(rat!.lookItem).toBeUndefined()
    expect(rat!.lookHead).toBeUndefined()
    expect(rat!.lookAddon).toBeUndefined()
  })

  it('parses lookitem monster (lookType=0 implied, lookItem set)', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)

    const glyph = db.getByName('A Shielded Astral Glyph')
    expect(glyph).toBeDefined()
    expect(glyph!.lookType).toBe(0)
    expect(glyph!.lookItem).toBe(24226)
  })

  it('parses monster with all color attrs and lookaddons (plural)', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)

    const achad = db.getByName('Achad')
    expect(achad).toBeDefined()
    expect(achad!.lookType).toBe(146)
    expect(achad!.lookHead).toBe(95)
    expect(achad!.lookBody).toBe(93)
    expect(achad!.lookLegs).toBe(38)
    expect(achad!.lookFeet).toBe(59)
    expect(achad!.lookAddon).toBe(3)
  })

  it('parses monster with lookmount', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)

    const dragon = db.getByName('Dragon')
    expect(dragon!.lookMount).toBe(5)
  })

  it('adds all monsters to getAllMonsters', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    expect(db.getAllMonsters()).toHaveLength(4)
  })
})

// --- NPC parsing ---

describe('addNpcsFromXml', () => {
  it('parses NPC with lookaddon (singular) and color attrs', () => {
    const db = new CreatureDatabase()
    db.addNpcsFromXml(NPCS_XML)

    const josef = db.getByName('Josef')
    expect(josef).toBeDefined()
    expect(josef!.name).toBe('Josef')
    expect(josef!.lookType).toBe(131)
    expect(josef!.lookAddon).toBe(2)
    expect(josef!.lookHead).toBe(78)
    expect(josef!.lookBody).toBe(85)
    expect(josef!.lookLegs).toBe(9)
    expect(josef!.lookFeet).toBe(76)
    expect(josef!.isNpc).toBe(true)
  })

  it('treats lookitem="0" as undefined', () => {
    const db = new CreatureDatabase()
    db.addNpcsFromXml(NPCS_XML)

    const josef = db.getByName('Josef')
    expect(josef!.lookItem).toBeUndefined()
  })

  it('stores lookHead/Body/Legs/Feet as 0 (valid color index)', () => {
    const db = new CreatureDatabase()
    db.addNpcsFromXml(NPCS_XML)

    const behemoth = db.getByName('A Behemoth')
    expect(behemoth!.lookHead).toBe(0)
    expect(behemoth!.lookBody).toBe(0)
    expect(behemoth!.lookLegs).toBe(0)
    expect(behemoth!.lookFeet).toBe(0)
  })

  it('stores lookAddon as 0 (means no addons)', () => {
    const db = new CreatureDatabase()
    db.addNpcsFromXml(NPCS_XML)

    const behemoth = db.getByName('A Behemoth')
    expect(behemoth!.lookAddon).toBe(0)
  })

  it('handles looktype=0 with nonzero lookitem', () => {
    const db = new CreatureDatabase()
    db.addNpcsFromXml(NPCS_XML)

    const itemNpc = db.getByName('Item NPC')
    expect(itemNpc!.lookType).toBe(0)
    expect(itemNpc!.lookItem).toBe(1234)
  })

  it('adds all NPCs to getAllNpcs', () => {
    const db = new CreatureDatabase()
    db.addNpcsFromXml(NPCS_XML)
    expect(db.getAllNpcs()).toHaveLength(3)
  })
})

// --- getByName ---

describe('getByName', () => {
  it('finds by exact name', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    expect(db.getByName('Rat')).toBeDefined()
  })

  it('is case-insensitive', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    expect(db.getByName('rat')!.name).toBe('Rat')
    expect(db.getByName('RAT')!.name).toBe('Rat')
    expect(db.getByName('rAt')!.name).toBe('Rat')
  })

  it('returns undefined for unknown name', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    expect(db.getByName('NonExistentCreature')).toBeUndefined()
  })
})

// --- getAllMonsters / getAllNpcs ---

describe('getAllMonsters / getAllNpcs', () => {
  it('returns correct separation between monsters and NPCs', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    db.addNpcsFromXml(NPCS_XML)

    expect(db.getAllMonsters()).toHaveLength(4)
    expect(db.getAllNpcs()).toHaveLength(3)
    expect(db.getAllMonsters().every(c => !c.isNpc)).toBe(true)
    expect(db.getAllNpcs().every(c => c.isNpc)).toBe(true)
  })

  it('returns empty arrays when nothing loaded', () => {
    const db = new CreatureDatabase()
    expect(db.getAllMonsters()).toEqual([])
    expect(db.getAllNpcs()).toEqual([])
  })
})

// --- search ---

describe('search', () => {
  it('finds by substring match', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    const results = db.search('shield')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('A Shielded Astral Glyph')
  })

  it('is case-insensitive', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    expect(db.search('RAT')).toHaveLength(1)
    expect(db.search('rat')).toHaveLength(1)
  })

  it('filters by isNpc=true', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    db.addNpcsFromXml(NPCS_XML)

    const npcsOnly = db.search('', true)
    expect(npcsOnly).toHaveLength(3)
    expect(npcsOnly.every(c => c.isNpc)).toBe(true)
  })

  it('filters by isNpc=false', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    db.addNpcsFromXml(NPCS_XML)

    const monstersOnly = db.search('', false)
    expect(monstersOnly).toHaveLength(4)
    expect(monstersOnly.every(c => !c.isNpc)).toBe(true)
  })

  it('returns all when query is empty and no type filter', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    db.addNpcsFromXml(NPCS_XML)

    expect(db.search('')).toHaveLength(7)
  })

  it('returns empty array for no match', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml(MONSTERS_XML)
    expect(db.search('zzzznoexist')).toEqual([])
  })
})

// --- Edge cases ---

describe('edge cases', () => {
  it('handles empty monsters XML', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml('<monsters></monsters>')
    expect(db.getAllMonsters()).toEqual([])
  })

  it('handles empty npcs XML', () => {
    const db = new CreatureDatabase()
    db.addNpcsFromXml('<npcs></npcs>')
    expect(db.getAllNpcs()).toEqual([])
  })

  it('skips elements with missing name attribute', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml('<monsters><monster looktype="21"/></monsters>')
    expect(db.getAllMonsters()).toEqual([])
  })

  it('sets isNpc correctly for each type', () => {
    const db = new CreatureDatabase()
    db.addMonstersFromXml('<monsters><monster name="Rat" looktype="21"/></monsters>')
    db.addNpcsFromXml('<npcs><npc name="Josef" looktype="131"/></npcs>')

    expect(db.getByName('Rat')!.isNpc).toBe(false)
    expect(db.getByName('Josef')!.isNpc).toBe(true)
  })
})

// --- loadCreatureDatabase ---

describe('loadCreatureDatabase', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('loads both monsters and NPCs successfully', async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const body = String(url).includes('monsters') ? MONSTERS_XML : NPCS_XML
      return Promise.resolve(new Response(body, { status: 200 }))
    }) as typeof fetch

    const db = await loadCreatureDatabase('/monsters.xml', '/npcs.xml')
    expect(db.getAllMonsters()).toHaveLength(4)
    expect(db.getAllNpcs()).toHaveLength(3)
  })

  it('returns partial database when monsters file fails', async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      if (String(url).includes('monsters')) {
        return Promise.resolve(new Response('', { status: 404 }))
      }
      return Promise.resolve(new Response(NPCS_XML, { status: 200 }))
    }) as typeof fetch

    const db = await loadCreatureDatabase('/monsters.xml', '/npcs.xml')
    expect(db.getAllMonsters()).toHaveLength(0)
    expect(db.getAllNpcs()).toHaveLength(3)
    expect(console.warn).toHaveBeenCalledWith(
      '[CreatureDatabase] Failed to load monsters:',
      expect.any(Error),
    )
  })

  it('returns partial database when NPCs file fails', async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      if (String(url).includes('npcs')) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve(new Response(MONSTERS_XML, { status: 200 }))
    }) as typeof fetch

    const db = await loadCreatureDatabase('/monsters.xml', '/npcs.xml')
    expect(db.getAllMonsters()).toHaveLength(4)
    expect(db.getAllNpcs()).toHaveLength(0)
    expect(console.warn).toHaveBeenCalledWith(
      '[CreatureDatabase] Failed to load NPCs:',
      expect.any(Error),
    )
  })

  it('returns empty database when both files fail', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error')),
    ) as typeof fetch

    const db = await loadCreatureDatabase('/monsters.xml', '/npcs.xml')
    expect(db.getAllMonsters()).toHaveLength(0)
    expect(db.getAllNpcs()).toHaveLength(0)
    expect(console.warn).toHaveBeenCalledTimes(2)
  })
})
