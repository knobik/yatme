// Port of RME's GroundBrush::doBorders() — computes border items for a tile.

import type { OtbmMap, OtbmItem } from '../otbm'
import type { AutoBorder, BorderBlock, GroundBrush } from './BrushTypes'
import type { BrushRegistry } from './BrushRegistry'
import {
  BORDER_TYPES, BORDER_NONE,
  NORTH_HORIZONTAL, EAST_HORIZONTAL, SOUTH_HORIZONTAL, WEST_HORIZONTAL,
  NORTHWEST_DIAGONAL, NORTHEAST_DIAGONAL, SOUTHEAST_DIAGONAL, SOUTHWEST_DIAGONAL,
} from './BorderTable'

interface BorderCluster {
  alignment: number   // tiledata bitmask
  z: number           // z-order for sorting
  border: AutoBorder
  borderBlock: BorderBlock | null  // reference for specific case tracking
}

// Neighbor offsets: NW, N, NE, W, E, SW, S, SE
const NEIGHBOR_OFFSETS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
]

function getGroundBrush(
  map: OtbmMap,
  x: number, y: number, z: number,
  registry: BrushRegistry,
): GroundBrush | null {
  const tile = map.tiles.get(`${x},${y},${z}`)
  if (!tile || tile.items.length === 0) return null
  // Ground item is always first
  return registry.getBrushForItem(tile.items[0].id) ?? null
}

// Check if a border block targets a given brush (exact match, wildcard, or friend).
function borderTargets(bb: BorderBlock, brush: GroundBrush): boolean {
  if (bb.to === brush.id || bb.to === 0xFFFFFFFF) return true
  // Also match if the brush declares the target as a friend
  // (e.g., "walkable sea outfit" is a friend of "sea", so sand's inner
  //  border to="sea" should also apply to walkable sea outfit)
  if (bb.to > 0 && bb.to !== 0xFFFFFFFF && brush.friendIds.has(bb.to)) return true
  return false
}

// Port of GroundBrush::getBrushTo()
// Finds the appropriate BorderBlock for a transition between two brushes.
function getBrushTo(
  first: GroundBrush | null,
  second: GroundBrush | null,
): BorderBlock | null {
  if (first) {
    if (second) {
      if (first.zOrder < second.zOrder && (second.hasOuterBorder || second.hasOuterZilchBorder)) {
        // Check first's inner borders targeting second
        if (first.hasInnerBorder) {
          for (const bb of first.borders) {
            if (bb.outer) continue
            if (borderTargets(bb, second)) return bb
          }
        }
        // Check second's outer borders targeting first
        for (const bb of second.borders) {
          if (!bb.outer) continue
          if (borderTargets(bb, first)) return bb
        }
      } else if (first.hasInnerBorder) {
        for (const bb of first.borders) {
          if (bb.outer) continue
          if (borderTargets(bb, second)) return bb
        }
      }
    } else if (first.hasInnerZilchBorder) {
      // Border against empty/undefined tile
      for (const bb of first.borders) {
        if (bb.outer) continue
        if (bb.to === 0) return bb
      }
    }
  } else if (second && second.hasOuterZilchBorder) {
    // Center is empty, neighbor has outer zilch border
    for (const bb of second.borders) {
      if (!bb.outer) continue
      if (bb.to === 0) return bb
    }
  }
  return null
}

