import type { MapBundle } from './storage/MapStorageProvider'
import type { OtbmMap } from './otbm'

// --- Houses ---

export interface HouseData {
  id: number
  name: string
  entryX: number
  entryY: number
  entryZ: number
  rent: number
  townId: number
  size: number
  clientId: number
  guildhall: boolean
  beds: number
}

// --- Spawns (shared for monsters and NPCs) ---

export interface SpawnCreature {
  name: string
  x: number
  y: number
  z: number
  spawnTime: number
  direction: number
  weight?: number
}

export interface SpawnPoint {
  centerX: number
  centerY: number
  centerZ: number
  radius: number
  creatures: SpawnCreature[]
}

// --- Zones ---

export interface ZoneData {
  id: number
  name: string
}

// --- Aggregated sidecar data ---

export interface MapSidecars {
  houses: HouseData[]
  monsterSpawns: SpawnPoint[]
  npcSpawns: SpawnPoint[]
  zones: ZoneData[]
}

export function emptySidecars(): MapSidecars {
  return { houses: [], monsterSpawns: [], npcSpawns: [], zones: [] }
}

// --- Parsing ---

function intAttr(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name)
  return v != null ? parseInt(v, 10) : fallback
}

function boolAttr(el: Element, name: string): boolean {
  const v = el.getAttribute(name)
  return v === 'true' || v === '1' || v === 'yes'
}

export function parseHousesXml(xml: string): HouseData[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const houses: HouseData[] = []
  for (const el of doc.querySelectorAll('houses > house')) {
    houses.push({
      id: intAttr(el, 'houseid'),
      name: el.getAttribute('name') ?? '',
      entryX: intAttr(el, 'entryx'),
      entryY: intAttr(el, 'entryy'),
      entryZ: intAttr(el, 'entryz'),
      rent: intAttr(el, 'rent'),
      townId: intAttr(el, 'townid'),
      size: intAttr(el, 'size'),
      clientId: intAttr(el, 'clientid'),
      guildhall: boolAttr(el, 'guildhall'),
      beds: intAttr(el, 'beds'),
    })
  }
  return houses
}

export function parseSpawnsXml(xml: string, rootTag: 'monsters' | 'npcs'): SpawnPoint[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const childTag = rootTag === 'monsters' ? 'monster' : 'npc'
  const spawns: SpawnPoint[] = []
  for (const parent of doc.querySelectorAll(`${rootTag} > ${childTag}`)) {
    const centerX = intAttr(parent, 'centerx')
    const centerY = intAttr(parent, 'centery')
    const centerZ = intAttr(parent, 'centerz')
    const radius = intAttr(parent, 'radius', -1)
    const creatures: SpawnCreature[] = []
    for (const child of parent.querySelectorAll(`:scope > ${childTag}`)) {
      creatures.push({
        name: child.getAttribute('name') ?? '',
        x: centerX + intAttr(child, 'x'),
        y: centerY + intAttr(child, 'y'),
        z: intAttr(child, 'z', centerZ),
        spawnTime: intAttr(child, 'spawntime', 60),
        direction: intAttr(child, 'direction'),
        ...(rootTag === 'monsters' && child.hasAttribute('weight')
          ? { weight: intAttr(child, 'weight', 1) }
          : {}),
      })
    }
    spawns.push({ centerX, centerY, centerZ, radius, creatures })
  }
  return spawns
}

export function parseZonesXml(xml: string): ZoneData[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const zones: ZoneData[] = []
  for (const el of doc.querySelectorAll('zones > zone')) {
    zones.push({
      id: intAttr(el, 'zoneid'),
      name: el.getAttribute('name') ?? '',
    })
  }
  return zones
}

