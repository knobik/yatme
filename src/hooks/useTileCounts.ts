import { useMemo } from 'react'
import type { OtbmMap, OtbmTile } from '../lib/otbm'

/**
 * Pre-computes tile counts grouped by an ID extracted from each tile.
 * Returns a Map<id, count> that updates when any dependency changes.
 */
export function useTileCounts(
  mapData: OtbmMap | null,
  extractor: (tile: OtbmTile) => number[],
  deps: React.DependencyList,
): Map<number, number> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [mapData, ...deps])
}
