// Central registry mapping brush names and item IDs to GroundBrush objects.

import type { AutoBorder, GroundBrush } from './BrushTypes'
import type { WallBrush } from './WallTypes'

export class BrushRegistry {
  private brushesByName = new Map<string, GroundBrush>()
  private brushesByItemId = new Map<number, GroundBrush>()
  // All item IDs that appear in any AutoBorder.tiles[] — used to identify border items
  readonly borderItemIds = new Set<number>()
  // Item ID → border group and alignment (for specific case matching)
  private borderItemGroup = new Map<number, number>()
  private borderItemAlignment = new Map<number, number>()

  // Wall brush maps
  private wallBrushesByName = new Map<string, WallBrush>()
  private wallBrushesByItemId = new Map<number, WallBrush>()
  readonly wallItemIds = new Set<number>()

  constructor(
    brushes: GroundBrush[],
    borders: Map<number, AutoBorder>,
    wallBrushes: WallBrush[] = [],
  ) {
    // Register all ground brushes
    for (const brush of brushes) {
      this.brushesByName.set(brush.name, brush)
      for (const item of brush.items) {
        this.brushesByItemId.set(item.id, brush)
      }
    }

    // Resolve ground brush friend IDs (names → numeric IDs)
    for (const brush of brushes) {
      for (const friendName of brush.friends) {
        const friend = this.brushesByName.get(friendName)
        if (friend) {
          brush.friendIds.add(friend.id)
        }
      }
    }

    // Resolve border "to" targets that reference brush names
    for (const brush of brushes) {
      for (const block of brush.borders) {
        if (block.toName !== null) {
          const target = this.brushesByName.get(block.toName)
          if (target) {
            block.to = target.id
          } else {
            // Target brush not found — disable this border block
            block.to = -1
          }
        }
      }
    }

    // Collect all border item IDs and build group/alignment maps
    for (const border of borders.values()) {
      for (let edgeIndex = 0; edgeIndex < border.tiles.length; edgeIndex++) {
        const itemId = border.tiles[edgeIndex]
        if (itemId != null) {
          this.borderItemIds.add(itemId)
          this.borderItemGroup.set(itemId, border.group)
          this.borderItemAlignment.set(itemId, edgeIndex)
        }
      }
    }

    // Register wall brushes
    for (const wb of wallBrushes) {
      this.wallBrushesByName.set(wb.name, wb)
      // Register all wall item IDs (both wall items and door items)
      for (const node of wb.wallItems) {
        for (const item of node.items) {
          this.wallBrushesByItemId.set(item.id, wb)
          this.wallItemIds.add(item.id)
        }
      }
      for (const doors of wb.doorItems) {
        for (const door of doors) {
          this.wallBrushesByItemId.set(door.id, wb)
          this.wallItemIds.add(door.id)
        }
      }
    }

    // Resolve wall brush friend IDs
    for (const wb of wallBrushes) {
      for (const friendName of wb.friends) {
        const friend = this.wallBrushesByName.get(friendName)
        if (friend) {
          wb.friendIds.add(friend.id)
        }
      }
    }

    // Resolve wall brush redirects
    for (const wb of wallBrushes) {
      if (wb.redirectName) {
        const target = this.wallBrushesByName.get(wb.redirectName)
        if (target) {
          wb.redirectTo = target
        }
      }
    }
  }

  getBrushByName(name: string): GroundBrush | undefined {
    return this.brushesByName.get(name)
  }

  getBrushForItem(itemId: number): GroundBrush | undefined {
    return this.brushesByItemId.get(itemId)
  }

  isBorderItem(itemId: number): boolean {
    return this.borderItemIds.has(itemId)
  }

  getBorderItemGroup(itemId: number): number {
    return this.borderItemGroup.get(itemId) ?? 0
  }

  getBorderItemAlignment(itemId: number): number {
    return this.borderItemAlignment.get(itemId) ?? 0 // 0 = BORDER_NONE
  }

  getWallBrushByName(name: string): WallBrush | undefined {
    return this.wallBrushesByName.get(name)
  }

  getWallBrushForItem(itemId: number): WallBrush | undefined {
    return this.wallBrushesByItemId.get(itemId)
  }

  isWallItem(itemId: number): boolean {
    return this.wallItemIds.has(itemId)
  }

  // Pick a random ground item from a brush using weighted chance
  pickRandomItem(brush: GroundBrush): number {
    if (brush.items.length === 0) return 0
    if (brush.totalChance === 0) return brush.items[0].id

    const roll = Math.random() * brush.totalChance
    let cumulative = 0
    for (const item of brush.items) {
      cumulative += item.chance
      if (roll < cumulative) return item.id
    }
    return brush.items[brush.items.length - 1].id
  }
}