// Compute border items for a single tile at (x, y, z).
// Returns the list of border OtbmItems that should be placed on this tile.
export function computeBorders(
  x: number, y: number, z: number,
  map: OtbmMap,
  registry: BrushRegistry,
): OtbmItem[] {
  const borderBrush = getGroundBrush(map, x, y, z, registry)

  // Get 8 neighbors' ground brushes
  const neighbours: { visited: boolean; brush: GroundBrush | null }[] = []
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0) {
      neighbours.push({ visited: false, brush: null })
    } else {
      neighbours.push({ visited: false, brush: getGroundBrush(map, nx, ny, z, registry) })
    }
  }

  const borderList: BorderCluster[] = []

  for (let i = 0; i < 8; i++) {
    const neighbour = neighbours[i]
    if (neighbour.visited) continue

    const other = neighbour.brush

    if (borderBrush) {
      if (other) {
        if (other.id === borderBrush.id) continue

        if (other.hasOuterBorder || other.hasOuterZilchBorder || borderBrush.hasInnerBorder) {
          let onlyMountain = false
          if (borderBrush.friendIds.has(other.id) || other.friendIds.has(borderBrush.id)) {
            if (!other.optionalBorder) continue
            onlyMountain = true
          }

          // Build tiledata bitmask for all positions with this neighbor brush
          let tiledata = 0
          for (let j = i; j < 8; j++) {
            const n = neighbours[j]
            if (!n.visited && n.brush && n.brush.id === other.id) {
              n.visited = true
              tiledata |= 1 << j
            }
          }

          if (tiledata !== 0) {
            // Skip mountain/optional borders for v1
            if (!onlyMountain) {
              const borderBlock = getBrushTo(borderBrush, other)
              if (borderBlock && borderBlock.autoborder) {
                // Check if this autoborder already exists in our list
                let found = false
                for (const existing of borderList) {
                  if (existing.border.id === borderBlock.autoborder.id) {
                    existing.alignment |= tiledata
                    if (existing.z < other.zOrder) existing.z = other.zOrder
                    found = true
                    break
                  }
                }
                if (!found) {
                  borderList.push({
                    alignment: tiledata,
                    z: other.zOrder,
                    border: borderBlock.autoborder,
                    borderBlock,
                  })
                }
              }
            }
          }
        }
      } else if (borderBrush.hasInnerZilchBorder) {
        // Border against empty tiles
        let tiledata = 0
        for (let j = i; j < 8; j++) {
          const n = neighbours[j]
          if (!n.visited && !n.brush) {
            n.visited = true
            tiledata |= 1 << j
          }
        }

        if (tiledata !== 0) {
          const borderBlock = getBrushTo(borderBrush, null)
          if (borderBlock?.autoborder) {
            borderList.push({
              alignment: tiledata,
              z: 5000,
              border: borderBlock.autoborder,
              borderBlock,
            })
          }
        }
        continue
      }
    } else if (other && other.hasOuterZilchBorder) {
      // Center tile is empty, neighbor has outer zilch border
      let tiledata = 0
      for (let j = i; j < 8; j++) {
        const n = neighbours[j]
        if (!n.visited && n.brush && n.brush.id === other.id) {
          n.visited = true
          tiledata |= 1 << j
        }
      }

      if (tiledata !== 0) {
        const borderBlock = getBrushTo(null, other)
        if (borderBlock?.autoborder) {
          borderList.push({
            alignment: tiledata,
            z: other.zOrder,
            border: borderBlock.autoborder,
            borderBlock,
          })
        }
      }
    }
    neighbour.visited = true
  }

  // Collect border blocks that have specific cases (deduplicated via Set)
  const specificBlocks = new Set<BorderBlock>()
  for (const cluster of borderList) {
    if (cluster.borderBlock?.specificCases.length) {
      specificBlocks.add(cluster.borderBlock)
    }
  }

  // Sort ascending (RME sorts ascending then pops from back = processes highest z last)
  if (borderList.length > 1) borderList.sort((a, b) => a.z - b.z)

  // Generate border items (process from back like RME — highest z-order drawn last = on top)
  const result: OtbmItem[] = []
  for (let idx = borderList.length - 1; idx >= 0; idx--) {
    const cluster = borderList[idx]
    const packed = BORDER_TYPES[cluster.alignment]
    if (packed === 0) continue

    for (let i = 0; i < 4; i++) {
      const dir = (packed >>> (i * 8)) & 0xFF
      if (dir === BORDER_NONE) break

      const itemId = cluster.border.tiles[dir]
      if (itemId != null) {
        result.push({ id: itemId })
      } else {
        // Diagonal fallback: decompose into two cardinal borders
        if (dir === NORTHWEST_DIAGONAL) {
          if (cluster.border.tiles[WEST_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[WEST_HORIZONTAL]! })
          if (cluster.border.tiles[NORTH_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[NORTH_HORIZONTAL]! })
        } else if (dir === NORTHEAST_DIAGONAL) {
          if (cluster.border.tiles[EAST_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[EAST_HORIZONTAL]! })
          if (cluster.border.tiles[NORTH_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[NORTH_HORIZONTAL]! })
        } else if (dir === SOUTHWEST_DIAGONAL) {
          if (cluster.border.tiles[SOUTH_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[SOUTH_HORIZONTAL]! })
          if (cluster.border.tiles[WEST_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[WEST_HORIZONTAL]! })
        } else if (dir === SOUTHEAST_DIAGONAL) {
          if (cluster.border.tiles[SOUTH_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[SOUTH_HORIZONTAL]! })
          if (cluster.border.tiles[EAST_HORIZONTAL] != null)
            result.push({ id: cluster.border.tiles[EAST_HORIZONTAL]! })
        }
      }
    }
  }

  // Apply specific case post-processing
  if (specificBlocks.size > 0) {
    for (const block of specificBlocks) {
      for (const scb of block.specificCases) {
        // Count how many conditions match against current result items
        let matches = 0
        for (const matchEntry of scb.itemsToMatch) {
          if (scb.matchGroup > 0 && matchEntry === scb.matchGroup) {
            // Group match: find any result item with matching group + alignment
            for (const item of result) {
              if (
                registry.getBorderItemGroup(item.id) === scb.matchGroup &&
                registry.getBorderItemAlignment(item.id) === scb.groupMatchAlignment
              ) {
                matches++
                break
              }
            }
          } else {
            // Direct item match
            for (const item of result) {
              if (item.id === matchEntry) { matches++; break }
            }
          }
        }

        if (matches === scb.itemsToMatch.length) {
          if (scb.deleteAll) {
            // Remove all matched items in a single backward pass
            const toDelete = new Set(scb.itemsToMatch)
            const groupMatch = scb.matchGroup > 0
            for (let i = result.length - 1; i >= 0; i--) {
              const id = result[i].id
              if (toDelete.has(id) || (groupMatch &&
                registry.getBorderItemGroup(id) === scb.matchGroup &&
                registry.getBorderItemAlignment(id) === scb.groupMatchAlignment
              )) {
                result.splice(i, 1)
              }
            }
          } else if (scb.toReplaceId !== 0) {
            // Replace first occurrence of toReplaceId with withId
            for (const item of result) {
              if (item.id === scb.toReplaceId) {
                item.id = scb.withId
                break
              }
            }
          }
        }
      }
    }
  }

  return result
}
