// Parse RME XML carpet & table brush definitions.
// Pattern follows WallLoader.ts.

import {
  type CarpetBrush, type TableBrush,
  createCarpetBrush, createTableBrush,
  CARPET_ALIGN_MAP, TABLE_ALIGN_MAP, CARPET_CENTER,
} from './CarpetTypes'
import { sanitizeXml } from './BrushLoader'

export function parseCarpetBrushesXml(
  raw: string,
  nextId: { value: number },
): { carpets: CarpetBrush[]; tables: TableBrush[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(sanitizeXml(raw), 'text/xml')
  const carpets: CarpetBrush[] = []
  const tables: TableBrush[] = []

  for (const brushEl of doc.querySelectorAll('brush')) {
    const type = brushEl.getAttribute('type')

    if (type === 'carpet') {
      const brush = parseCarpetBrush(brushEl, nextId)
      if (brush) carpets.push(brush)
    } else if (type === 'table') {
      const brush = parseTableBrush(brushEl, nextId)
      if (brush) tables.push(brush)
    }
  }

  return { carpets, tables }
}

function parseCarpetBrush(
  brushEl: Element,
  nextId: { value: number },
): CarpetBrush | null {
  const name = brushEl.getAttribute('name') || ''
  const serverLookId = parseInt(brushEl.getAttribute('server_lookid') || '0', 10)
  const lookId = parseInt(brushEl.getAttribute('lookid') || '0', 10)

  // Skip empty forward declarations
  if (!serverLookId && !lookId && !brushEl.querySelector('carpet')) return null

  const brush = createCarpetBrush()
  brush.id = nextId.value++
  brush.name = name
  brush.lookId = serverLookId || lookId

  for (const carpetEl of brushEl.children) {
    if (carpetEl.tagName.toLowerCase() !== 'carpet') continue

    const alignStr = carpetEl.getAttribute('align') || ''
    const alignment = CARPET_ALIGN_MAP[alignStr]
    if (alignment === undefined) continue

    // Carpet items can be inline (id on the <carpet> element) or child <item> elements
    const inlineId = parseInt(carpetEl.getAttribute('id') || '0', 10)
    if (inlineId) {
      const chance = parseInt(carpetEl.getAttribute('chance') || '0', 10) || 1
      const node = brush.carpetItems[alignment]
      node.totalChance += chance
      node.items.push({ id: inlineId, chance: node.totalChance })
    }

    // Also check for child <item> elements (some carpets have multiple items per alignment)
    for (const itemEl of carpetEl.children) {
      if (itemEl.tagName.toLowerCase() !== 'item') continue
      const id = parseInt(itemEl.getAttribute('id') || '0', 10)
      if (!id) continue
      const chance = parseInt(itemEl.getAttribute('chance') || '0', 10) || 1
      const node = brush.carpetItems[alignment]
      node.totalChance += chance
      node.items.push({ id, chance: node.totalChance })
    }
  }

  // Validate: must have at least one item
  const hasItems = brush.carpetItems.some(n => n.items.length > 0)
  if (!hasItems) return null

  // If no center item defined, try to use the lookId as center
  if (brush.carpetItems[CARPET_CENTER].items.length === 0 && brush.lookId) {
    const node = brush.carpetItems[CARPET_CENTER]
    node.totalChance = 1
    node.items.push({ id: brush.lookId, chance: 1 })
  }

  return brush
}

function parseTableBrush(
  brushEl: Element,
  nextId: { value: number },
): TableBrush | null {
  const name = brushEl.getAttribute('name') || ''
  const serverLookId = parseInt(brushEl.getAttribute('server_lookid') || '0', 10)
  const lookId = parseInt(brushEl.getAttribute('lookid') || '0', 10)

  if (!serverLookId && !lookId && !brushEl.querySelector('table')) return null

  const brush = createTableBrush()
  brush.id = nextId.value++
  brush.name = name
  brush.lookId = serverLookId || lookId

  for (const tableEl of brushEl.children) {
    if (tableEl.tagName.toLowerCase() !== 'table') continue

    const alignStr = tableEl.getAttribute('align') || ''
    const alignment = TABLE_ALIGN_MAP[alignStr]
    if (alignment === undefined) continue

    const node = brush.tableItems[alignment]

    for (const itemEl of tableEl.children) {
      if (itemEl.tagName.toLowerCase() !== 'item') continue
      const id = parseInt(itemEl.getAttribute('id') || '0', 10)
      if (!id) continue
      const chance = parseInt(itemEl.getAttribute('chance') || '0', 10) || 1
      node.totalChance += chance
      node.items.push({ id, chance: node.totalChance })
    }
  }

  const hasItems = brush.tableItems.some(n => n.items.length > 0)
  if (!hasItems) return null

  return brush
}
