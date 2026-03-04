// Carpet & table auto-alignment system — port of RME's CarpetBrush::doCarpets()
// and TableBrush::doTables(). When a carpet/table is placed or neighbors change,
// this recalculates the correct alignment sprite for each carpet/table item.

import type { OtbmMap, OtbmItem } from '../otbm'
import type { BrushRegistry } from './BrushRegistry'
import type { CarpetBrush, CarpetNode, TableBrush, TableNode } from './CarpetTypes'
import {
  CARPET_TYPES, TABLE_TYPES, CARPET_CENTER,
  TILE_NORTHWEST, TILE_NORTH, TILE_NORTHEAST,
  TILE_WEST, TILE_EAST,
  TILE_SOUTHWEST, TILE_SOUTH, TILE_SOUTHEAST,
  TABLE_ALONE,
} from './CarpetTypes'

// Pick a random item from a CarpetNode/TableNode using cumulative chance
function pickFromNode(node: CarpetNode | TableNode): number {
  if (node.items.length === 0) return 0

  if (node.totalChance <= 0) {
    return node.items[0].id
  }

  const roll = Math.floor(Math.random() * node.totalChance) + 1
  for (const item of node.items) {
    if (roll <= item.chance) return item.id
  }
  return node.items[node.items.length - 1].id
}

// Pick a carpet item for an alignment, falling back to center then any slot (like RME)
function pickCarpetItem(brush: CarpetBrush, alignment: number): number {
  const node = brush.carpetItems[alignment]
  if (node.items.length > 0) return pickFromNode(node)

  // Fallback to center
  const center = brush.carpetItems[CARPET_CENTER]
  if (center.items.length > 0) return pickFromNode(center)

  // Last resort: iterate all slots
  for (const n of brush.carpetItems) {
    if (n.items.length > 0) return pickFromNode(n)
  }
  return 0
}

// Pick a table item for an alignment, falling back to alone then any slot
function pickTableItem(brush: TableBrush, alignment: number): number {
  const node = brush.tableItems[alignment]
  if (node.items.length > 0) return pickFromNode(node)

  const alone = brush.tableItems[TABLE_ALONE]
  if (alone.items.length > 0) return pickFromNode(alone)

  for (const n of brush.tableItems) {
    if (n.items.length > 0) return pickFromNode(n)
  }
  return 0
}

// Check if neighbor tile has any carpet item from the same brush
function hasMatchingCarpet(
  map: OtbmMap,
  registry: BrushRegistry,
  brush: CarpetBrush,
  x: number,
  y: number,
  z: number,
): boolean {
  const tile = map.tiles.get(`${x},${y},${z}`)
  if (!tile) return false

  for (const item of tile.items) {
    const cb = registry.getCarpetBrushForItem(item.id)
    if (cb && cb.id === brush.id) return true
  }
  return false
}

// Check if neighbor tile has any table item from the same brush
function hasMatchingTable(
  map: OtbmMap,
  registry: BrushRegistry,
  brush: TableBrush,
  x: number,
  y: number,
  z: number,
): boolean {
  const tile = map.tiles.get(`${x},${y},${z}`)
  if (!tile) return false

  for (const item of tile.items) {
    const tb = registry.getTableBrushForItem(item.id)
    if (tb && tb.id === brush.id) return true
  }
  return false
}

// Get the carpet alignment of an item by finding which alignment slot it belongs to
export function getCarpetAlignment(brush: CarpetBrush, itemId: number): number {
  for (let a = 0; a < brush.carpetItems.length; a++) {
    for (const item of brush.carpetItems[a].items) {
      if (item.id === itemId) return a
    }
  }
  return -1
}

// Get the table alignment of an item
export function getTableAlignment(brush: TableBrush, itemId: number): number {
  for (let a = 0; a < brush.tableItems.length; a++) {
    for (const item of brush.tableItems[a].items) {
      if (item.id === itemId) return a
    }
  }
  return -1
}

