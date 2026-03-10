import { useMemo } from 'react'
import type { OtbmMap, OtbmTile } from '../lib/otbm'

/**
 * Pre-computes tile counts grouped by an ID extracted from each tile.
 * Returns a Map<id, count> that updates when mapData, extractor, or
 * invalidationKey changes. The invalidationKey is an intentional
 * cache-buster (e.g. sidecars) that signals tile data has mutated.
 */
export function useTileCounts(
  mapData: OtbmMap | null,
  extractor: (tile: OtbmTile) => number[],
  invalidationKey: unknown,
): Map<number, number> {
  return useMemo(() => {
    const counts = new Map<number, number>()
    if (mapData) {
      for (const tile of mapData.tiles.values()) {
        for (const id of extractor(tile)) {
          counts.set(id, (counts.get(id) ?? 0) + 1)
        }
      }
    }
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidationKey is an intentional cache-buster
  }, [mapData, extractor, invalidationKey])
}
