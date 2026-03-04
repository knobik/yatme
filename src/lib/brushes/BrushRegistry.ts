// Central registry mapping brush names and item IDs to GroundBrush objects.

import type { AutoBorder, GroundBrush } from './BrushTypes'
import type { WallBrush, WallDoor } from './WallTypes'
import type { CarpetBrush, TableBrush } from './CarpetTypes'
import type { DoodadBrush } from './DoodadTypes'

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

  // Door item lookups
  private doorItemInfo = new Map<number, WallDoor>()
  readonly doorItemIds = new Set<number>()

  // Carpet brush maps
  private carpetBrushesByName = new Map<string, CarpetBrush>()
  private carpetBrushesByItemId = new Map<number, CarpetBrush>()
  readonly carpetItemIds = new Set<number>()

  // Table brush maps
  private tableBrushesByName = new Map<string, TableBrush>()
  private tableBrushesByItemId = new Map<number, TableBrush>()
  readonly tableItemIds = new Set<number>()

  // Doodad brush maps
  private doodadBrushesByName = new Map<string, DoodadBrush>()
  private doodadBrushesByItemId = new Map<number, DoodadBrush>()
  readonly doodadItemIds = new Set<number>()

  constructor(
    brushes: GroundBrush[],
    borders: Map<number, AutoBorder>,
    wallBrushes: WallBrush[] = [],
    carpetBrushes: CarpetBrush[] = [],
    tableBrushes: TableBrush[] = [],
    doodadBrushes: DoodadBrush[] = [],
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
          this.doorItemIds.add(door.id)
          this.doorItemInfo.set(door.id, door)
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

    // Register carpet brushes
    for (const cb of carpetBrushes) {
      this.carpetBrushesByName.set(cb.name, cb)
      for (const node of cb.carpetItems) {
        for (const item of node.items) {
          this.carpetBrushesByItemId.set(item.id, cb)
          this.carpetItemIds.add(item.id)
        }
      }
    }

    // Register table brushes
    for (const tb of tableBrushes) {
      this.tableBrushesByName.set(tb.name, tb)
      for (const node of tb.tableItems) {
        for (const item of node.items) {
          this.tableBrushesByItemId.set(item.id, tb)
          this.tableItemIds.add(item.id)
        }
      }
    }

    // Register doodad brushes
    for (const db of doodadBrushes) {
      this.doodadBrushesByName.set(db.name, db)
      for (const alt of db.alternatives) {
        for (const single of alt.singles) {
          this.doodadBrushesByItemId.set(single.itemId, db)
          this.doodadItemIds.add(single.itemId)
        }
        for (const comp of alt.composites) {
          for (const tile of comp.tiles) {
            for (const itemId of tile.itemIds) {
              this.doodadBrushesByItemId.set(itemId, db)
              this.doodadItemIds.add(itemId)
            }
          }
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

  isDoorItem(itemId: number): boolean {
    return this.doorItemIds.has(itemId)
  }

  getDoorInfo(itemId: number): WallDoor | undefined {
    return this.doorItemInfo.get(itemId)
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

  getCarpetBrushByName(name: string): CarpetBrush | undefined {
    return this.carpetBrushesByName.get(name)
  }

  getCarpetBrushForItem(itemId: number): CarpetBrush | undefined {
    return this.carpetBrushesByItemId.get(itemId)
  }

  isCarpetItem(itemId: number): boolean {
    return this.carpetItemIds.has(itemId)
  }

  getTableBrushByName(name: string): TableBrush | undefined {
    return this.tableBrushesByName.get(name)
  }

  getTableBrushForItem(itemId: number): TableBrush | undefined {
    return this.tableBrushesByItemId.get(itemId)
  }

  isTableItem(itemId: number): boolean {
    return this.tableItemIds.has(itemId)
  }

  getDoodadBrushByName(name: string): DoodadBrush | undefined {
    return this.doodadBrushesByName.get(name)
  }

  getDoodadBrushForItem(itemId: number): DoodadBrush | undefined {
    return this.doodadBrushesByItemId.get(itemId)
  }

  isDoodadItem(itemId: number): boolean {
    return this.doodadItemIds.has(itemId)
  }
}
