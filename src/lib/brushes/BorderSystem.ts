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

// Check if a border block targets a given brush (exact match or wildcard).
function borderTargets(bb: BorderBlock, brush: GroundBrush): boolean {
  // RME: exact match or wildcard only — no friend matching here
  return bb.to === brush.id || bb.to === 0xFFFFFFFF
}

// Port of RME's TerrainBrush::friendOf()
// Returns true if `self` considers `other` a friend.
// Supports hate_friends (inverted logic) and 0xFFFFFFFF wildcard.
function friendOf(self: GroundBrush, other: GroundBrush): boolean {
  const otherId = other.id
  for (const friendId of self.friendIds) {
    if (friendId === otherId || friendId === 0xFFFFFFFF) {
      return !self.hateFriends
    }
  }
  return self.hateFriends
}

// Port of GroundBrush::getBrushTo()
// Finds the appropriate BorderBlock for a transition between two brushes.
function getBrushTo(
  first: GroundBrush | null,
  second: GroundBrush | null,
): BorderBlock | null {
  if (first) {
    if (second) {
      if (first.zOrder < second.zOrder && second.hasOuterBorder) {
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
  // Collect specific case blocks as we go (RME collects from both new & merged blocks)
  const specificBlocks = new Set<BorderBlock>()

  for (let i = 0; i < 8; i++) {
    const neighbour = neighbours[i]
    if (neighbour.visited) continue

    const other = neighbour.brush

    if (borderBrush) {
      if (other) {
        if (other.id === borderBrush.id) continue

        if (other.hasOuterBorder || borderBrush.hasInnerBorder) {
          let onlyMountain = false
          if (friendOf(other, borderBrush) || friendOf(borderBrush, other)) {
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
            // Add mountain/optional border if both brushes support it.
            // RME checks tile->hasOptionalBorder() (per-tile flag); we
            // approximate by checking borderBrush.optionalBorder.
            if (other.optionalBorder && borderBrush.optionalBorder) {
              borderList.push({
                alignment: tiledata,
                z: 0x7FFFFFFF,  // Always on top of other borders
                border: other.optionalBorder,
                borderBlock: null,
              })
              if (other.useSoloOptionalBorder) {
                onlyMountain = true
              }
            }

            if (!onlyMountain) {
              const borderBlock = getBrushTo(borderBrush, other)
              if (borderBlock && borderBlock.autoborder) {
                // Track specific cases (like RME: add for both new and merged)
                if (borderBlock.specificCases.length) {
                  specificBlocks.add(borderBlock)
                }
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
            if (borderBlock.specificCases.length) {
              specificBlocks.add(borderBlock)
            }
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
          if (borderBlock.specificCases.length) {
            specificBlocks.add(borderBlock)
          }
          borderList.push({
            alignment: tiledata,
            z: other.zOrder,
            border: borderBlock.autoborder,
            borderBlock,
          })
        }

        // Add mountain if center tile's brush also supports optional borders
        if (other.optionalBorder && borderBrush?.optionalBorder) {
          borderList.push({
            alignment: tiledata,
            z: 0x7FFFFFFF,
            border: other.optionalBorder,
            borderBlock: null,
          })
        }
      }
    }
    neighbour.visited = true
  }

  // Sort ascending (RME sorts ascending then pops from back = processes highest z last)
  if (borderList.length > 1) borderList.sort((a, b) => a.z - b.z)

  // Generate border items — process from lowest z to highest z.
  // RME inserts each border at items.begin() while processing highest-z first,
  // yielding final order [lowest-z, ..., highest-z]. We achieve the same by
  // processing lowest-z first and pushing (appending) to the result array.
  const result: OtbmItem[] = []
  for (let idx = 0; idx < borderList.length; idx++) {
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

  // Apply specific case post-processing (matches RME's iteration order:
  // outer loop = result items, check group first, then items_to_match)
  if (specificBlocks.size > 0) {
    for (const block of specificBlocks) {
      for (const scb of block.specificCases) {
        // Count matches by iterating result items (like RME iterates tile->items)
        let matches = 0
        for (const item of result) {
          // Group match takes priority (like RME: check group first, then continue)
          if (scb.matchGroup > 0) {
            if (
              registry.getBorderItemGroup(item.id) === scb.matchGroup &&
              registry.getBorderItemAlignment(item.id) === scb.groupMatchAlignment
            ) {
              matches++
              continue
            }
          }
          // Direct item match — a single item can match multiple entries
          for (const matchId of scb.itemsToMatch) {
            if (item.id === matchId) {
              matches++
            }
          }
        }

        if (matches === scb.itemsToMatch.length) {
          if (scb.deleteAll) {
            // Delete all matching border items
            for (let i = result.length - 1; i >= 0; i--) {
              const id = result[i].id
              let shouldDelete = false
              for (const matchId of scb.itemsToMatch) {
                if (id === matchId) { shouldDelete = true; break }
              }
              if (shouldDelete) {
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
