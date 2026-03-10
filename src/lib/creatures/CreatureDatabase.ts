import type { CreatureType } from './types'

function intAttr(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name)
  return v != null ? parseInt(v, 10) : fallback
}

function optionalIntAttr(el: Element, name: string): number | undefined {
  const v = el.getAttribute(name)
  if (v == null) return undefined
  const n = parseInt(v, 10)
  return n === 0 ? undefined : n
}

export class CreatureDatabase {
  private byName = new Map<string, CreatureType>()
  private monsters: CreatureType[] = []
  private npcs: CreatureType[] = []

  addMonstersFromXml(xml: string): void {
    this.parseCreaturesFromXml(xml, 'monsters > monster', false, 'lookaddons', this.monsters)
  }

  addNpcsFromXml(xml: string): void {
    this.parseCreaturesFromXml(xml, 'npcs > npc', true, 'lookaddon', this.npcs)
  }

  getByName(name: string): CreatureType | undefined {
    return this.byName.get(name.toLowerCase())
  }

  getAllMonsters(): CreatureType[] {
    return this.monsters
  }

  getAllNpcs(): CreatureType[] {
    return this.npcs
  }

  search(query: string, isNpc?: boolean): CreatureType[] {
    const q = query.toLowerCase()
    let source: CreatureType[]
    if (isNpc === true) source = this.npcs
    else if (isNpc === false) source = this.monsters
    else source = [...this.monsters, ...this.npcs]
    if (!q) return source
    return source.filter(c => c.name.toLowerCase().includes(q))
  }

  private parseCreaturesFromXml(
    xml: string,
    selector: string,
    isNpc: boolean,
    addonAttr: string,
    target: CreatureType[],
  ): void {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    for (const el of doc.querySelectorAll(selector)) {
      const name = el.getAttribute('name')
      if (!name) continue
      const creature: CreatureType = {
        name,
        lookType: intAttr(el, 'looktype'),
        lookItem: optionalIntAttr(el, 'lookitem'),
        lookMount: optionalIntAttr(el, 'lookmount'),
        lookAddon: el.hasAttribute(addonAttr) ? intAttr(el, addonAttr) : undefined,
        lookHead: el.hasAttribute('lookhead') ? intAttr(el, 'lookhead') : undefined,
        lookBody: el.hasAttribute('lookbody') ? intAttr(el, 'lookbody') : undefined,
        lookLegs: el.hasAttribute('looklegs') ? intAttr(el, 'looklegs') : undefined,
        lookFeet: el.hasAttribute('lookfeet') ? intAttr(el, 'lookfeet') : undefined,
        isNpc,
      }
      target.push(creature)
      this.byName.set(name.toLowerCase(), creature)
    }
  }
}

export async function loadCreatureDatabase(
  monstersUrl = '/data/creatures/monsters.xml',
  npcsUrl = '/data/creatures/npcs.xml',
): Promise<CreatureDatabase> {
  const db = new CreatureDatabase()
  const results = await Promise.allSettled([
    fetch(monstersUrl).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() }),
    fetch(npcsUrl).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() }),
  ])

  if (results[0].status === 'fulfilled') {
    db.addMonstersFromXml(results[0].value)
  } else {
    console.warn('[CreatureDatabase] Failed to load monsters:', results[0].reason)
  }

  if (results[1].status === 'fulfilled') {
    db.addNpcsFromXml(results[1].value)
  } else {
    console.warn('[CreatureDatabase] Failed to load NPCs:', results[1].reason)
  }

  return db
}
