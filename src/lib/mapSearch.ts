import type { OtbmMap, OtbmItem } from './otbm'
import { deepCloneItem } from './otbm'
import type { MapMutator } from './MapMutator'
import { yieldToMain } from './yieldToMain'

export interface SearchResult {
  x: number
  y: number
  z: number
  itemIndices: number[]
}

const YIELD_INTERVAL = 2000 // tiles per chunk before yielding to browser

export async function findItemsOnMap(
  mapData: OtbmMap,
  itemId: number,
  scopeTileKeys?: Set<string>,
  onProgress?: (processed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  const tiles = scopeTileKeys
    ? [...scopeTileKeys].map(k => mapData.tiles.get(k)).filter(Boolean)
    : [...mapData.tiles.values()]

  const total = tiles.length
  let processed = 0

  for (const tile of tiles) {
    if (signal?.aborted) return results
    if (!tile) { processed++; continue }

    const indices: number[] = []
    for (let i = 0; i < tile.items.length; i++) {
      if (tile.items[i].id === itemId) {
        indices.push(i)
      }
      if (tile.items[i].items) {
        if (hasNestedItem(tile.items[i].items!, itemId)) {
          indices.push(i)
        }
      }
    }
    if (indices.length > 0) {
      results.push({ x: tile.x, y: tile.y, z: tile.z, itemIndices: indices })
    }

    processed++
    if (processed % YIELD_INTERVAL === 0) {
      onProgress?.(processed, total)
      await yieldToMain()
    }
  }

  onProgress?.(total, total)
  return results
}

function hasNestedItem(items: OtbmItem[], itemId: number): boolean {
  for (const item of items) {
    if (item.id === itemId) return true
    if (item.items && hasNestedItem(item.items, itemId)) return true
  }
  return false
}

function replaceItemId(items: OtbmItem[], sourceId: number, targetId: number): number {
  let count = 0
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === sourceId) {
      items[i] = { ...items[i], id: targetId }
      count++
    }
    if (items[i].items) {
      count += replaceItemId(items[i].items!, sourceId, targetId)
    }
  }
  return count
}

export async function replaceItemsOnMap(
  mapData: OtbmMap,
  mutator: MapMutator,
  sourceId: number,
  targetId: number,
  scopeTileKeys?: Set<string>,
  onProgress?: (processed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<number> {
  let totalReplaced = 0

  const tiles = scopeTileKeys
    ? [...scopeTileKeys].map(k => mapData.tiles.get(k)).filter(Boolean)
    : [...mapData.tiles.values()]

  const total = tiles.length
  let processed = 0

  for (const tile of tiles) {
    if (signal?.aborted) return totalReplaced
    if (!tile) { processed++; continue }

    const hasMatch = tile.items.some(item =>
      item.id === sourceId || (item.items && hasNestedItem(item.items, sourceId))
    )
    if (!hasMatch) { processed++; continue }

    const newItems = tile.items.map(deepCloneItem)
    const count = replaceItemId(newItems, sourceId, targetId)
    if (count > 0) {
      mutator.setTileItems(tile.x, tile.y, tile.z, newItems)
      totalReplaced += count
    }

    processed++
    if (processed % YIELD_INTERVAL === 0) {
      onProgress?.(processed, total)
      await yieldToMain()
    }
  }

  onProgress?.(total, total)
  return totalReplaced
}
