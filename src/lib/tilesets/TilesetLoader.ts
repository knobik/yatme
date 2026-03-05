import { sanitizeXml } from '../brushes/BrushLoader'
import type { BrushRegistry } from '../brushes/BrushRegistry'
import type { AppearanceData } from '../appearances'
import type { ItemRegistry } from '../items'
import { getItemDisplayName } from '../items'
import type {
  Tileset, TilesetCategory, TilesetEntry,
  ResolvedTileset, ResolvedTilesetSection,
  ResolvedPaletteEntry, ResolvedBrushEntry,
  CategoryType, PaletteLocation,
} from './TilesetTypes'

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
  const masterXml = await fetch('/data/materials/tilesets.xml').then(r => r.text())
  const masterDoc = new DOMParser().parseFromString(sanitizeXml(masterXml), 'text/xml')
  const includes = masterDoc.querySelectorAll('include')

  const filenames: string[] = []
  for (const inc of includes) {
    const file = inc.getAttribute('file')
    if (file) filenames.push(file)
  }

  // Fetch all tileset files in parallel
  const results = await Promise.allSettled(
    filenames.map(f => fetch(`/data/materials/${f}`).then(r => r.text()))
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

type BrushType = ResolvedBrushEntry['brushType']

/** Determine what brush type a named brush is. */
function classifyBrush(name: string, registry: BrushRegistry): { brushType: BrushType; lookId: number } | null {
  const ground = registry.getBrushByName(name)
  if (ground) return { brushType: 'ground', lookId: ground.lookId }

  const wall = registry.getWallBrushByName(name)
  if (wall) return { brushType: 'wall', lookId: wall.lookId }

  const carpet = registry.getCarpetBrushByName(name)
  if (carpet) return { brushType: 'carpet', lookId: carpet.lookId }

  const table = registry.getTableBrushByName(name)
  if (table) return { brushType: 'table', lookId: table.lookId }

  const doodad = registry.getDoodadBrushByName(name)
  if (doodad) return { brushType: 'doodad', lookId: doodad.lookId }

  return null
}

/** Format a brush name for display: "grass" → "Grass", "stone wall" → "Stone Wall" */
function formatBrushName(name: string): string {
  return name.replace(/\b\w/g, c => c.toUpperCase())
}

function resolveEntries(
  entries: TilesetEntry[],
  sectionType: TilesetCategory['type'],
  registry: BrushRegistry,
  appearances: AppearanceData,
  itemRegistry: ItemRegistry,
  seenBrushes: Set<string>,
  seenItems: Set<number>,
): ResolvedPaletteEntry[] {
  const result: ResolvedPaletteEntry[] = []
  const isCuratedSection = sectionType === 'terrain' || sectionType === 'doodad'

  const addItem = (id: number) => {
    if (seenItems.has(id) || !hasSprite(id, appearances)) return
    seenItems.add(id)
    result.push({
      type: 'item',
      itemId: id,
      displayName: getItemDisplayName(id, itemRegistry, appearances),
    })
  }

  for (const entry of entries) {
    switch (entry.type) {
      case 'brush': {
        if (!entry.name) break
        if (isCuratedSection) {
          // In terrain/doodad: emit a single brush entry
          if (seenBrushes.has(entry.name)) break
          const info = classifyBrush(entry.name, registry)
          if (!info) break
          // Only add if lookId has a sprite
          if (info.lookId > 0 && hasSprite(info.lookId, appearances)) {
            seenBrushes.add(entry.name)
            result.push({
              type: 'brush',
              brushType: info.brushType,
              brushName: entry.name,
              lookId: info.lookId,
              displayName: formatBrushName(entry.name),
            })
          }
        } else {
          // In items/raw: expand brush to individual items
          const ground = registry.getBrushByName(entry.name)
          if (ground) { for (const i of ground.items) addItem(i.id); break }
          const wall = registry.getWallBrushByName(entry.name)
          if (wall) { if (wall.lookId > 0) addItem(wall.lookId); break }
          const carpet = registry.getCarpetBrushByName(entry.name)
          if (carpet) {
            for (const node of carpet.carpetItems) for (const i of node.items) addItem(i.id)
            break
          }
          const table = registry.getTableBrushByName(entry.name)
          if (table) {
            for (const node of table.tableItems) for (const i of node.items) addItem(i.id)
            break
          }
          const doodad = registry.getDoodadBrushByName(entry.name)
          if (doodad) {
            for (const alt of doodad.alternatives) for (const s of alt.singles) addItem(s.itemId)
            break
          }
        }
        break
      }
      case 'item':
        if (entry.id != null) addItem(entry.id)
        break
      case 'range':
        if (entry.fromId != null && entry.toId != null) {
          for (let id = entry.fromId; id <= entry.toId; id++) addItem(id)
        }
        break
    }
  }
  return result
}

export function resolveTilesets(
  tilesets: Tileset[],
  registry: BrushRegistry,
  appearances: AppearanceData,
  itemRegistry: ItemRegistry,
): ResolvedTileset[] {
  const resolved: ResolvedTileset[] = []

  for (const tileset of tilesets) {
    const seenBrushes = new Set<string>()
    const seenItems = new Set<number>()
    const sections: ResolvedTilesetSection[] = []
    let entryCount = 0

    for (const category of tileset.categories) {
      const entries = resolveEntries(
        category.entries, category.type, registry, appearances, itemRegistry,
        seenBrushes, seenItems,
      )
      if (entries.length > 0) {
        sections.push({ type: category.type, entries })
        entryCount += entries.length
      }
    }

    if (entryCount > 0) {
      resolved.push({ name: tileset.name, sections, entryCount })
    }
  }

  return resolved
}

// ── Palette search ──────────────────────────────────────────────────

const CATEGORY_SEARCH_ORDER: ReadonlyArray<'terrain' | 'doodad' | 'items' | 'raw'> = [
  'terrain', 'doodad', 'items', 'raw',
]

/**
 * Search resolved tilesets for an entry matching the predicate.
 * Searches primaryCategory first (if given), then the remaining categories in order.
 * Returns the first match with its category + tileset name, or null.
 */
export function findEntryInTilesets(
  tilesets: ResolvedTileset[],
  predicate: (entry: ResolvedPaletteEntry) => boolean,
  primaryCategory?: CategoryType,
): PaletteLocation | null {
  // Build ordered list of section types to search
  const order = primaryCategory && primaryCategory !== 'all'
    ? [primaryCategory, ...CATEGORY_SEARCH_ORDER.filter(c => c !== primaryCategory)]
    : [...CATEGORY_SEARCH_ORDER]

  for (const cat of order) {
    for (const tileset of tilesets) {
      for (const section of tileset.sections) {
        if (section.type !== cat) continue
        for (const entry of section.entries) {
          if (predicate(entry)) {
            return { category: cat, tilesetName: tileset.name, entry }
          }
        }
      }
    }
  }

  return null
}
