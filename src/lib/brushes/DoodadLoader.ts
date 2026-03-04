// Parse RME XML doodad brush definitions.
// Pattern follows CarpetLoader.ts / WallLoader.ts.

import type {
  DoodadBrush,
  DoodadAlternative,
  DoodadSingleItem,
  DoodadComposite,
  DoodadCompositeTile,
} from './DoodadTypes'
import { sanitizeXml } from './BrushLoader'

export function parseDoodadBrushesXml(
  raw: string,
  nextId: { value: number },
): DoodadBrush[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(sanitizeXml(raw), 'text/xml')
  const brushes: DoodadBrush[] = []

  for (const brushEl of doc.querySelectorAll('brush')) {
    if (brushEl.getAttribute('type') !== 'doodad') continue
    const brush = parseDoodadBrush(brushEl, nextId)
    if (brush) brushes.push(brush)
  }

  return brushes
}

function parseDoodadBrush(
  brushEl: Element,
  nextId: { value: number },
): DoodadBrush | null {
  const name = brushEl.getAttribute('name') || ''
  const serverLookId = parseInt(brushEl.getAttribute('server_lookid') || '0', 10)
  const lookId = parseInt(brushEl.getAttribute('lookid') || '0', 10)

  // Parse thickness "floor/ceiling" (e.g. "12/100")
  const thicknessStr = brushEl.getAttribute('thickness') || '10/100'
  const thicknessParts = thicknessStr.split('/')
  const thickness = parseInt(thicknessParts[0], 10) || 10
  const thicknessCeiling = parseInt(thicknessParts[1], 10) || 100

  const brush: DoodadBrush = {
    id: nextId.value++,
    name,
    lookId: serverLookId || lookId,
    draggable: brushEl.getAttribute('draggable') !== 'false',
    onBlocking: brushEl.getAttribute('on_blocking') === 'true',
    onDuplicate: brushEl.getAttribute('on_duplicate') === 'true',
    thickness,
    thicknessCeiling,
    alternatives: [],
  }

  // Collect root-level items and composites (outside <alternate> tags)
  const rootSingles: DoodadSingleItem[] = []
  const rootComposites: DoodadComposite[] = []
  let hasAlternates = false

  for (const child of brushEl.children) {
    const tag = child.tagName.toLowerCase()

    if (tag === 'item') {
      const item = parseSingleItem(child)
      if (item) rootSingles.push(item)
    } else if (tag === 'composite') {
      const comp = parseComposite(child)
      if (comp) rootComposites.push(comp)
    } else if (tag === 'alternate') {
      hasAlternates = true
      const alt = parseAlternative(child)
      if (alt && alt.totalChance > 0) brush.alternatives.push(alt)
    }
  }

  // Add root-level items as a default alternative
  if (rootSingles.length > 0 || rootComposites.length > 0) {
    const totalChance = rootSingles.reduce((s, i) => s + i.chance, 0)
      + rootComposites.reduce((s, c) => s + c.chance, 0)
    brush.alternatives.push({
      singles: rootSingles,
      composites: rootComposites,
      totalChance,
    })
  }

  // Validate: must have at least one alternative with items
  if (brush.alternatives.length === 0) return null

  return brush
}

function parseAlternative(altEl: Element): DoodadAlternative {
  const singles: DoodadSingleItem[] = []
  const composites: DoodadComposite[] = []

  for (const child of altEl.children) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'item') {
      const item = parseSingleItem(child)
      if (item) singles.push(item)
    } else if (tag === 'composite') {
      const comp = parseComposite(child)
      if (comp) composites.push(comp)
    }
  }

  const totalChance = singles.reduce((s, i) => s + i.chance, 0)
    + composites.reduce((s, c) => s + c.chance, 0)

  return { singles, composites, totalChance }
}

function parseSingleItem(itemEl: Element): DoodadSingleItem | null {
  const id = parseInt(itemEl.getAttribute('id') || '0', 10)
  if (!id) return null
  const chance = parseInt(itemEl.getAttribute('chance') || '0', 10) || 1
  return { itemId: id, chance }
}

function parseComposite(compEl: Element): DoodadComposite | null {
  const chance = parseInt(compEl.getAttribute('chance') || '0', 10) || 1
  const tiles: DoodadCompositeTile[] = []

  for (const tileEl of compEl.children) {
    if (tileEl.tagName.toLowerCase() !== 'tile') continue
    const dx = parseInt(tileEl.getAttribute('x') || '0', 10)
    const dy = parseInt(tileEl.getAttribute('y') || '0', 10)
    const dz = parseInt(tileEl.getAttribute('z') || '0', 10)

    const itemIds: number[] = []
    for (const itemEl of tileEl.children) {
      if (itemEl.tagName.toLowerCase() !== 'item') continue
      const id = parseInt(itemEl.getAttribute('id') || '0', 10)
      if (id) itemIds.push(id)
    }

    if (itemIds.length === 0) continue

    // Merge with existing tile at same offset (rare but exists in some XMLs)
    const existing = tiles.find(t => t.dx === dx && t.dy === dy && t.dz === dz)
    if (existing) {
      existing.itemIds.push(...itemIds)
    } else {
      tiles.push({ dx, dy, dz, itemIds })
    }
  }

  if (tiles.length === 0) return null
  return { chance, tiles }
}