export function parseSidecars(bundle: MapBundle, map: OtbmMap): MapSidecars {
  const decoder = new TextDecoder()
  const sidecars = emptySidecars()

  const decode = (filename: string): string | null => {
    if (!filename) return null
    const data = bundle.sidecars.get(filename)
    if (!data) return null
    return decoder.decode(data)
  }

  const houseXml = decode(map.houseFile)
  if (houseXml) {
    try { sidecars.houses = parseHousesXml(houseXml) }
    catch (e) { console.warn('[Sidecars] Failed to parse houses:', e) }
  }

  const spawnXml = decode(map.spawnFile)
  if (spawnXml) {
    try { sidecars.monsterSpawns = parseSpawnsXml(spawnXml, 'monsters') }
    catch (e) { console.warn('[Sidecars] Failed to parse monster spawns:', e) }
  }

  const npcXml = decode(map.npcFile)
  if (npcXml) {
    try { sidecars.npcSpawns = parseSpawnsXml(npcXml, 'npcs') }
    catch (e) { console.warn('[Sidecars] Failed to parse NPC spawns:', e) }
  }

  const zoneXml = decode(map.zoneFile)
  if (zoneXml) {
    try { sidecars.zones = parseZonesXml(zoneXml) }
    catch (e) { console.warn('[Sidecars] Failed to parse zones:', e) }
  }

  return sidecars
}

// --- Serialization ---

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function serializeHousesXml(houses: HouseData[]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<houses>']
  for (const h of houses) {
    let attrs = `houseid="${h.id}" name="${escapeXml(h.name)}"`
    attrs += ` entryx="${h.entryX}" entryy="${h.entryY}" entryz="${h.entryZ}"`
    attrs += ` rent="${h.rent}" townid="${h.townId}" size="${h.size}"`
    if (h.clientId) attrs += ` clientid="${h.clientId}"`
    if (h.guildhall) attrs += ` guildhall="true"`
    if (h.beds) attrs += ` beds="${h.beds}"`
    lines.push(`\t<house ${attrs} />`)
  }
  lines.push('</houses>', '')
  return lines.join('\n')
}

export function serializeSpawnsXml(spawns: SpawnPoint[], rootTag: 'monsters' | 'npcs'): string {
  const childTag = rootTag === 'monsters' ? 'monster' : 'npc'
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', `<${rootTag}>`]
  for (const sp of spawns) {
    let parentAttrs = `centerx="${sp.centerX}" centery="${sp.centerY}" centerz="${sp.centerZ}"`
    parentAttrs += ` radius="${sp.radius}"`
    lines.push(`\t<${childTag} ${parentAttrs}>`)
    for (const c of sp.creatures) {
      const relX = c.x - sp.centerX
      const relY = c.y - sp.centerY
      let attrs = `name="${escapeXml(c.name)}" x="${relX}" y="${relY}" z="${c.z}"`
      attrs += ` spawntime="${c.spawnTime}"`
      if (c.direction) attrs += ` direction="${c.direction}"`
      if (c.weight != null && rootTag === 'monsters') attrs += ` weight="${c.weight}"`
      lines.push(`\t\t<${childTag} ${attrs} />`)
    }
    lines.push(`\t</${childTag}>`)
  }
  lines.push(`</${rootTag}>`, '')
  return lines.join('\n')
}

export function serializeZonesXml(zones: ZoneData[]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<zones>']
  for (const z of zones) {
    lines.push(`\t<zone name="${escapeXml(z.name)}" zoneid="${z.id}" />`)
  }
  lines.push('</zones>', '')
  return lines.join('\n')
}

export function serializeSidecars(sidecars: MapSidecars, map: OtbmMap): Map<string, Uint8Array> {
  const encoder = new TextEncoder()
  const result = new Map<string, Uint8Array>()

  if (map.houseFile && sidecars.houses.length > 0) {
    result.set(map.houseFile, encoder.encode(serializeHousesXml(sidecars.houses)))
  }
  if (map.spawnFile && sidecars.monsterSpawns.length > 0) {
    result.set(map.spawnFile, encoder.encode(serializeSpawnsXml(sidecars.monsterSpawns, 'monsters')))
  }
  if (map.npcFile && sidecars.npcSpawns.length > 0) {
    result.set(map.npcFile, encoder.encode(serializeSpawnsXml(sidecars.npcSpawns, 'npcs')))
  }
  if (map.zoneFile && sidecars.zones.length > 0) {
    result.set(map.zoneFile, encoder.encode(serializeZonesXml(sidecars.zones)))
  }

  return result
}
