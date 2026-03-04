// Parse RME XML brush/border definitions into our data structures.
// RME's XML files contain unescaped '&' in attribute values (not valid XML).
// We sanitize before parsing with DOMParser.

import type { AutoBorder, GroundBrush, BorderBlock, SpecificCaseBlock } from './BrushTypes'
import { createGroundBrush } from './BrushTypes'
import {
  NORTH_HORIZONTAL, EAST_HORIZONTAL, SOUTH_HORIZONTAL, WEST_HORIZONTAL,
  NORTHWEST_CORNER, NORTHEAST_CORNER, SOUTHWEST_CORNER, SOUTHEAST_CORNER,
  NORTHWEST_DIAGONAL, NORTHEAST_DIAGONAL, SOUTHEAST_DIAGONAL, SOUTHWEST_DIAGONAL,
} from './BorderTable'

// Edge name → AutoBorder.tiles[] index
const EDGE_MAP: Record<string, number> = {
  n: NORTH_HORIZONTAL,
  e: EAST_HORIZONTAL,
  s: SOUTH_HORIZONTAL,
  w: WEST_HORIZONTAL,
  cnw: NORTHWEST_CORNER,
  cne: NORTHEAST_CORNER,
  csw: SOUTHWEST_CORNER,
  cse: SOUTHEAST_CORNER,
  dnw: NORTHWEST_DIAGONAL,
  dne: NORTHEAST_DIAGONAL,
  dsw: SOUTHWEST_DIAGONAL,
  dse: SOUTHEAST_DIAGONAL,
}

// Resolve a border ID + edge name → concrete item ID from the borders map.
// Used by both <specific> conditions (match_border) and actions (replace_border).
function resolveBorderEdgeItem(
  bordersMap: Map<number, AutoBorder>,
  el: Element,
): number | null {
  const refId = parseInt(el.getAttribute('id') || '0', 10)
  const edgeName = el.getAttribute('edge')?.toLowerCase()
  if (!refId || !edgeName || EDGE_MAP[edgeName] === undefined) return null
  const border = bordersMap.get(refId)
  return border?.tiles[EDGE_MAP[edgeName]] ?? null
}

// RME XML files use unescaped '&' in attribute values (e.g. "rock soil & cave ground").
// Escape bare '&' that aren't already part of an entity reference.
export function sanitizeXml(xml: string): string {
  return xml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&amp;')
}

// Pass 1: Parse borders.xml → Map<borderId, AutoBorder>
export function parseBordersXml(raw: string): Map<number, AutoBorder> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(sanitizeXml(raw), 'text/xml')
  const borders = new Map<number, AutoBorder>()

  for (const borderEl of doc.querySelectorAll('border')) {
    const id = parseInt(borderEl.getAttribute('id') || '0', 10)
    if (!id) continue
    const group = parseInt(borderEl.getAttribute('group') || '0', 10)

    const tiles: (number | null)[] = new Array(13).fill(null)
    for (const itemEl of borderEl.querySelectorAll('borderitem')) {
      const edge = itemEl.getAttribute('edge')?.toLowerCase()
      const itemId = parseInt(itemEl.getAttribute('item') || '0', 10)
      if (edge && EDGE_MAP[edge] !== undefined && itemId) {
        tiles[EDGE_MAP[edge]] = itemId
      }
    }

    borders.set(id, { id, group, tiles })
  }

  return borders
}

