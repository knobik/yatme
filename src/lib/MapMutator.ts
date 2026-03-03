import type { OtbmMap, OtbmTile, OtbmItem } from './otbm'
import type { AppearanceData } from './appearances'

const CHUNK_SIZE = 32
const MAX_UNDO = 200

function tileKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

function chunkKeyForTile(x: number, y: number, z: number): string {
  return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)},${z}`
}

function deepCloneItem(item: OtbmItem): OtbmItem {
  const clone: OtbmItem = { id: item.id }
  if (item.count != null) clone.count = item.count
  if (item.actionId != null) clone.actionId = item.actionId
  if (item.uniqueId != null) clone.uniqueId = item.uniqueId
  if (item.text != null) clone.text = item.text
  if (item.description != null) clone.description = item.description
  if (item.teleportDestination) clone.teleportDestination = { ...item.teleportDestination }
  if (item.depotId != null) clone.depotId = item.depotId
  if (item.houseDoorId != null) clone.houseDoorId = item.houseDoorId
  if (item.charges != null) clone.charges = item.charges
  if (item.duration != null) clone.duration = item.duration
  if (item.items && item.items.length > 0) clone.items = item.items.map(deepCloneItem)
  return clone
}

function deepCloneItems(items: OtbmItem[]): OtbmItem[] {
  return items.map(deepCloneItem)
}

// Item draw-layer classification — matches MapRenderer.renderTile() logic
type DrawLayer = 'ground' | 'bottom' | 'common' | 'top'

function classifyItem(itemId: number, appearances: AppearanceData): DrawLayer {
  const appearance = appearances.objects.get(itemId)
  const flags = appearance?.flags
  if (flags?.bank) return 'ground'
  if (flags?.clip || flags?.bottom) return 'bottom'
  if (flags?.top) return 'top'
  return 'common'
}

// --- Mutation actions ---

type MutationAction =
  | { type: 'addItem'; x: number; y: number; z: number; item: OtbmItem; index: number }
  | { type: 'removeItem'; x: number; y: number; z: number; item: OtbmItem; index: number }
  | { type: 'setTileItems'; x: number; y: number; z: number; oldItems: OtbmItem[]; newItems: OtbmItem[] }
  | { type: 'createTile'; x: number; y: number; z: number }
  | { type: 'deleteTile'; x: number; y: number; z: number; tile: OtbmTile }

interface MutationBatch {
  description: string
  actions: MutationAction[]
  affectedChunks: Set<string>
}

export class MapMutator {
  private mapData: OtbmMap
  private appearances: AppearanceData
  private undoStack: MutationBatch[] = []
  private redoStack: MutationBatch[] = []

  // Current batch being built (between beginBatch/commitBatch)
  private currentBatch: MutationBatch | null = null

  // Callbacks
  onChunksInvalidated?: (keys: Set<string>) => void
  onUndoRedoChanged?: (canUndo: boolean, canRedo: boolean) => void
  onTileChanged?: (x: number, y: number, z: number) => void

  constructor(mapData: OtbmMap, appearances: AppearanceData) {
    this.mapData = mapData
    this.appearances = appearances
  }

  // --- Batch management ---

  beginBatch(description: string): void {
    this.currentBatch = { description, actions: [], affectedChunks: new Set() }
  }

  commitBatch(): void {
    if (!this.currentBatch || this.currentBatch.actions.length === 0) {
      this.currentBatch = null
      return
    }
    this.undoStack.push(this.currentBatch)
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift()
    this.redoStack.length = 0

    const chunks = this.currentBatch.affectedChunks
    this.currentBatch = null
    this.onChunksInvalidated?.(chunks)
    this.notifyUndoRedo()
  }

  private autoBatch(description: string, fn: () => void): void {
    const wasInBatch = this.currentBatch !== null
    if (!wasInBatch) this.beginBatch(description)
    fn()
    if (!wasInBatch) this.commitBatch()
  }

  private recordAction(action: MutationAction): void {
    if (!this.currentBatch) throw new Error('No active batch')
    this.currentBatch.actions.push(action)
    this.currentBatch.affectedChunks.add(chunkKeyForTile(action.x, action.y, action.z))
  }

  // --- Tile access ---

  getOrCreateTile(x: number, y: number, z: number): OtbmTile {
    const key = tileKey(x, y, z)
    let tile = this.mapData.tiles.get(key)
    if (!tile) {
      tile = { x, y, z, flags: 0, items: [] }
      this.mapData.tiles.set(key, tile)
      this.recordAction({ type: 'createTile', x, y, z })
    }
    return tile
  }

  getTile(x: number, y: number, z: number): OtbmTile | undefined {
    return this.mapData.tiles.get(tileKey(x, y, z))
  }

  // --- Core mutations ---

  addItem(x: number, y: number, z: number, item: OtbmItem): void {
    this.autoBatch('Place item', () => {
      const tile = this.getOrCreateTile(x, y, z)
      const layer = classifyItem(item.id, this.appearances)

      // Ground replacement: only one ground item per tile
      if (layer === 'ground') {
        const existingIdx = tile.items.findIndex(
          it => classifyItem(it.id, this.appearances) === 'ground'
        )
        if (existingIdx >= 0) {
          const old = tile.items[existingIdx]
          this.recordAction({ type: 'removeItem', x, y, z, item: deepCloneItem(old), index: existingIdx })
          tile.items.splice(existingIdx, 1)
        }
      }

      // Find correct insertion index based on layer order
      const index = this.findInsertIndex(tile, layer)
      tile.items.splice(index, 0, item)
      this.recordAction({ type: 'addItem', x, y, z, item: deepCloneItem(item), index })
      this.onTileChanged?.(x, y, z)
    })
  }

  removeItem(x: number, y: number, z: number, index: number): void {
    this.autoBatch('Remove item', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile || index < 0 || index >= tile.items.length) return
      const item = tile.items[index]
      this.recordAction({ type: 'removeItem', x, y, z, item: deepCloneItem(item), index })
      tile.items.splice(index, 1)
      this.onTileChanged?.(x, y, z)
    })
  }

  removeTopItem(x: number, y: number, z: number): void {
    this.autoBatch('Erase item', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile || tile.items.length === 0) return

      // Remove topmost non-ground item first; only remove ground if it's the last item
      let removeIdx = -1
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const layer = classifyItem(tile.items[i].id, this.appearances)
        if (layer !== 'ground') {
          removeIdx = i
          break
        }
      }
      if (removeIdx < 0) removeIdx = tile.items.length - 1 // fallback: remove ground

      const item = tile.items[removeIdx]
      this.recordAction({ type: 'removeItem', x, y, z, item: deepCloneItem(item), index: removeIdx })
      tile.items.splice(removeIdx, 1)
      this.onTileChanged?.(x, y, z)
    })
  }

  setTileItems(x: number, y: number, z: number, items: OtbmItem[]): void {
    this.autoBatch('Set tile items', () => {
      const tile = this.getOrCreateTile(x, y, z)
      const oldItems = deepCloneItems(tile.items)
      tile.items = items
      this.recordAction({ type: 'setTileItems', x, y, z, oldItems, newItems: deepCloneItems(items) })
      this.onTileChanged?.(x, y, z)
    })
  }

  // --- Undo / Redo ---

  canUndo(): boolean { return this.undoStack.length > 0 }
  canRedo(): boolean { return this.redoStack.length > 0 }

  undo(): void {
    const batch = this.undoStack.pop()
    if (!batch) return

    const affectedChunks = new Set<string>()
    // Apply actions in reverse
    for (let i = batch.actions.length - 1; i >= 0; i--) {
      const action = batch.actions[i]
      affectedChunks.add(chunkKeyForTile(action.x, action.y, action.z))
      this.applyInverse(action)
    }

    this.redoStack.push(batch)
    this.onChunksInvalidated?.(affectedChunks)
    this.notifyUndoRedo()
  }

  redo(): void {
    const batch = this.redoStack.pop()
    if (!batch) return

    const affectedChunks = new Set<string>()
    for (const action of batch.actions) {
      affectedChunks.add(chunkKeyForTile(action.x, action.y, action.z))
      this.applyForward(action)
    }

    this.undoStack.push(batch)
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift()
    this.onChunksInvalidated?.(affectedChunks)
    this.notifyUndoRedo()
  }

  private applyInverse(action: MutationAction): void {
    const key = tileKey(action.x, action.y, action.z)
    switch (action.type) {
      case 'addItem': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.items.splice(action.index, 1)
        break
      }
      case 'removeItem': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.items.splice(action.index, 0, deepCloneItem(action.item))
        break
      }
      case 'setTileItems': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.items = deepCloneItems(action.oldItems)
        break
      }
      case 'createTile': {
        this.mapData.tiles.delete(key)
        break
      }
      case 'deleteTile': {
        this.mapData.tiles.set(key, {
          x: action.tile.x, y: action.tile.y, z: action.tile.z,
          flags: action.tile.flags, houseId: action.tile.houseId,
          items: deepCloneItems(action.tile.items),
        })
        break
      }
    }
  }

  private applyForward(action: MutationAction): void {
    const key = tileKey(action.x, action.y, action.z)
    switch (action.type) {
      case 'addItem': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.items.splice(action.index, 0, deepCloneItem(action.item))
        break
      }
      case 'removeItem': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.items.splice(action.index, 1)
        break
      }
      case 'setTileItems': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.items = deepCloneItems(action.newItems)
        break
      }
      case 'createTile': {
        this.mapData.tiles.set(key, { x: action.x, y: action.y, z: action.z, flags: 0, items: [] })
        break
      }
      case 'deleteTile': {
        this.mapData.tiles.delete(key)
        break
      }
    }
  }

  // --- Helpers ---

  private findInsertIndex(tile: OtbmTile, layer: DrawLayer): number {
    // Layer order: ground → bottom → common → top
    // Insert at the end of the item's layer section
    const layerOrder: DrawLayer[] = ['ground', 'bottom', 'common', 'top']
    const targetOrder = layerOrder.indexOf(layer)

    for (let i = tile.items.length - 1; i >= 0; i--) {
      const itemLayer = classifyItem(tile.items[i].id, this.appearances)
      const itemOrder = layerOrder.indexOf(itemLayer)
      if (itemOrder <= targetOrder) return i + 1
    }
    return 0
  }

  private notifyUndoRedo(): void {
    this.onUndoRedoChanged?.(this.canUndo(), this.canRedo())
  }

  // Invalidate chunks during a batch (for live visual feedback while dragging)
  flushChunkUpdates(): void {
    if (this.currentBatch && this.currentBatch.affectedChunks.size > 0) {
      this.onChunksInvalidated?.(new Set(this.currentBatch.affectedChunks))
    }
  }
}
