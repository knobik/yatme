export interface CreatureOutfit {
  looktype: number
  lookitem: number
  lookhead: number
  lookbody: number
  looklegs: number
  lookfeet: number
  lookaddons: number
}

export interface CreatureInfo {
  name: string
  type: 'monster' | 'npc'
  outfit: CreatureOutfit
}

/** Key = lowercase name for case-insensitive lookup */
export type CreatureDatabase = Map<string, CreatureInfo>

/**
 * Load creature definitions from XML files (monsters.xml + npcs.xml).
 * Follows the items.ts pattern: fetch + DOMParser + Map registry.
 */
export async function loadCreatures(
  onProgress?: (fraction: number) => void,
): Promise<CreatureDatabase> {
  const { fetchTextWithProgress } = await import('./fetchWithProgress')
  const db: CreatureDatabase = new Map()

  // Load monsters and NPCs in parallel
  const [monstersText, npcsText] = await Promise.all([
    fetchTextWithProgress('/data/creatures/monsters.xml', (f) => onProgress?.(f * 0.5)),
    fetchTextWithProgress('/data/creatures/npcs.xml', (f) => onProgress?.(0.5 + f * 0.5)),
  ])

  // Parse sequentially — monsters first so they win on name collisions
  parseCreatureXml(monstersText, 'monster', db)
  parseCreatureXml(npcsText, 'npc', db)

  onProgress?.(1)
  return db
}

/**
 * Parse a creature XML document and add entries to the database.
 * Handles both monster and NPC XML formats:
 * - Monsters use `lookaddons` attribute
 * - NPCs use `lookaddon` attribute (singular)
 */
export function parseCreatureXml(
  xmlText: string,
  type: 'monster' | 'npc',
  db: CreatureDatabase,
): void {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const tagName = type === 'monster' ? 'monster' : 'npc'
  const elements = doc.querySelectorAll(tagName)

  for (const el of elements) {
    const name = el.getAttribute('name')
    if (!name) continue

    const outfit: CreatureOutfit = {
      looktype: intAttr(el, 'looktype'),
      lookitem: intAttr(el, 'lookitem'),
      lookhead: intAttr(el, 'lookhead'),
      lookbody: intAttr(el, 'lookbody'),
      looklegs: intAttr(el, 'looklegs'),
      lookfeet: intAttr(el, 'lookfeet'),
      // Handle both `lookaddons` (monsters) and `lookaddon` (NPCs)
      lookaddons: intAttr(el, 'lookaddons') || intAttr(el, 'lookaddon'),
    }

    const key = name.toLowerCase()
    // Don't overwrite — first entry wins (monsters loaded before NPCs)
    if (!db.has(key)) {
      db.set(key, { name, type, outfit })
    }
  }
}

function intAttr(el: Element, name: string): number {
  const v = el.getAttribute(name)
  if (v == null) return 0
  const n = parseInt(v, 10)
  return isNaN(n) ? 0 : n
}

/** Case-insensitive creature lookup. */
export function getCreature(db: CreatureDatabase, name: string): CreatureInfo | undefined {
  return db.get(name.toLowerCase())
}

/** Weak cache so the sorted list is computed once per database instance. */
const sortedListCache = new WeakMap<CreatureDatabase, CreatureInfo[]>()

/** Get sorted creature list, optionally filtered by type. */
export function getCreatureList(db: CreatureDatabase, type?: 'monster' | 'npc'): CreatureInfo[] {
  let sorted = sortedListCache.get(db)
  if (!sorted) {
    sorted = [...db.values()].sort((a, b) => a.name.localeCompare(b.name))
    sortedListCache.set(db, sorted)
  }
  if (!type) return sorted
  return sorted.filter(c => c.type === type)
}

/** Check if a creature name exists in the database. */
export function isValidCreature(db: CreatureDatabase, name: string): boolean {
  return db.has(name.toLowerCase())
}
