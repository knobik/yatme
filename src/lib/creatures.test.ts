// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseCreatureXml, getCreature, getCreatureList, isValidCreature, type CreatureDatabase } from './creatures'

function makeDb(...xmls: Array<{ xml: string; type: 'monster' | 'npc' }>): CreatureDatabase {
  const db: CreatureDatabase = new Map()
  for (const { xml, type } of xmls) {
    parseCreatureXml(xml, type, db)
  }
  return db
}

describe('parseCreatureXml', () => {
  it('parses monster with full outfit attributes', () => {
    const xml = `<monsters>
      <monster name="Achad" looktype="146" lookhead="95" lookbody="93" looklegs="38" lookfeet="59" lookaddons="3"/>
    </monsters>`
    const db = makeDb({ xml, type: 'monster' })
    const creature = db.get('achad')
    expect(creature).toBeDefined()
    expect(creature!.name).toBe('Achad')
    expect(creature!.type).toBe('monster')
    expect(creature!.outfit).toEqual({
      looktype: 146,
      lookhead: 95,
      lookbody: 93,
      looklegs: 38,
      lookfeet: 59,
      lookaddons: 3,
      lookitem: 0,
    })
  })

  it('parses monster with looktype only', () => {
    const xml = `<monsters><monster name="Demon" looktype="35"/></monsters>`
    const db = makeDb({ xml, type: 'monster' })
    const creature = db.get('demon')!
    expect(creature.outfit.looktype).toBe(35)
    expect(creature.outfit.lookhead).toBe(0)
    expect(creature.outfit.lookbody).toBe(0)
    expect(creature.outfit.looklegs).toBe(0)
    expect(creature.outfit.lookfeet).toBe(0)
    expect(creature.outfit.lookaddons).toBe(0)
  })

  it('parses monster with lookitem only', () => {
    const xml = `<monsters><monster name="Animated Sword" lookitem="24227"/></monsters>`
    const db = makeDb({ xml, type: 'monster' })
    const creature = db.get('animated sword')!
    expect(creature.outfit.looktype).toBe(0)
    expect(creature.outfit.lookitem).toBe(24227)
  })

  it('parses NPC with lookaddon (singular) attribute', () => {
    const xml = `<npcs>
      <npc name="A Beggar" looktype="153" lookitem="0" lookaddon="0" lookhead="39" lookbody="39" looklegs="39" lookfeet="76"/>
    </npcs>`
    const db = makeDb({ xml, type: 'npc' })
    const creature = db.get('a beggar')!
    expect(creature.type).toBe('npc')
    expect(creature.outfit.looktype).toBe(153)
    expect(creature.outfit.lookhead).toBe(39)
    expect(creature.outfit.lookaddons).toBe(0)
  })

  it('handles lookaddons attribute on NPCs that use it', () => {
    const xml = `<npcs><npc name="TestNpc" looktype="100" lookaddons="2"/></npcs>`
    const db = makeDb({ xml, type: 'npc' })
    expect(db.get('testnpc')!.outfit.lookaddons).toBe(2)
  })

  it('skips elements without name', () => {
    const xml = `<monsters><monster looktype="1"/></monsters>`
    const db = makeDb({ xml, type: 'monster' })
    expect(db.size).toBe(0)
  })

  it('first entry wins (no overwrite)', () => {
    const db: CreatureDatabase = new Map()
    parseCreatureXml(`<monsters><monster name="Rat" looktype="21"/></monsters>`, 'monster', db)
    parseCreatureXml(`<npcs><npc name="Rat" looktype="999"/></npcs>`, 'npc', db)
    expect(db.get('rat')!.type).toBe('monster')
    expect(db.get('rat')!.outfit.looktype).toBe(21)
  })
})

describe('getCreature', () => {
  it('returns creature with case-insensitive lookup', () => {
    const xml = `<monsters><monster name="Dragon Lord" looktype="39"/></monsters>`
    const db = makeDb({ xml, type: 'monster' })
    expect(getCreature(db, 'Dragon Lord')?.name).toBe('Dragon Lord')
    expect(getCreature(db, 'dragon lord')?.name).toBe('Dragon Lord')
    expect(getCreature(db, 'DRAGON LORD')?.name).toBe('Dragon Lord')
  })

  it('returns undefined for unknown creature', () => {
    const db: CreatureDatabase = new Map()
    expect(getCreature(db, 'nonexistent')).toBeUndefined()
  })
})

describe('getCreatureList', () => {
  const db = makeDb(
    { xml: `<monsters><monster name="Demon" looktype="35"/><monster name="Ant" looktype="50"/></monsters>`, type: 'monster' },
    { xml: `<npcs><npc name="Cipfried" looktype="128"/></npcs>`, type: 'npc' },
  )

  it('returns all creatures sorted by name', () => {
    const all = getCreatureList(db)
    expect(all.map(c => c.name)).toEqual(['Ant', 'Cipfried', 'Demon'])
  })

  it('filters by type', () => {
    const monsters = getCreatureList(db, 'monster')
    expect(monsters.map(c => c.name)).toEqual(['Ant', 'Demon'])

    const npcs = getCreatureList(db, 'npc')
    expect(npcs.map(c => c.name)).toEqual(['Cipfried'])
  })
})

describe('isValidCreature', () => {
  const db = makeDb({ xml: `<monsters><monster name="Rat" looktype="21"/></monsters>`, type: 'monster' })

  it('returns true for known creature (case-insensitive)', () => {
    expect(isValidCreature(db, 'Rat')).toBe(true)
    expect(isValidCreature(db, 'rat')).toBe(true)
  })

  it('returns false for unknown creature', () => {
    expect(isValidCreature(db, 'Unknown')).toBe(false)
  })
})
