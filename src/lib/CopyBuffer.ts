import type { OtbmMap, OtbmItem } from './otbm'
import { deepCloneItem } from './otbm'
import type { MapMutator } from './MapMutator'
import type { SelectedItemInfo } from '../hooks/useSelection'

export interface CopyBufferTile {
  dx: number
  dy: number
  dz: number
  items: OtbmItem[]
}

interface SerializedCopyBuffer {
  version: 1
  origin: { x: number; y: number; z: number }
  tiles: CopyBufferTile[]
}

/** Group selection items by tile key and remove them from the map via mutator.
 *  Returns the list of affected tile positions. */
export function removeSelectedItems(
  selection: SelectedItemInfo[],
  mapData: OtbmMap,
  mutator: MapMutator,
): { x: number; y: number; z: number }[] {
  const byTile = new Map<string, SelectedItemInfo[]>()
  for (const item of selection) {
    const key = `${item.x},${item.y},${item.z}`
    const list = byTile.get(key) ?? []
    list.push(item)
    byTile.set(key, list)
  }

  const affectedPositions: { x: number; y: number; z: number }[] = []

  for (const [key, tileItems] of byTile) {
    const tile = mapData.tiles.get(key)
    if (!tile) continue

    const pos = { x: tileItems[0].x, y: tileItems[0].y, z: tileItems[0].z }
    affectedPositions.push(pos)

    if (tileItems.length >= tile.items.length) {
      mutator.setTileItems(pos.x, pos.y, pos.z, [])
    } else {
      const indices = [...new Set(tileItems.map(t => t.itemIndex))].sort((a, b) => b - a)
      for (const idx of indices) {
        mutator.removeItem(pos.x, pos.y, pos.z, idx)
      }
    }
  }

  return affectedPositions
}

export class CopyBuffer {
  private tiles: Map<string, CopyBufferTile> = new Map()
  private origin: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

  copy(selection: SelectedItemInfo[], mapData: OtbmMap): void {
    this.tiles.clear()
    if (selection.length === 0) return

    // Group selection by tile
    const byTile = new Map<string, { pos: { x: number; y: number; z: number }; indices: Set<number> }>()
    for (const item of selection) {
      const key = `${item.x},${item.y},${item.z}`
      let entry = byTile.get(key)
      if (!entry) {
        entry = { pos: { x: item.x, y: item.y, z: item.z }, indices: new Set() }
        byTile.set(key, entry)
      }
      entry.indices.add(item.itemIndex)
    }

    // Compute origin as min(x, y, z) in a single pass
    let minX = Infinity, minY = Infinity, minZ = Infinity
    for (const { pos } of byTile.values()) {
      if (pos.x < minX) minX = pos.x
      if (pos.y < minY) minY = pos.y
      if (pos.z < minZ) minZ = pos.z
    }
    this.origin = { x: minX, y: minY, z: minZ }

    // Clone selected items into buffer with relative offsets
    for (const [key, entry] of byTile) {
      const tile = mapData.tiles.get(key)
      if (!tile || tile.items.length === 0) continue

      const copiedItems = tile.items
        .filter((_, i) => entry.indices.has(i))
        .map(deepCloneItem)

      if (copiedItems.length > 0) {
        const dx = entry.pos.x - minX
        const dy = entry.pos.y - minY
        const dz = entry.pos.z - minZ
        const offsetKey = `${dx},${dy},${dz}`
        this.tiles.set(offsetKey, { dx, dy, dz, items: copiedItems })
      }
    }
  }

  cut(
    selection: SelectedItemInfo[],
    mapData: OtbmMap,
    mutator: MapMutator,
    autoMagic: boolean,
  ): void {
    this.copy(selection, mapData)

    if (selection.length === 0) return

    mutator.beginBatch('Cut')

    const affectedPositions = removeSelectedItems(selection, mapData, mutator)

    // Auto-borderize neighbors of affected tiles
    if (autoMagic && affectedPositions.length > 0) {
      mutator.borderizeSelection(affectedPositions)
    }

    mutator.commitBatch()
  }

  paste(
    targetX: number,
    targetY: number,
    targetZ: number,
    mutator: MapMutator,
    renderer: { updateChunkIndex(tile: { x: number; y: number; z: number }): void },
    mergePaste: boolean,
    autoMagic: boolean,
  ): { x: number; y: number; z: number }[] {
    if (this.tiles.size === 0) return []

    mutator.beginBatch('Paste')

    const pastedPositions: { x: number; y: number; z: number }[] = []

    for (const t of this.tiles.values()) {
      const tx = targetX + t.dx
      const ty = targetY + t.dy
      const tz = targetZ + t.dz

      if (mergePaste) {
        mutator.mergePasteItems(tx, ty, tz, t.items)
      } else {
        mutator.setTileItems(tx, ty, tz, t.items.map(deepCloneItem))
      }

      const tile = mutator.getTile(tx, ty, tz)
      if (tile) renderer.updateChunkIndex(tile)
      pastedPositions.push({ x: tx, y: ty, z: tz })
    }

    // Auto-borderize pasted tiles
    if (autoMagic && pastedPositions.length > 0) {
      mutator.borderizeSelection(pastedPositions)
    }

    mutator.commitBatch()

    return pastedPositions
  }

  canPaste(): boolean {
    return this.tiles.size > 0
  }

  clear(): void {
    this.tiles.clear()
  }

  getTileCount(): number {
    return this.tiles.size
  }

  getOrigin(): { x: number; y: number; z: number } {
    return this.origin
  }

  getBounds(): { width: number; height: number; minDz: number; maxDz: number } {
    let maxDx = 0, maxDy = 0, minDz = 0, maxDz = 0
    for (const t of this.tiles.values()) {
      if (t.dx > maxDx) maxDx = t.dx
      if (t.dy > maxDy) maxDy = t.dy
      if (t.dz < minDz) minDz = t.dz
      if (t.dz > maxDz) maxDz = t.dz
    }
    return { width: maxDx + 1, height: maxDy + 1, minDz, maxDz }
  }

  getTiles(): IterableIterator<CopyBufferTile> {
    return this.tiles.values()
  }

  /** Get tiles filtered to a specific dz offset (for single-floor preview). */
  getTilesForFloor(dz: number): CopyBufferTile[] {
    const result: CopyBufferTile[] = []
    for (const t of this.tiles.values()) {
      if (t.dz === dz) result.push(t)
    }
    return result
  }

  serialize(): string {
    const data: SerializedCopyBuffer = {
      version: 1,
      origin: { ...this.origin },
      tiles: [...this.tiles.values()],
    }
    return JSON.stringify(data)
  }

  static deserialize(json: string): CopyBuffer {
    const data: SerializedCopyBuffer = JSON.parse(json)
    const buffer = new CopyBuffer()
    buffer.origin = { ...data.origin }
    for (const t of data.tiles) {
      const key = `${t.dx},${t.dy},${t.dz}`
      buffer.tiles.set(key, {
        dx: t.dx,
        dy: t.dy,
        dz: t.dz,
        items: t.items.map(deepCloneItem),
      })
    }
    return buffer
  }
}
