import { sanitizeXml } from '../brushes/BrushLoader'
import type { BrushRegistry } from '../brushes/BrushRegistry'
import type { AppearanceData } from '../appearances'
import type { Tileset, TilesetCategory, TilesetEntry, ResolvedTileset, ResolvedTilesetSection } from './TilesetTypes'

// ── XML Parsing ──────────────────────────────────────────────────────

function parseEntries(parent: Element): TilesetEntry[] {
  const entries: TilesetEntry[] = []
  for (const child of parent.children) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'item') {
      const fromId = child.getAttribute('fromid')
      const toId = child.getAttribute('toid')
      if (fromId && toId) {
        entries.push({ type: 'range', fromId: parseInt(fromId, 10), toId: parseInt(toId, 10) })
      } else {
        const id = child.getAttribute('id')
        if (id) entries.push({ type: 'item', id: parseInt(id, 10) })
      }
    } else if (tag === 'brush') {
      const name = child.getAttribute('name')
      if (name) entries.push({ type: 'brush', name })
    }
  }
  return entries
}

function parseTilesetXml(raw: string): Tileset | null {
  const doc = new DOMParser().parseFromString(sanitizeXml(raw), 'text/xml')
  const tilesetEl = doc.querySelector('tileset')
  if (!tilesetEl) return null

  const name = tilesetEl.getAttribute('name') ?? 'Unknown'
  const categories: TilesetCategory[] = []

  for (const child of tilesetEl.children) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'terrain' || tag === 'doodad' || tag === 'items' || tag === 'raw') {
      const entries = parseEntries(child)
      if (entries.length > 0) {
        categories.push({ type: tag as TilesetCategory['type'], entries })
      }
    }
  }

  if (categories.length === 0) return null
  return { name, categories }
}

// ── Loading ──────────────────────────────────────────────────────────

export async function loadTilesets(): Promise<Tileset[]> {
  // Fetch master includes file
  const masterXml = await fetch('/materials/tilesets.xml').then(r => r.text())
  const masterDoc = new DOMParser().parseFromString(sanitizeXml(masterXml), 'text/xml')
  const includes = masterDoc.querySelectorAll('include')

  const filenames: string[] = []
  for (const inc of includes) {
    const file = inc.getAttribute('file')
    if (file) filenames.push(file)
  }

  // Fetch all tileset files in parallel
  const results = await Promise.allSettled(
    filenames.map(f => fetch(`/materials/${f}`).then(r => r.text()))
  )

  const tilesets: Tileset[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const tileset = parseTilesetXml(result.value)
    if (tileset) tilesets.push(tileset)
  }

  return tilesets
}

// ── Resolution ───────────────────────────────────────────────────────

function hasSprite(id: number, appearances: AppearanceData): boolean {
  const obj = appearances.objects.get(id)
  const info = obj?.frameGroup?.[0]?.spriteInfo
  return !!(info && info.spriteId.length > 0 && info.spriteId[0] !== 0)
}

function collectBrushItemIds(name: string, registry: BrushRegistry): number[] {
  // Try ground brush
  const ground = registry.getBrushByName(name)
  if (ground) return ground.items.map(i => i.id)

  // Try wall brush
  const wall = registry.getWallBrushByName(name)
  if (wall) {
    // Use lookId as representative
    if (wall.lookId > 0) return [wall.lookId]
    const ids: number[] = []
    for (const node of wall.wallItems) {
      for (const item of node.items) ids.push(item.id)
    }
    return ids
  }

  // Try carpet brush
  const carpet = registry.getCarpetBrushByName(name)
  if (carpet) {
    if (carpet.lookId > 0) return [carpet.lookId]
    const ids: number[] = []
    for (const node of carpet.carpetItems) {
      for (const item of node.items) ids.push(item.id)
    }
    return ids
  }

  // Try table brush
  const table = registry.getTableBrushByName(name)
  if (table) {
    if (table.lookId > 0) return [table.lookId]
    const ids: number[] = []
    for (const node of table.tableItems) {
      for (const item of node.items) ids.push(item.id)
    }
    return ids
  }

  // Try doodad brush
  const doodad = registry.getDoodadBrushByName(name)
  if (doodad) {
    if (doodad.lookId > 0) return [doodad.lookId]
    const ids: number[] = []
    for (const alt of doodad.alternatives) {
      for (const single of alt.singles) ids.push(single.itemId)
    }
    return ids
  }

  return []
}

function resolveEntries(
  entries: TilesetEntry[],
  registry: BrushRegistry,
  appearances: AppearanceData,
  seen: Set<number>,
): number[] {
  const itemIds: number[] = []
  const addId = (id: number) => {
    if (!seen.has(id) && hasSprite(id, appearances)) {
      seen.add(id)
      itemIds.push(id)
    }
  }

  for (const entry of entries) {
    switch (entry.type) {
      case 'item':
        if (entry.id != null) addId(entry.id)
        break
      case 'range':
        if (entry.fromId != null && entry.toId != null) {
          for (let id = entry.fromId; id <= entry.toId; id++) addId(id)
        }
        break
      case 'brush':
        if (entry.name) {
          const ids = collectBrushItemIds(entry.name, registry)
          for (const id of ids) addId(id)
        }
        break
    }
  }
  return itemIds
}

export function resolveTilesets(
  tilesets: Tileset[],
  registry: BrushRegistry,
  appearances: AppearanceData,
): ResolvedTileset[] {
  const resolved: ResolvedTileset[] = []

  for (const tileset of tilesets) {
    const seen = new Set<number>()
    const sections: ResolvedTilesetSection[] = []
    const allItemIds: number[] = []

    for (const category of tileset.categories) {
      const sectionIds = resolveEntries(category.entries, registry, appearances, seen)
      if (sectionIds.length > 0) {
        sections.push({ type: category.type, itemIds: sectionIds })
        allItemIds.push(...sectionIds)
      }
    }

    if (allItemIds.length > 0) {
      resolved.push({ name: tileset.name, sections, itemIds: allItemIds })
    }
  }

  return resolved
}
