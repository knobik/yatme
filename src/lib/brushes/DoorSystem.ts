// Door placement and state-switching utilities.
// Pure functions operating on WallBrush door data.

import type { WallBrush } from './WallTypes'
import type { BrushRegistry } from './BrushRegistry'
import { getWallAlignment } from './WallSystem'

// Find a door item ID for the given alignment, door type, and open preference.
// Walks the redirect chain. Returns item ID or 0 if no match.
export function findDoorForAlignment(
  brush: WallBrush,
  alignment: number,
  doorType: number,
  preferOpen: boolean,
): number {
  let tryBrush: WallBrush | null = brush
  const startBrush = brush
  let fallbackId = 0

  while (tryBrush) {
    for (const dt of tryBrush.doorItems[alignment]) {
      if (dt.type === doorType) {
        if (dt.open === preferOpen) return dt.id
        if (!fallbackId) fallbackId = dt.id
      }
    }
    tryBrush = tryBrush.redirectTo
    if (tryBrush === startBrush) break
  }

  return fallbackId
}

// Toggle a door between open/closed states.
// Returns the new item ID, or 0 if the item is not a door or no counterpart exists.
export function switchDoor(
  itemId: number,
  registry: BrushRegistry,
): number {
  const brush = registry.getWallBrushForItem(itemId)
  if (!brush) return 0

  const doorInfo = registry.getDoorInfo(itemId)
  if (!doorInfo) return 0

  const alignment = getWallAlignment(brush, itemId)
  if (alignment < 0) return 0

  return findDoorForAlignment(brush, alignment, doorInfo.type, !doorInfo.open)
}
