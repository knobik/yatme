import type { OtbmTile } from './otbm'
import { PZ_FLAG } from './otbm'
import type { HouseData } from './sidecars'

/**
 * Remove a house ID from all tiles in the map.
 * Clears houseId and PZ flag from matching tiles.
 * Mutates tiles in place. Returns the number of tiles that were modified.
 */
export function scrubHouseFromTiles(tiles: Map<string, OtbmTile>, houseId: number): number {
  let modified = 0
  for (const tile of tiles.values()) {
    if (tile.houseId !== houseId) continue
    delete tile.houseId
    tile.flags = tile.flags & ~PZ_FLAG
    modified++
  }
  return modified
}

/**
 * Recompute the `size` field for all houses based on actual tile counts.
 * Mutates houses in place.
 */
export function updateAllHouseSizes(tiles: Map<string, OtbmTile>, houses: HouseData[]): void {
  const counts = new Map<number, number>()
  for (const tile of tiles.values()) {
    if (tile.houseId == null) continue
    counts.set(tile.houseId, (counts.get(tile.houseId) ?? 0) + 1)
  }
  for (const house of houses) {
    house.size = counts.get(house.id) ?? 0
  }
}