// Pass 2: Parse a ground brush XML file → GroundBrush[]
// Only extracts type="ground" brushes (skips doodad, wall, etc.)
export function parseGroundBrushesXml(
  raw: string,
  bordersMap: Map<number, AutoBorder>,
  nextId: { value: number },
): GroundBrush[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(sanitizeXml(raw), 'text/xml')
  const brushes: GroundBrush[] = []
  let inlineBorderId = -1 // negative IDs for inline AutoBorders (won't collide with borders.xml)

  for (const brushEl of doc.querySelectorAll('brush')) {
    const type = brushEl.getAttribute('type')
    if (type !== 'ground') continue

    const name = brushEl.getAttribute('name') || ''
    const lookId = parseInt(brushEl.getAttribute('lookid') || '0', 10)
    const zOrder = parseInt(brushEl.getAttribute('z-order') || '0', 10)

    // Skip forward declarations (ground brushes with no items/lookid)
    if (!lookId && !brushEl.querySelector('item')) continue

    const brush = createGroundBrush()
    brush.id = nextId.value++
    brush.name = name
    brush.lookId = lookId
    brush.zOrder = zOrder

    // Parse items
    let totalChance = 0
    for (const itemEl of brushEl.children) {
      if (itemEl.tagName.toLowerCase() !== 'item') continue
      const id = parseInt(itemEl.getAttribute('id') || '0', 10)
      const chance = parseInt(itemEl.getAttribute('chance') || '0', 10)
      if (!id) continue
      // Items with chance>0 are used for random placement AND identification.
      // Items with chance=0 are only used for identification (lookup by item ID).
      brush.items.push({ id, chance })
      totalChance += chance
    }
    brush.totalChance = totalChance

    // Parse borders
    for (const borderEl of brushEl.children) {
      if (borderEl.tagName.toLowerCase() !== 'border') continue

      const borderId = parseInt(borderEl.getAttribute('id') || '0', 10)
      const alignStr = borderEl.getAttribute('align') || 'outer'
      const outer = alignStr !== 'inner'
      const toStr = borderEl.getAttribute('to')

      let to: number
      let toName: string | null = null
      if (toStr === 'none') {
        to = 0 // zilch
      } else if (toStr === 'all' || toStr === undefined || toStr === null) {
        to = 0xFFFFFFFF
      } else {
        // Named brush target — resolved later in BrushRegistry
        to = -1 // sentinel: needs resolution
        toName = toStr
      }

      let autoborder = borderId ? (bordersMap.get(borderId) || null) : null

      // Parse inline <borderitem> children — creates a new AutoBorder or
      // overrides tiles on the one looked up by id.
      const inlineItems = borderEl.querySelectorAll('borderitem')
      if (inlineItems.length > 0) {
        if (!autoborder) {
          // No base border — create a fresh inline one with a synthetic ID
          autoborder = { id: inlineBorderId--, group: 0, tiles: new Array(13).fill(null) }
        } else {
          // Clone so we don't mutate the shared border definition
          autoborder = { ...autoborder, tiles: [...autoborder.tiles] }
        }
        for (const itemEl of inlineItems) {
          const edge = itemEl.getAttribute('edge')?.toLowerCase()
          const itemId = parseInt(itemEl.getAttribute('item') || '0', 10)
          if (edge && EDGE_MAP[edge] !== undefined && itemId) {
            autoborder.tiles[EDGE_MAP[edge]] = itemId
          }
        }
        // Register inline border so its items are tracked
        bordersMap.set(autoborder.id, autoborder)
      }

      // Parse <specific> children for post-processing rules
      const specificCases: SpecificCaseBlock[] = []
      for (const specificEl of borderEl.children) {
        if (specificEl.tagName.toLowerCase() !== 'specific') continue

        const scb: SpecificCaseBlock = {
          itemsToMatch: [],
          matchGroup: 0,
          groupMatchAlignment: 0,
          toReplaceId: 0,
          withId: 0,
          deleteAll: false,
        }

        // Parse <conditions>
        for (const condGroup of specificEl.children) {
          if (condGroup.tagName.toLowerCase() !== 'conditions') continue
          for (const condEl of condGroup.children) {
            const tag = condEl.tagName.toLowerCase()
            if (tag === 'match_border') {
              const itemId = resolveBorderEdgeItem(bordersMap, condEl)
              if (itemId != null) {
                scb.itemsToMatch.push(itemId)
              }
            } else if (tag === 'match_group') {
              scb.matchGroup = parseInt(condEl.getAttribute('group') || '0', 10)
              const edgeName = condEl.getAttribute('edge')?.toLowerCase()
              if (edgeName && EDGE_MAP[edgeName] !== undefined) {
                scb.groupMatchAlignment = EDGE_MAP[edgeName]
              }
              // Push group as placeholder count (same as RME)
              scb.itemsToMatch.push(scb.matchGroup)
            } else if (tag === 'match_item') {
              const itemId = parseInt(condEl.getAttribute('id') || '0', 10)
              if (itemId) {
                scb.itemsToMatch.push(itemId)
                scb.matchGroup = 0
              }
            }
          }
        }

        // Parse <actions>
        for (const actGroup of specificEl.children) {
          if (actGroup.tagName.toLowerCase() !== 'actions') continue
          for (const actEl of actGroup.children) {
            const tag = actEl.tagName.toLowerCase()
            if (tag === 'replace_border') {
              const itemId = resolveBorderEdgeItem(bordersMap, actEl)
              if (itemId != null) {
                scb.toReplaceId = itemId
              }
              scb.withId = parseInt(actEl.getAttribute('with') || '0', 10)
            } else if (tag === 'replace_item') {
              scb.toReplaceId = parseInt(actEl.getAttribute('id') || '0', 10)
              scb.withId = parseInt(actEl.getAttribute('with') || '0', 10)
            } else if (tag === 'delete_borders') {
              scb.deleteAll = true
            }
          }
        }

        specificCases.push(scb)
      }

      const block: BorderBlock = { outer, to, toName, autoborder, specificCases }
      brush.borders.push(block)

      // Set flags
      if (outer) {
        if (to === 0) brush.hasOuterZilchBorder = true
        else brush.hasOuterBorder = true
      } else {
        if (to === 0) brush.hasInnerZilchBorder = true
        else brush.hasInnerBorder = true
      }
    }

    // Parse optional border
    for (const optEl of brushEl.children) {
      if (optEl.tagName.toLowerCase() !== 'optional') continue
      const optId = parseInt(optEl.getAttribute('id') || '0', 10)
      if (optId) {
        brush.optionalBorder = bordersMap.get(optId) || null
        // optional border implies outer zilch border capability
        if (brush.optionalBorder) {
          brush.hasOuterZilchBorder = true
          brush.hasOuterBorder = true
        }
      }
    }

    // Parse friends
    for (const friendEl of brushEl.children) {
      if (friendEl.tagName.toLowerCase() !== 'friend') continue
      const friendName = friendEl.getAttribute('name')
      if (friendName) brush.friends.add(friendName)
    }

    brushes.push(brush)
  }

  return brushes
}

// Load all brush data from the server
export async function loadBrushData(
  onProgress?: (fraction: number) => void,
): Promise<{
  borders: Map<number, AutoBorder>
  brushes: GroundBrush[]
}> {
  const { fetchTextWithProgress } = await import('../fetchWithProgress')

  // Load borders (~33% of brush loading)
  const bordersXml = await fetchTextWithProgress(
    '/data/materials/borders/borders.xml',
    onProgress ? (f) => onProgress(f * 0.33) : undefined,
  )
  const borders = parseBordersXml(bordersXml)

  // Load ground brushes (~67% of brush loading)
  const groundsXml = await fetchTextWithProgress(
    '/data/materials/brushs/grounds.xml',
    onProgress ? (f) => onProgress(0.33 + f * 0.67) : undefined,
  )
  const nextId = { value: 1 }
  const brushes = parseGroundBrushesXml(groundsXml, borders, nextId)

  onProgress?.(1)
  console.log(`[BrushLoader] Loaded ${borders.size} borders, ${brushes.length} ground brushes`)

  return { borders, brushes }
}
