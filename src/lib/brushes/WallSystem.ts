// Wall auto-alignment system — port of RME's WallBrush::doWalls()
// When a wall is placed or neighbors change, this recalculates the correct
// wall piece (horizontal, vertical, corner, T-junction, etc.) for each wall.

import type { OtbmMap, OtbmItem } from '../otbm'
import type { BrushRegistry } from './BrushRegistry'
import type { WallBrush, WallNode } from './WallTypes'
import {
  WALL_UNTOUCHABLE,
  WALL_FULL_TYPES,
  WALL_HALF_TYPES,
  WALLTILE_NORTH, WALLTILE_WEST, WALLTILE_EAST, WALLTILE_SOUTH,
} from './WallTypes'

// Check if a neighbor tile has a wall matching the given brush (same brush or friend)
function hasMatchingWall(
  map: OtbmMap,
  registry: BrushRegistry,
  brush: WallBrush,
  x: number,
  y: number,
  z: number,
): boolean {
  const tile = map.tiles.get(`${x},${y},${z}`)
  if (!tile) return false

  for (const item of tile.items) {
    const wb = registry.getWallBrushForItem(item.id)
    if (!wb) continue

    // Direct match
    if (wb.id === brush.id) return true

    // Friend check (bidirectional)
    if (brush.friendIds.has(wb.id) || wb.friendIds.has(brush.id)) return true
  }

  return false
}

// Pick a random wall item from a WallNode using cumulative chance
function pickFromNode(node: WallNode): number {
  if (node.items.length === 0) return 0

  if (node.totalChance <= 0) {
    // No chance values — just use the first item
    return node.items[0].id
  }

  // Random from 1..totalChance (inclusive), cumulative chance lookup
  const roll = Math.floor(Math.random() * node.totalChance) + 1
  for (const item of node.items) {
    if (roll <= item.chance) return item.id
  }
  return node.items[node.items.length - 1].id
}

// Pick a wall item for the given alignment, walking the redirect chain if needed
function pickWallItem(brush: WallBrush, alignment: number): number {
  let tryBrush: WallBrush | null = brush
  const startBrush = brush

  while (tryBrush) {
    const node = tryBrush.wallItems[alignment]
    if (node.items.length > 0) {
      return pickFromNode(node)
    }

    // Walk redirect chain
    tryBrush = tryBrush.redirectTo
    if (tryBrush === startBrush) break // prevent infinite loop
  }

  return 0
}

// Get the wall alignment (0-16) of an item by finding which alignment slot it belongs to
function getWallAlignment(brush: WallBrush, itemId: number): number {
  // Check wall items
  for (let a = 0; a < brush.wallItems.length; a++) {
    for (const item of brush.wallItems[a].items) {
      if (item.id === itemId) return a
    }
  }
  // Check door items
  for (let a = 0; a < brush.doorItems.length; a++) {
    for (const door of brush.doorItems[a]) {
      if (door.id === itemId) return a
    }
  }

  // Walk redirect chain
  let tryBrush = brush.redirectTo
  while (tryBrush && tryBrush !== brush) {
    for (let a = 0; a < tryBrush.wallItems.length; a++) {
      for (const item of tryBrush.wallItems[a].items) {
        if (item.id === itemId) return a
      }
    }
    for (let a = 0; a < tryBrush.doorItems.length; a++) {
      for (const door of tryBrush.doorItems[a]) {
        if (door.id === itemId) return a
      }
    }
    tryBrush = tryBrush.redirectTo
  }

  return -1
}

// Main wall alignment function — port of WallBrush::doWalls()
// Processes all wall items on a tile and returns the correctly aligned wall items.
export function doWalls(
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
    const wallBrush = registry.getWallBrushForItem(item.id)
    if (!wallBrush) continue

    // Check 4 cardinal neighbors for matching walls
    let tiledata = 0
    if (y > 0 && hasMatchingWall(map, registry, wallBrush, x, y - 1, z)) {
      tiledata |= WALLTILE_NORTH
    }
    if (x > 0 && hasMatchingWall(map, registry, wallBrush, x - 1, y, z)) {
      tiledata |= WALLTILE_WEST
    }
    if (hasMatchingWall(map, registry, wallBrush, x + 1, y, z)) {
      tiledata |= WALLTILE_EAST
    }
    if (hasMatchingWall(map, registry, wallBrush, x, y + 1, z)) {
      tiledata |= WALLTILE_SOUTH
    }

    // Get current alignment of this wall item
    const currentAlignment = getWallAlignment(wallBrush, item.id)

    // Handle untouchable walls — keep as-is
    if (currentAlignment === WALL_UNTOUCHABLE) {
      result.push({ id: item.id })
      continue
    }

    // Two-pass alignment: try full types first, then half types as fallback
    let newId = 0
    for (let pass = 0; pass < 2 && !newId; pass++) {
      const alignment = pass === 0
        ? WALL_FULL_TYPES[tiledata]
        : WALL_HALF_TYPES[tiledata]

      // If current alignment already matches, keep this item
      if (currentAlignment === alignment) {
        newId = item.id
        break
      }

      // Try to pick a new item for this alignment
      newId = pickWallItem(wallBrush, alignment)
    }

    if (newId) {
      result.push({ id: newId })
    }
  }

  return result
}