// Main carpet alignment function — port of CarpetBrush::doCarpets()
export function doCarpets(
  x: number,
  y: number,
  z: number,
  map: OtbmMap,
  registry: BrushRegistry,
): OtbmItem[] {
  const tile = map.tiles.get(`${x},${y},${z}`)
  if (!tile) return []

  const result: OtbmItem[] = []

  for (const item of tile.items) {
    const carpetBrush = registry.getCarpetBrushForItem(item.id)
    if (!carpetBrush) continue

    // Build 8-bit neighbor bitmask
    let tiledata = 0
    if (hasMatchingCarpet(map, registry, carpetBrush, x - 1, y - 1, z)) tiledata |= TILE_NORTHWEST
    if (hasMatchingCarpet(map, registry, carpetBrush, x, y - 1, z)) tiledata |= TILE_NORTH
    if (hasMatchingCarpet(map, registry, carpetBrush, x + 1, y - 1, z)) tiledata |= TILE_NORTHEAST
    if (hasMatchingCarpet(map, registry, carpetBrush, x - 1, y, z)) tiledata |= TILE_WEST
    if (hasMatchingCarpet(map, registry, carpetBrush, x + 1, y, z)) tiledata |= TILE_EAST
    if (hasMatchingCarpet(map, registry, carpetBrush, x - 1, y + 1, z)) tiledata |= TILE_SOUTHWEST
    if (hasMatchingCarpet(map, registry, carpetBrush, x, y + 1, z)) tiledata |= TILE_SOUTH
    if (hasMatchingCarpet(map, registry, carpetBrush, x + 1, y + 1, z)) tiledata |= TILE_SOUTHEAST

    const alignment = CARPET_TYPES[tiledata]

    // If current alignment already matches, keep this item
    const currentAlignment = getCarpetAlignment(carpetBrush, item.id)
    if (currentAlignment === alignment) {
      result.push({ id: item.id })
      continue
    }

    const newId = pickCarpetItem(carpetBrush, alignment)
    if (newId) {
      result.push({ id: newId })
    }
  }

  return result
}

// Main table alignment function — port of TableBrush::doTables()
export function doTables(
  x: number,
  y: number,
  z: number,
  map: OtbmMap,
  registry: BrushRegistry,
): OtbmItem[] {
  const tile = map.tiles.get(`${x},${y},${z}`)
  if (!tile) return []

  const result: OtbmItem[] = []

  for (const item of tile.items) {
    const tableBrush = registry.getTableBrushForItem(item.id)
    if (!tableBrush) continue

    // Build 8-bit neighbor bitmask
    let tiledata = 0
    if (hasMatchingTable(map, registry, tableBrush, x - 1, y - 1, z)) tiledata |= TILE_NORTHWEST
    if (hasMatchingTable(map, registry, tableBrush, x, y - 1, z)) tiledata |= TILE_NORTH
    if (hasMatchingTable(map, registry, tableBrush, x + 1, y - 1, z)) tiledata |= TILE_NORTHEAST
    if (hasMatchingTable(map, registry, tableBrush, x - 1, y, z)) tiledata |= TILE_WEST
    if (hasMatchingTable(map, registry, tableBrush, x + 1, y, z)) tiledata |= TILE_EAST
    if (hasMatchingTable(map, registry, tableBrush, x - 1, y + 1, z)) tiledata |= TILE_SOUTHWEST
    if (hasMatchingTable(map, registry, tableBrush, x, y + 1, z)) tiledata |= TILE_SOUTH
    if (hasMatchingTable(map, registry, tableBrush, x + 1, y + 1, z)) tiledata |= TILE_SOUTHEAST

    const alignment = TABLE_TYPES[tiledata]

    const currentAlignment = getTableAlignment(tableBrush, item.id)
    if (currentAlignment === alignment) {
      result.push({ id: item.id })
      continue
    }

    const newId = pickTableItem(tableBrush, alignment)
    if (newId) {
      result.push({ id: newId })
    }
  }

  return result
}
