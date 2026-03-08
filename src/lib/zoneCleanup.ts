import type { OtbmTile } from './otbm'

/**
 * Remove a zone ID from all tiles in the map.
 * Mutates tiles in place. Returns the number of tiles that were modified.
 */
export function scrubZoneFromTiles(tiles: Map<string, OtbmTile>, zoneId: number): number {
  let modified = 0
  for (const tile of tiles.values()) {
    if (!tile.zones) continue
    const idx = tile.zones.indexOf(zoneId)
    if (idx === -1) continue
    tile.zones.splice(idx, 1)
    if (tile.zones.length === 0) {
      delete tile.zones
    }
    modified++
  }
  return modified
}
