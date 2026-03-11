import { type OtbmMap, type OtbmTile, type OtbmItem, type OtbmWaypoint, deepCloneItem, isPositionValid, tileKey } from './otbm'
import type { TileCreature } from './creatures/types'
import type { AppearanceData } from './appearances'
import type { MapSidecars } from './sidecars'
import { chunkKeyForTile } from './ChunkManager'
import type { GroundBrush } from './brushes/BrushTypes'
import type { WallBrush } from './brushes/WallTypes'
import type { CarpetBrush, TableBrush } from './brushes/CarpetTypes'
import type { DoodadBrush, DoodadAlternative, DoodadComposite } from './brushes/DoodadTypes'
import { CARPET_CENTER, TABLE_ALONE } from './brushes/CarpetTypes'
import type { BrushRegistry } from './brushes/BrushRegistry'
import type { ItemRegistry } from './items'
import type { SpawnManager } from './creatures/SpawnManager'
import type { CreatureDatabase } from './creatures/CreatureDatabase'
import { computeBorders } from './brushes/BorderSystem'
import { doWalls, getWallAlignment } from './brushes/WallSystem'
import { findDoorForAlignment, switchDoor } from './brushes/DoorSystem'
import { doCarpets, doTables } from './brushes/CarpetSystem'
import type { WaypointManager } from './WaypointManager'
const MAX_UNDO = 200

const OFFSETS_8: ReadonlyArray<[number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
]

const OFFSETS_4: ReadonlyArray<[number, number]> = [
  [0, -1], [-1, 0], [1, 0], [0, 1],
]

function deepCloneItems(items: OtbmItem[]): OtbmItem[] {
  return items.map(deepCloneItem)
}

// Item draw-layer classification — matches MapRenderer.renderTile() logic
export type DrawLayer = 'ground' | 'bottom' | 'common' | 'top'

export function classifyItem(itemId: number, appearances: AppearanceData): DrawLayer {
  const appearance = appearances.objects.get(itemId)
  const flags = appearance?.flags
  if (flags?.bank) return 'ground'
  if (flags?.clip || flags?.bottom) return 'bottom'
  if (flags?.top) return 'top'
  return 'common'
}

/** Returns true if the item has any special attributes (actionId, uniqueId, text, teleport, etc.) */
export function isComplexItem(item: OtbmItem): boolean {
  return !!(
    item.actionId || item.uniqueId || item.text || item.description ||
    item.teleportDestination || item.depotId || item.customAttributes || item.items?.length
  )
}

// --- Mutation actions ---

type MutationAction =
  | { type: 'addItem'; x: number; y: number; z: number; item: OtbmItem; index: number }
  | { type: 'removeItem'; x: number; y: number; z: number; item: OtbmItem; index: number }
  | { type: 'setTileItems'; x: number; y: number; z: number; oldItems: OtbmItem[]; newItems: OtbmItem[] }
  | { type: 'createTile'; x: number; y: number; z: number }
  | { type: 'deleteTile'; x: number; y: number; z: number; tile: OtbmTile }
  | { type: 'setTileFlags'; x: number; y: number; z: number; oldFlags: number; newFlags: number }
  | { type: 'setTileZones'; x: number; y: number; z: number; oldZones: number[]; newZones: number[] }
  | { type: 'setTileHouseId'; x: number; y: number; z: number; oldHouseId: number | undefined; newHouseId: number | undefined }
  | { type: 'addMonster'; x: number; y: number; z: number; creature: TileCreature; index: number }
  | { type: 'removeMonster'; x: number; y: number; z: number; creature: TileCreature; index: number }
  | { type: 'updateMonster'; x: number; y: number; z: number; oldCreature: TileCreature; newCreature: TileCreature; index: number }
  | { type: 'setNpc'; x: number; y: number; z: number; oldNpc: TileCreature | undefined; newNpc: TileCreature | undefined }
  | { type: 'setSpawnZone'; x: number; y: number; z: number; spawnType: 'monster' | 'npc'; oldRadius: number | undefined; newRadius: number | undefined }
  | { type: 'addWaypoint'; x: number; y: number; z: number; waypoint: OtbmWaypoint }
  | { type: 'removeWaypoint'; x: number; y: number; z: number; waypoint: OtbmWaypoint }
  | { type: 'renameWaypoint'; x: number; y: number; z: number; oldName: string; newName: string }
  | { type: 'moveWaypoint'; x: number; y: number; z: number; name: string; oldX: number; oldY: number; oldZ: number; newX: number; newY: number; newZ: number }

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
  private _brushRegistry: BrushRegistry | null = null
  private _itemRegistry: ItemRegistry | null = null
  private _sidecars: MapSidecars | null = null
  private _spawnManager: SpawnManager | null = null
  private _creatureDb: CreatureDatabase | null = null
  private _waypointManager: WaypointManager | null = null

  // Current batch being built (between beginBatch/commitBatch)
  private currentBatch: MutationBatch | null = null

  // Callbacks
  onChunksInvalidated?: (keys: Set<string>) => void
  onUndoRedoChanged?: (canUndo: boolean, canRedo: boolean) => void
  onTileChanged?: (x: number, y: number, z: number) => void
  onWaypointChanged?: () => void

  constructor(mapData: OtbmMap, appearances: AppearanceData) {
    this.mapData = mapData
    this.appearances = appearances
  }

  getAppearances(): AppearanceData {
    return this.appearances
  }

  set brushRegistry(registry: BrushRegistry | null) {
    this._brushRegistry = registry
  }

  get brushRegistry(): BrushRegistry | null {
    return this._brushRegistry
  }

  set itemRegistry(registry: ItemRegistry | null) {
    this._itemRegistry = registry
  }

  get itemRegistry(): ItemRegistry | null {
    return this._itemRegistry
  }

  set sidecars(sidecars: MapSidecars | null) {
    this._sidecars = sidecars
  }

  get sidecars(): MapSidecars | null {
    return this._sidecars
  }

  set spawnManager(manager: SpawnManager | null) {
    this._spawnManager = manager
  }

  get spawnManager(): SpawnManager | null {
    return this._spawnManager
  }

  set creatureDb(db: CreatureDatabase | null) {
    this._creatureDb = db
  }

  get creatureDb(): CreatureDatabase | null {
    return this._creatureDb
  }

  set waypointManager(manager: WaypointManager | null) {
    this._waypointManager = manager
  }

  get waypointManager(): WaypointManager | null {
    return this._waypointManager
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

  getOrCreateTile(x: number, y: number, z: number): OtbmTile | undefined {
    if (!isPositionValid(x, y, z)) return undefined
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
      if (!tile) return
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
      if (!tile) return
      const oldItems = deepCloneItems(tile.items)
      tile.items = items
      this.recordAction({ type: 'setTileItems', x, y, z, oldItems, newItems: deepCloneItems(items) })
      this.onTileChanged?.(x, y, z)
    })
  }

  /** RME-style paste merge: replace ground if pasted tile has one, append non-ground items. */
  mergePasteItems(x: number, y: number, z: number, pasteItems: OtbmItem[]): void {
    this.autoBatch('Paste', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return
      const oldItems = deepCloneItems(tile.items)

      // Classify each pasted item once
      const classified = pasteItems.map(item => ({ item, layer: classifyItem(item.id, this.appearances) }))
      const pasteGround = classified.find(c => c.layer === 'ground')

      if (pasteGround) {
        // Replace existing ground with pasted ground
        const groundIdx = tile.items.findIndex(it => classifyItem(it.id, this.appearances) === 'ground')
        if (groundIdx >= 0) {
          tile.items[groundIdx] = deepCloneItem(pasteGround.item)
        } else {
          tile.items.splice(0, 0, deepCloneItem(pasteGround.item))
        }
      }

      // Append all non-ground items using proper layer insertion
      for (const { item, layer } of classified) {
        if (layer === 'ground') continue
        const index = this.findInsertIndex(tile, layer)
        tile.items.splice(index, 0, deepCloneItem(item))
      }

      this.recordAction({ type: 'setTileItems', x, y, z, oldItems, newItems: deepCloneItems(tile.items) })
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
      case 'setTileFlags': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.flags = action.oldFlags
        break
      }
      case 'setTileZones': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.zones = action.oldZones.length > 0 ? [...action.oldZones] : undefined
        break
      }
      case 'setTileHouseId': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          if (action.oldHouseId != null) tile.houseId = action.oldHouseId
          else delete tile.houseId
        }
        break
      }
      case 'addMonster': {
        const tile = this.mapData.tiles.get(key)
        if (tile?.monsters) tile.monsters.splice(action.index, 1)
        break
      }
      case 'removeMonster': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          if (!tile.monsters) tile.monsters = []
          tile.monsters.splice(action.index, 0, { ...action.creature })
        }
        break
      }
      case 'updateMonster': {
        const tile = this.mapData.tiles.get(key)
        if (tile?.monsters) tile.monsters[action.index] = { ...action.oldCreature }
        break
      }
      case 'setNpc': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          if (action.oldNpc) tile.npc = { ...action.oldNpc }
          else delete tile.npc
        }
        break
      }
      case 'setSpawnZone': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          this.applySpawnZone(tile, action.spawnType, action.newRadius, action.oldRadius)
        }
        break
      }
      case 'addWaypoint': {
        this._waypointManager?.remove(action.waypoint.name)
        this.removeWaypointFromMapData(action.waypoint.name)
        this.onWaypointChanged?.()
        break
      }
      case 'removeWaypoint': {
        this._waypointManager?.add({ ...action.waypoint })
        this.mapData.waypoints.push({ ...action.waypoint })
        this.onWaypointChanged?.()
        break
      }
      case 'renameWaypoint': {
        this._waypointManager?.rename(action.newName, action.oldName)
        const wp = this.mapData.waypoints.find(w => w.name === action.newName)
        if (wp) wp.name = action.oldName
        this.onWaypointChanged?.()
        break
      }
      case 'moveWaypoint': {
        this._waypointManager?.move(action.name, action.oldX, action.oldY, action.oldZ)
        const wp = this.mapData.waypoints.find(w => w.name === action.name)
        if (wp) { wp.x = action.oldX; wp.y = action.oldY; wp.z = action.oldZ }
        this.onWaypointChanged?.()
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
      case 'setTileFlags': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.flags = action.newFlags
        break
      }
      case 'setTileZones': {
        const tile = this.mapData.tiles.get(key)
        if (tile) tile.zones = action.newZones.length > 0 ? [...action.newZones] : undefined
        break
      }
      case 'setTileHouseId': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          if (action.newHouseId != null) tile.houseId = action.newHouseId
          else delete tile.houseId
        }
        break
      }
      case 'addMonster': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          if (!tile.monsters) tile.monsters = []
          tile.monsters.splice(action.index, 0, { ...action.creature })
        }
        break
      }
      case 'removeMonster': {
        const tile = this.mapData.tiles.get(key)
        if (tile?.monsters) tile.monsters.splice(action.index, 1)
        break
      }
      case 'updateMonster': {
        const tile = this.mapData.tiles.get(key)
        if (tile?.monsters) tile.monsters[action.index] = { ...action.newCreature }
        break
      }
      case 'setNpc': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          if (action.newNpc) tile.npc = { ...action.newNpc }
          else delete tile.npc
        }
        break
      }
      case 'setSpawnZone': {
        const tile = this.mapData.tiles.get(key)
        if (tile) {
          this.applySpawnZone(tile, action.spawnType, action.oldRadius, action.newRadius)
        }
        break
      }
      case 'addWaypoint': {
        this._waypointManager?.add({ ...action.waypoint })
        this.mapData.waypoints.push({ ...action.waypoint })
        this.onWaypointChanged?.()
        break
      }
      case 'removeWaypoint': {
        this._waypointManager?.remove(action.waypoint.name)
        this.removeWaypointFromMapData(action.waypoint.name)
        this.onWaypointChanged?.()
        break
      }
      case 'renameWaypoint': {
        this._waypointManager?.rename(action.oldName, action.newName)
        const wp = this.mapData.waypoints.find(w => w.name === action.oldName)
        if (wp) wp.name = action.newName
        this.onWaypointChanged?.()
        break
      }
      case 'moveWaypoint': {
        this._waypointManager?.move(action.name, action.newX, action.newY, action.newZ)
        const wp = this.mapData.waypoints.find(w => w.name === action.name)
        if (wp) { wp.x = action.newX; wp.y = action.newY; wp.z = action.newZ }
        this.onWaypointChanged?.()
        break
      }
    }
  }

  private applySpawnZone(tile: OtbmTile, spawnType: 'monster' | 'npc', removeRadius: number | undefined, addRadius: number | undefined): void {
    const sm = this._spawnManager
    if (spawnType === 'monster') {
      if (removeRadius != null) sm?.removeMonsterSpawn(tile.x, tile.y, tile.z, removeRadius)
      if (addRadius != null) {
        tile.spawnMonster = { radius: addRadius }
        sm?.addMonsterSpawn(tile.x, tile.y, tile.z, addRadius)
      } else {
        delete tile.spawnMonster
      }
    } else {
      if (removeRadius != null) sm?.removeNpcSpawn(tile.x, tile.y, tile.z, removeRadius)
      if (addRadius != null) {
        tile.spawnNpc = { radius: addRadius }
        sm?.addNpcSpawn(tile.x, tile.y, tile.z, addRadius)
      } else {
        delete tile.spawnNpc
      }
    }
  }

  // --- Flag & zone mutations ---

  setTileFlag(x: number, y: number, z: number, flag: number): void {
    this.autoBatch('Set tile flag', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return
      const oldFlags = tile.flags
      const newFlags = oldFlags | flag
      if (oldFlags === newFlags) return
      tile.flags = newFlags
      this.recordAction({ type: 'setTileFlags', x, y, z, oldFlags, newFlags })
      this.onTileChanged?.(x, y, z)
    })
  }

  clearTileFlag(x: number, y: number, z: number, flag: number): void {
    this.autoBatch('Clear tile flag', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return
      const oldFlags = tile.flags
      const newFlags = oldFlags & ~flag
      if (oldFlags === newFlags) return
      tile.flags = newFlags
      this.recordAction({ type: 'setTileFlags', x, y, z, oldFlags, newFlags })
      this.onTileChanged?.(x, y, z)
    })
  }

  addTileZone(x: number, y: number, z: number, zoneId: number): void {
    this.autoBatch('Add tile zone', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return
      const oldZones = tile.zones ? [...tile.zones] : []
      if (oldZones.includes(zoneId)) return
      const newZones = [...oldZones, zoneId]
      tile.zones = newZones
      this.recordAction({ type: 'setTileZones', x, y, z, oldZones, newZones })
      this.onTileChanged?.(x, y, z)
    })
  }

  removeTileZone(x: number, y: number, z: number, zoneId: number): void {
    this.autoBatch('Remove tile zone', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return
      const oldZones = tile.zones ? [...tile.zones] : []
      if (!oldZones.includes(zoneId)) return
      const newZones = oldZones.filter(id => id !== zoneId)
      tile.zones = newZones.length > 0 ? newZones : undefined
      this.recordAction({ type: 'setTileZones', x, y, z, oldZones, newZones })
      this.onTileChanged?.(x, y, z)
    })
  }

  // --- House ID mutations ---

  setTileHouseId(x: number, y: number, z: number, houseId: number): void {
    this.autoBatch('Set house ID', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return
      const oldHouseId = tile.houseId
      if (oldHouseId === houseId) return
      tile.houseId = houseId
      // Set PZ flag per RME convention
      const oldFlags = tile.flags
      const newFlags = oldFlags | 0x0001
      if (oldFlags !== newFlags) {
        tile.flags = newFlags
        this.recordAction({ type: 'setTileFlags', x, y, z, oldFlags, newFlags })
      }
      this.recordAction({ type: 'setTileHouseId', x, y, z, oldHouseId, newHouseId: houseId })
      this.onTileChanged?.(x, y, z)
    })
  }

  clearTileHouseId(x: number, y: number, z: number): void {
    this.autoBatch('Clear house ID', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile || tile.houseId == null) return
      const oldHouseId = tile.houseId
      delete tile.houseId
      // Clear PZ flag
      const oldFlags = tile.flags
      const newFlags = oldFlags & ~0x0001
      if (oldFlags !== newFlags) {
        tile.flags = newFlags
        this.recordAction({ type: 'setTileFlags', x, y, z, oldFlags, newFlags })
      }
      this.recordAction({ type: 'setTileHouseId', x, y, z, oldHouseId, newHouseId: undefined })
      this.onTileChanged?.(x, y, z)
    })
  }

  // --- Creature mutations ---

  placeCreature(x: number, y: number, z: number, creature: TileCreature): void {
    this.autoBatch('Place creature', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return

      if (creature.isNpc) {
        const oldNpc = tile.npc ? { ...tile.npc } : undefined
        tile.npc = { ...creature }
        this.recordAction({ type: 'setNpc', x, y, z, oldNpc, newNpc: { ...creature } })
      } else {
        if (!tile.monsters) tile.monsters = []
        if (tile.monsters.some(m => m.name === creature.name)) return
        const index = tile.monsters.length
        tile.monsters.push({ ...creature })
        this.recordAction({ type: 'addMonster', x, y, z, creature: { ...creature }, index })
      }
      this.onTileChanged?.(x, y, z)
    })
  }

  removeCreature(x: number, y: number, z: number, creatureName: string, isNpc: boolean): void {
    this.autoBatch('Remove creature', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      if (isNpc) {
        if (!tile.npc) return
        const oldNpc = { ...tile.npc }
        delete tile.npc
        this.recordAction({ type: 'setNpc', x, y, z, oldNpc, newNpc: undefined })
      } else {
        if (!tile.monsters) return
        const index = tile.monsters.findIndex(m => m.name === creatureName)
        if (index < 0) return
        const creature = { ...tile.monsters[index] }
        tile.monsters.splice(index, 1)
        this.recordAction({ type: 'removeMonster', x, y, z, creature, index })
      }
      this.onTileChanged?.(x, y, z)
    })
  }

  moveCreature(fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number, creatureName: string, isNpc: boolean): void {
    this.autoBatch('Move creature', () => {
      const fromTile = this.mapData.tiles.get(tileKey(fromX, fromY, fromZ))
      if (!fromTile) return

      let creature: TileCreature | undefined
      if (isNpc) {
        creature = fromTile.npc
      } else {
        creature = fromTile.monsters?.find(m => m.name === creatureName)
      }
      if (!creature) return

      const creatureCopy = { ...creature }
      this.removeCreature(fromX, fromY, fromZ, creatureName, isNpc)
      this.placeCreature(toX, toY, toZ, creatureCopy)
    })
  }

  updateCreatureProperties(x: number, y: number, z: number, creatureName: string, isNpc: boolean, props: Partial<TileCreature>): void {
    this.autoBatch('Update creature', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      if (isNpc) {
        if (!tile.npc) return
        const oldNpc = { ...tile.npc }
        const newNpc = { ...oldNpc, ...props }
        tile.npc = newNpc
        this.recordAction({ type: 'setNpc', x, y, z, oldNpc, newNpc: { ...newNpc } })
      } else {
        if (!tile.monsters) return
        const index = tile.monsters.findIndex(m => m.name === creatureName)
        if (index < 0) return
        const oldCreature = { ...tile.monsters[index] }
        const newCreature = { ...oldCreature, ...props }
        tile.monsters[index] = newCreature
        this.recordAction({ type: 'updateMonster', x, y, z, oldCreature, newCreature: { ...newCreature }, index })
      }
      this.onTileChanged?.(x, y, z)
    })
  }

  // --- Spawn zone mutations ---

  placeSpawnZone(x: number, y: number, z: number, type: 'monster' | 'npc', radius: number): void {
    this.autoBatch('Place spawn zone', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return

      const existing = type === 'monster' ? tile.spawnMonster : tile.spawnNpc
      if (existing) return // already has spawn of this type

      this.applySpawnZone(tile, type, undefined, radius)
      this.recordAction({ type: 'setSpawnZone', x, y, z, spawnType: type, oldRadius: undefined, newRadius: radius })
      this.onTileChanged?.(x, y, z)
    })
  }

  removeSpawnZone(x: number, y: number, z: number, type: 'monster' | 'npc'): void {
    this.autoBatch('Remove spawn zone', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      const existing = type === 'monster' ? tile.spawnMonster : tile.spawnNpc
      if (!existing) return

      const oldRadius = existing.radius
      this.applySpawnZone(tile, type, oldRadius, undefined)
      this.recordAction({ type: 'setSpawnZone', x, y, z, spawnType: type, oldRadius, newRadius: undefined })
      this.onTileChanged?.(x, y, z)
    })
  }

  updateSpawnRadius(x: number, y: number, z: number, type: 'monster' | 'npc', newRadius: number): void {
    this.autoBatch('Update spawn radius', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      const existing = type === 'monster' ? tile.spawnMonster : tile.spawnNpc
      if (!existing) return

      const oldRadius = existing.radius
      if (oldRadius === newRadius) return

      this.applySpawnZone(tile, type, oldRadius, newRadius)
      this.recordAction({ type: 'setSpawnZone', x, y, z, spawnType: type, oldRadius, newRadius })
      this.onTileChanged?.(x, y, z)
    })
  }

  // --- Waypoint mutations ---

  addWaypoint(name: string, x: number, y: number, z: number): void {
    if (!this._waypointManager) return
    const waypoint: OtbmWaypoint = { name, x, y, z }
    this.autoBatch('Add waypoint', () => {
      this._waypointManager!.add(waypoint)
      this.mapData.waypoints.push({ ...waypoint })
      this.recordWaypointAction({ type: 'addWaypoint', x, y, z, waypoint: { ...waypoint } })
      this.onWaypointChanged?.()
    })
  }

  removeWaypoint(name: string): void {
    if (!this._waypointManager) return
    const wp = this._waypointManager.getByName(name)
    if (!wp) return
    this.autoBatch('Remove waypoint', () => {
      const removed = this._waypointManager!.remove(name)
      if (!removed) return
      this.removeWaypointFromMapData(name)
      this.recordWaypointAction({ type: 'removeWaypoint', x: removed.x, y: removed.y, z: removed.z, waypoint: { ...removed } })
      this.onWaypointChanged?.()
    })
  }

  renameWaypoint(oldName: string, newName: string): void {
    if (!this._waypointManager || oldName === newName) return
    const wp = this._waypointManager.getByName(oldName)
    if (!wp) return
    this.autoBatch('Rename waypoint', () => {
      this._waypointManager!.rename(oldName, newName)
      const mapWp = this.mapData.waypoints.find(w => w.name === oldName)
      if (mapWp) mapWp.name = newName
      this.recordWaypointAction({ type: 'renameWaypoint', x: wp.x, y: wp.y, z: wp.z, oldName, newName })
      this.onWaypointChanged?.()
    })
  }

  moveWaypoint(name: string, newX: number, newY: number, newZ: number): void {
    if (!this._waypointManager) return
    const wp = this._waypointManager.getByName(name)
    if (!wp) return
    const oldX = wp.x, oldY = wp.y, oldZ = wp.z
    if (oldX === newX && oldY === newY && oldZ === newZ) return
    this.autoBatch('Move waypoint', () => {
      this._waypointManager!.move(name, newX, newY, newZ)
      const mapWp = this.mapData.waypoints.find(w => w.name === name)
      if (mapWp) { mapWp.x = newX; mapWp.y = newY; mapWp.z = newZ }
      this.recordWaypointAction({ type: 'moveWaypoint', x: newX, y: newY, z: newZ, name, oldX, oldY, oldZ, newX, newY, newZ })
      this.onWaypointChanged?.()
    })
  }

  private recordWaypointAction(action: MutationAction): void {
    if (!this.currentBatch) throw new Error('No active batch')
    this.currentBatch.actions.push(action)
    // Waypoints don't invalidate tile chunks — overlay refresh is via onWaypointChanged
  }

  private removeWaypointFromMapData(name: string): void {
    const idx = this.mapData.waypoints.findIndex(w => w.name === name)
    if (idx >= 0) this.mapData.waypoints.splice(idx, 1)
  }

  // --- Ground brush painting ---

  paintGround(x: number, y: number, z: number, brush: GroundBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Paint ground', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      // Replace ground item on center tile
      const groundItemId = registry.pickRandomItem(brush)
      if (!groundItemId) return
      const groundIdx = tile.items.findIndex(
        it => classifyItem(it.id, this.appearances) === 'ground'
      )
      if (groundIdx >= 0) {
        tile.items.splice(groundIdx, 1)
      }
      tile.items.splice(0, 0, { id: groundItemId })

      // Recompute borders for center tile
      this.removeBorderItems(tile, registry)
      const centerBorders = computeBorders(x, y, z, this.mapData, registry)
      this.insertBorderItems(tile, centerBorders)

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      // Recompute borders for 8 neighbors
      this.reborderNeighbors(x, y, z)
    })
  }

  eraseGround(x: number, y: number, z: number, brush: GroundBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Erase ground', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      // Remove ground item belonging to this brush
      const groundIdx = tile.items.findIndex(
        it => classifyItem(it.id, this.appearances) === 'ground' && registry.getBrushForItem(it.id)?.id === brush.id
      )
      if (groundIdx < 0) return
      tile.items.splice(groundIdx, 1)

      // Recompute borders for center tile
      this.removeBorderItems(tile, registry)
      const centerBorders = computeBorders(x, y, z, this.mapData, registry)
      this.insertBorderItems(tile, centerBorders)

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      // Recompute borders for 8 neighbors
      this.reborderNeighbors(x, y, z)
    })
  }

  // --- Wall brush painting ---

  paintWall(x: number, y: number, z: number, brush: WallBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Paint wall', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      // Remove existing wall items from the SAME brush on this tile
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const wb = registry.getWallBrushForItem(tile.items[i].id)
        if (wb && wb.id === brush.id) {
          tile.items.splice(i, 1)
        }
      }

      // Add a placeholder wall item (pole/first available) — doWalls() will fix alignment
      let placeholderId = 0
      for (const node of brush.wallItems) {
        if (node.items.length > 0) {
          placeholderId = node.items[0].id
          break
        }
      }
      if (!placeholderId) return

      const layer = classifyItem(placeholderId, this.appearances)
      const index = this.findInsertIndex(tile, layer)
      tile.items.splice(index, 0, { id: placeholderId })

      // Run doWalls() on center tile to get correctly aligned wall items
      const alignedWalls = doWalls(x, y, z, this.mapData, registry)
      this.replaceWallItems(tile, alignedWalls, registry)

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      // Update 4 cardinal neighbors
      this.realignWallNeighbors(x, y, z)
    })
  }

  eraseWall(x: number, y: number, z: number, brush: WallBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Erase wall', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      // Remove existing wall items from the SAME brush on this tile
      let removed = false
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const wb = registry.getWallBrushForItem(tile.items[i].id)
        if (wb && wb.id === brush.id) {
          tile.items.splice(i, 1)
          removed = true
        }
      }
      if (!removed) return

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      // Update 4 cardinal neighbors
      this.realignWallNeighbors(x, y, z)
    })
  }

  // --- Door brush painting ---

  paintDoor(x: number, y: number, z: number, doorType: number): void {
    const registry = this._brushRegistry!
    this.autoBatch('Place door', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      // Find the first wall item on this tile
      let wallIdx = -1
      let wallBrush: WallBrush | null = null
      for (let i = 0; i < tile.items.length; i++) {
        const wb = registry.getWallBrushForItem(tile.items[i].id)
        if (wb) {
          wallIdx = i
          wallBrush = wb
          break
        }
      }
      if (wallIdx < 0 || !wallBrush) return // no wall on tile

      // Get current wall alignment
      const alignment = getWallAlignment(wallBrush, tile.items[wallIdx].id)
      if (alignment < 0) return

      // Find door item for this alignment and type (default closed)
      const doorId = findDoorForAlignment(wallBrush, alignment, doorType, false)
      if (!doorId) return // no door defined for this alignment

      // Replace wall item with door item
      const oldItems = deepCloneItems(tile.items)
      tile.items[wallIdx] = { id: doorId }

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      // Re-align 4 cardinal neighbors (door is a wall item, neighbors should adjust)
      this.updateNeighborTiles(x, y, z, OFFSETS_4, {
        filter: (tile) => tile.items.some(item => registry.isWallItem(item.id)),
        update: (tile, nx, ny) => {
          const neighborWalls = doWalls(nx, ny, z, this.mapData, registry)
          this.replaceWallItems(tile, neighborWalls, registry)
        },
      })
    })
  }

  private replaceItemId(
    label: string, x: number, y: number, z: number, itemIndex: number,
    resolveNewId: (itemId: number) => number | undefined,
  ): void {
    this.autoBatch(label, () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile || tile.items.length === 0) return
      const idx = itemIndex < 0 ? tile.items.length - 1 : itemIndex
      if (idx >= tile.items.length) return

      const newId = resolveNewId(tile.items[idx].id)
      if (!newId || newId === tile.items[idx].id) return

      const oldItems = deepCloneItems(tile.items)
      tile.items[idx] = { ...tile.items[idx], id: newId }

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)
    })
  }

  switchDoorItem(x: number, y: number, z: number, itemIndex: number): void {
    const registry = this._brushRegistry!
    this.replaceItemId('Switch door', x, y, z, itemIndex, (id) => switchDoor(id, registry))
  }

  rotateItem(x: number, y: number, z: number, itemIndex: number): void {
    if (!this._itemRegistry) return
    this.replaceItemId('Rotate item', x, y, z, itemIndex, (id) => this._itemRegistry!.get(id)?.rotateTo)
  }

  // --- Carpet brush painting ---

  paintCarpet(x: number, y: number, z: number, brush: CarpetBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Paint carpet', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      // Remove existing carpet items from the SAME brush on this tile
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const cb = registry.getCarpetBrushForItem(tile.items[i].id)
        if (cb && cb.id === brush.id) {
          tile.items.splice(i, 1)
        }
      }

      // Pick a center item as placeholder — doCarpets() will fix alignment
      let placeholderId = 0
      const centerNode = brush.carpetItems[CARPET_CENTER]
      if (centerNode.items.length > 0) {
        placeholderId = centerNode.items[0].id
      } else {
        for (const node of brush.carpetItems) {
          if (node.items.length > 0) { placeholderId = node.items[0].id; break }
        }
      }
      if (!placeholderId) return

      const layer = classifyItem(placeholderId, this.appearances)
      const index = this.findInsertIndex(tile, layer)
      tile.items.splice(index, 0, { id: placeholderId })

      const alignedCarpets = doCarpets(x, y, z, this.mapData, registry)
      this.replaceBrushItems(tile, alignedCarpets, registry, 'carpet')

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      this.updateNeighborBrush(x, y, z, registry, 'carpet')
    })
  }

  eraseCarpet(x: number, y: number, z: number, brush: CarpetBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Erase carpet', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      let removed = false
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const cb = registry.getCarpetBrushForItem(tile.items[i].id)
        if (cb && cb.id === brush.id) {
          tile.items.splice(i, 1)
          removed = true
        }
      }
      if (!removed) return

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      this.updateNeighborBrush(x, y, z, registry, 'carpet')
    })
  }

  // --- Table brush painting ---

  paintTable(x: number, y: number, z: number, brush: TableBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Paint table', () => {
      const tile = this.getOrCreateTile(x, y, z)
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      // Remove existing table items from the SAME brush on this tile
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const tb = registry.getTableBrushForItem(tile.items[i].id)
        if (tb && tb.id === brush.id) {
          tile.items.splice(i, 1)
        }
      }

      let placeholderId = 0
      const aloneNode = brush.tableItems[TABLE_ALONE]
      if (aloneNode.items.length > 0) {
        placeholderId = aloneNode.items[0].id
      } else {
        for (const node of brush.tableItems) {
          if (node.items.length > 0) { placeholderId = node.items[0].id; break }
        }
      }
      if (!placeholderId) return

      const layer = classifyItem(placeholderId, this.appearances)
      const index = this.findInsertIndex(tile, layer)
      tile.items.splice(index, 0, { id: placeholderId })

      const alignedTables = doTables(x, y, z, this.mapData, registry)
      this.replaceBrushItems(tile, alignedTables, registry, 'table')

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      this.updateNeighborBrush(x, y, z, registry, 'table')
    })
  }

  eraseTable(x: number, y: number, z: number, brush: TableBrush): void {
    const registry = this._brushRegistry!
    this.autoBatch('Erase table', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      let removed = false
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const tb = registry.getTableBrushForItem(tile.items[i].id)
        if (tb && tb.id === brush.id) {
          tile.items.splice(i, 1)
          removed = true
        }
      }
      if (!removed) return

      this.recordAction({
        type: 'setTileItems', x, y, z,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(x, y, z)

      this.updateNeighborBrush(x, y, z, registry, 'table')
    })
  }

  // --- Doodad brush painting ---

  paintDoodad(x: number, y: number, z: number, brush: DoodadBrush): void {
    if (!this._brushRegistry) return
    // Select alternative (use first for v1; alternatives provide variation groups)
    const alt = brush.alternatives[0]
    if (!alt || alt.totalChance === 0) return

    // Pre-clean: remove old doodad items from ALL possible composite tile positions
    // so that switching between composite variants doesn't leave orphaned items
    if (!brush.onDuplicate) {
      this.cleanDoodadTiles(x, y, z, alt, brush)
    }

    // Weighted random: composites and singles compete in the same pool
    let roll = Math.random() * alt.totalChance
    for (const comp of alt.composites) {
      roll -= comp.chance
      if (roll < 0) {
        this.placeDoodadComposite(x, y, z, comp)
        return
      }
    }
    for (const single of alt.singles) {
      roll -= single.chance
      if (roll < 0) {
        this.placeDoodadSingle(x, y, z, single.itemId)
        return
      }
    }
    // Fallback: place last single
    if (alt.singles.length > 0) {
      this.placeDoodadSingle(x, y, z, alt.singles[alt.singles.length - 1].itemId)
    }
  }

  // Remove doodad items from all tiles that any composite in this alternative could cover
  private cleanDoodadTiles(
    x: number, y: number, z: number,
    alt: DoodadAlternative,
    brush: DoodadBrush,
  ): void {
    const registry = this._brushRegistry!
    // Collect all unique tile offsets across all composites + the center tile
    const offsets = new Set<string>()
    offsets.add('0,0,0')
    for (const comp of alt.composites) {
      for (const ct of comp.tiles) {
        offsets.add(`${ct.dx},${ct.dy},${ct.dz}`)
      }
    }

    for (const key of offsets) {
      const [dx, dy, dz] = key.split(',').map(Number)
      const tx = x + dx
      const ty = y + dy
      const tz = z + dz
      const tile = this.mapData.tiles.get(tileKey(tx, ty, tz))
      if (!tile) continue

      const oldItems = deepCloneItems(tile.items)
      for (let i = tile.items.length - 1; i >= 0; i--) {
        const db = registry.getDoodadBrushForItem(tile.items[i].id)
        if (db && db.id === brush.id) {
          tile.items.splice(i, 1)
        }
      }

      if (!this.itemsEqual(oldItems, tile.items)) {
        this.recordAction({
          type: 'setTileItems', x: tx, y: ty, z: tz,
          oldItems,
          newItems: deepCloneItems(tile.items),
        })
        this.onTileChanged?.(tx, ty, tz)
      }
    }
  }

  private placeDoodadSingle(
    x: number, y: number, z: number,
    itemId: number,
  ): void {
    const tile = this.getOrCreateTile(x, y, z)
    if (!tile) return
    const oldItems = deepCloneItems(tile.items)

    const layer = classifyItem(itemId, this.appearances)
    const index = this.findInsertIndex(tile, layer)
    tile.items.splice(index, 0, { id: itemId })

    this.recordAction({
      type: 'setTileItems', x, y, z,
      oldItems,
      newItems: deepCloneItems(tile.items),
    })
    this.onTileChanged?.(x, y, z)
  }

  private placeDoodadComposite(
    x: number, y: number, z: number,
    composite: DoodadComposite,
  ): void {
    for (const compTile of composite.tiles) {
      const tx = x + compTile.dx
      const ty = y + compTile.dy
      const tz = z + compTile.dz

      const tile = this.getOrCreateTile(tx, ty, tz)
      if (!tile) continue
      const oldItems = deepCloneItems(tile.items)

      for (const itemId of compTile.itemIds) {
        const layer = classifyItem(itemId, this.appearances)
        const index = this.findInsertIndex(tile, layer)
        tile.items.splice(index, 0, { id: itemId })
      }

      this.recordAction({
        type: 'setTileItems', x: tx, y: ty, z: tz,
        oldItems,
        newItems: deepCloneItems(tile.items),
      })
      this.onTileChanged?.(tx, ty, tz)
    }
  }

  /** Recompute auto-borders for all tiles at the given positions (and their neighbors). */
  borderizeSelection(positions: { x: number; y: number; z: number }[]): void {
    const registry = this._brushRegistry
    if (!registry || positions.length === 0) return

    this.autoBatch('Borderize selection', () => {
      // Collect unique tile keys for the selection AND their 8-neighbors
      const tilesToUpdate = new Map<string, { x: number; y: number; z: number }>()
      for (const pos of positions) {
        const key = tileKey(pos.x, pos.y, pos.z)
        if (!tilesToUpdate.has(key)) tilesToUpdate.set(key, pos)
        for (const [dx, dy] of OFFSETS_8) {
          const nx = pos.x + dx
          const ny = pos.y + dy
          if (nx < 0 || ny < 0) continue
          const nk = tileKey(nx, ny, pos.z)
          if (!tilesToUpdate.has(nk)) tilesToUpdate.set(nk, { x: nx, y: ny, z: pos.z })
        }
      }

      for (const pos of tilesToUpdate.values()) {
        const tile = this.mapData.tiles.get(tileKey(pos.x, pos.y, pos.z))
        if (!tile) continue

        // Only borderize tiles that have a ground item
        const hasGround = tile.items.some(it => classifyItem(it.id, this.appearances) === 'ground')
        if (!hasGround) continue

        const oldItems = deepCloneItems(tile.items)
        this.removeBorderItems(tile, registry)
        const newBorders = computeBorders(pos.x, pos.y, pos.z, this.mapData, registry)
        this.insertBorderItems(tile, newBorders)

        if (!this.itemsEqual(oldItems, tile.items)) {
          this.recordAction({
            type: 'setTileItems',
            x: pos.x, y: pos.y, z: pos.z,
            oldItems,
            newItems: deepCloneItems(tile.items),
          })
          this.onTileChanged?.(pos.x, pos.y, pos.z)
        }
      }
    })
  }

  /** Randomize ground tile variations within the given positions. */
  randomizeSelection(positions: { x: number; y: number; z: number }[]): void {
    const registry = this._brushRegistry
    if (!registry || positions.length === 0) return

    this.autoBatch('Randomize selection', () => {
      for (const pos of positions) {
        const tile = this.mapData.tiles.get(tileKey(pos.x, pos.y, pos.z))
        if (!tile) continue

        // Find ground item
        const groundIdx = tile.items.findIndex(
          it => classifyItem(it.id, this.appearances) === 'ground'
        )
        if (groundIdx < 0) continue

        const groundItem = tile.items[groundIdx]
        const brush = registry.getBrushForItem(groundItem.id)
        if (!brush || !brush.isRandomizable) continue

        // Pick new random ground item
        const newGroundId = registry.pickRandomItem(brush)
        if (!newGroundId || newGroundId === groundItem.id) continue

        const oldItems = deepCloneItems(tile.items)

        // Preserve attributes (actionId, uniqueId, etc.) from the old ground item
        tile.items[groundIdx] = { ...groundItem, id: newGroundId }

        this.recordAction({
          type: 'setTileItems',
          x: pos.x, y: pos.y, z: pos.z,
          oldItems,
          newItems: deepCloneItems(tile.items),
        })
        this.onTileChanged?.(pos.x, pos.y, pos.z)
      }
    })
  }

  /** Remove items from a tile that match the given predicate. No-op if nothing matches. */
  removeBrushItems(x: number, y: number, z: number, label: string, match: (itemId: number) => boolean): void {
    this.autoBatch(label, () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return

      const oldItems = deepCloneItems(tile.items)

      for (let i = tile.items.length - 1; i >= 0; i--) {
        if (match(tile.items[i].id)) {
          tile.items.splice(i, 1)
        }
      }

      if (!this.itemsEqual(oldItems, tile.items)) {
        this.recordAction({
          type: 'setTileItems', x, y, z,
          oldItems,
          newItems: deepCloneItems(tile.items),
        })
        this.onTileChanged?.(x, y, z)
      }
    })
  }

  /** Remove all non-ground items from a tile. If leaveUnique is true, preserve items with attributes and border items.
   *  If cleanBorders is true, removes border items before filtering (for automagic reborder pass). */
  eraseAllItems(x: number, y: number, z: number, options: { leaveUnique: boolean; cleanBorders?: boolean }): void {
    this.autoBatch('Erase all items', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile || tile.items.length === 0) return
      const registry = this._brushRegistry

      const oldItems = deepCloneItems(tile.items)

      // When automagic is on, clean borders first (RME: cleanBorders before erase)
      if (options.cleanBorders && registry) {
        this.removeBorderItems(tile, registry)
      }

      const newItems = tile.items.filter(item => {
        // Always keep ground
        if (classifyItem(item.id, this.appearances) === 'ground') return true
        // If leaveUnique, keep complex items and border items
        if (options.leaveUnique) {
          if (isComplexItem(item)) return true
          if (registry?.isBorderItem(item.id)) return true
        }
        return false
      })
      tile.items = newItems

      if (!this.itemsEqual(oldItems, tile.items)) {
        this.recordAction({
          type: 'setTileItems', x, y, z,
          oldItems,
          newItems: deepCloneItems(tile.items),
        })
        this.onTileChanged?.(x, y, z)
      }
    })
  }

  /** RME-style two-pass reborder after erasing: recalculate walls, carpets, tables, and borders
   *  on the given positions AND their surrounding tiles. Must be called AFTER all tiles are erased. */
  reborderAfterErase(positions: { x: number; y: number; z: number }[]): void {
    const registry = this._brushRegistry
    if (!registry || positions.length === 0) return

    this.autoBatch('Reborder after erase', () => {
      // Collect all affected tiles: erased positions + their 8-neighbors (deduped)
      const tilesToUpdate = new Map<string, { x: number; y: number; z: number }>()
      for (const pos of positions) {
        const key = tileKey(pos.x, pos.y, pos.z)
        if (!tilesToUpdate.has(key)) tilesToUpdate.set(key, pos)
        for (const [dx, dy] of OFFSETS_8) {
          const nx = pos.x + dx
          const ny = pos.y + dy
          if (nx < 0 || ny < 0) continue
          const nk = tileKey(nx, ny, pos.z)
          if (!tilesToUpdate.has(nk)) tilesToUpdate.set(nk, { x: nx, y: ny, z: pos.z })
        }
      }

      // Single pass: wallize, tableize, carpetize, then borderize each tile
      for (const pos of tilesToUpdate.values()) {
        const tile = this.mapData.tiles.get(tileKey(pos.x, pos.y, pos.z))
        if (!tile) continue

        const oldItems = deepCloneItems(tile.items)

        // Realign walls, carpets, tables (no-op on tiles where those were erased)
        if (tile.items.some(item => registry.isWallItem(item.id))) {
          const wallItems = doWalls(pos.x, pos.y, pos.z, this.mapData, registry)
          this.replaceWallItems(tile, wallItems, registry)
        }
        if (tile.items.some(item => registry.isCarpetItem(item.id))) {
          const carpetItems = doCarpets(pos.x, pos.y, pos.z, this.mapData, registry)
          this.replaceBrushItems(tile, carpetItems, registry, 'carpet')
        }
        if (tile.items.some(item => registry.isTableItem(item.id))) {
          const tableItems = doTables(pos.x, pos.y, pos.z, this.mapData, registry)
          this.replaceBrushItems(tile, tableItems, registry, 'table')
        }

        // Reborderize
        const hasGround = tile.items.some(it => classifyItem(it.id, this.appearances) === 'ground')
        if (hasGround) {
          this.removeBorderItems(tile, registry)
          const borders = computeBorders(pos.x, pos.y, pos.z, this.mapData, registry)
          this.insertBorderItems(tile, borders)
        }

        if (!this.itemsEqual(oldItems, tile.items)) {
          this.recordAction({
            type: 'setTileItems',
            x: pos.x, y: pos.y, z: pos.z,
            oldItems,
            newItems: deepCloneItems(tile.items),
          })
          this.onTileChanged?.(pos.x, pos.y, pos.z)
        }
      }
    })
  }

  /** Clear all flags on a tile. */
  clearAllTileFlags(x: number, y: number, z: number): void {
    this.autoBatch('Clear all tile flags', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile || tile.flags === 0) return
      const oldFlags = tile.flags
      tile.flags = 0
      this.recordAction({ type: 'setTileFlags', x, y, z, oldFlags, newFlags: 0 })
      this.onTileChanged?.(x, y, z)
    })
  }

  /** Clear all zones on a tile. */
  clearAllTileZones(x: number, y: number, z: number): void {
    this.autoBatch('Clear all tile zones', () => {
      const tile = this.mapData.tiles.get(tileKey(x, y, z))
      if (!tile) return
      const oldZones = tile.zones ? [...tile.zones] : []
      if (oldZones.length === 0) return
      tile.zones = undefined
      this.recordAction({ type: 'setTileZones', x, y, z, oldZones, newZones: [] })
      this.onTileChanged?.(x, y, z)
    })
  }

  // Recompute borders for 8 neighbors around (x, y, z)
  private reborderNeighbors(x: number, y: number, z: number): void {
    const registry = this._brushRegistry!
    this.updateNeighborTiles(x, y, z, OFFSETS_8, {
      update: (tile, nx, ny) => {
        this.removeBorderItems(tile, registry)
        const newBorders = computeBorders(nx, ny, z, this.mapData, registry)
        this.insertBorderItems(tile, newBorders)
      },
    })
  }

  // Realign wall items on 4 cardinal neighbors
  private realignWallNeighbors(x: number, y: number, z: number): void {
    const registry = this._brushRegistry!
    this.updateNeighborTiles(x, y, z, OFFSETS_4, {
      filter: (tile) => tile.items.some(item => registry.isWallItem(item.id)),
      update: (tile, nx, ny) => {
        const neighborWalls = doWalls(nx, ny, z, this.mapData, registry)
        this.replaceWallItems(tile, neighborWalls, registry)
      },
    })
  }

  // Update 8 cardinal+diagonal neighbors for carpet/table alignment
  private updateNeighborBrush(
    x: number, y: number, z: number,
    registry: BrushRegistry,
    brushType: 'carpet' | 'table',
  ): void {
    this.updateNeighborTiles(x, y, z, OFFSETS_8, {
      filter: (tile) => brushType === 'carpet'
        ? tile.items.some(item => registry.isCarpetItem(item.id))
        : tile.items.some(item => registry.isTableItem(item.id)),
      update: (tile, nx, ny) => {
        const aligned = brushType === 'carpet'
          ? doCarpets(nx, ny, z, this.mapData, registry)
          : doTables(nx, ny, z, this.mapData, registry)
        this.replaceBrushItems(tile, aligned, registry, brushType)
      },
    })
  }

  // Generic neighbor-update loop: clone → mutate → diff → record
  private updateNeighborTiles(
    x: number, y: number, z: number,
    offsets: ReadonlyArray<[number, number]>,
    options: {
      filter?: (tile: OtbmTile) => boolean
      update: (tile: OtbmTile, nx: number, ny: number) => void
    },
  ): void {
    for (const [dx, dy] of offsets) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0) continue

      const neighborTile = this.mapData.tiles.get(tileKey(nx, ny, z))
      if (!neighborTile) continue

      if (options.filter && !options.filter(neighborTile)) continue

      const neighborOld = deepCloneItems(neighborTile.items)
      options.update(neighborTile, nx, ny)

      if (!this.itemsEqual(neighborOld, neighborTile.items)) {
        this.recordAction({
          type: 'setTileItems', x: nx, y: ny, z,
          oldItems: neighborOld,
          newItems: deepCloneItems(neighborTile.items),
        })
        this.onTileChanged?.(nx, ny, z)
      }
    }
  }

  // Replace carpet/table items on a tile with new aligned ones
  private replaceBrushItems(
    tile: OtbmTile,
    newItems: OtbmItem[],
    registry: BrushRegistry,
    brushType: 'carpet' | 'table',
  ): void {
    // Remove all existing items of this brush type
    for (let i = tile.items.length - 1; i >= 0; i--) {
      const isMatch = brushType === 'carpet'
        ? registry.isCarpetItem(tile.items[i].id)
        : registry.isTableItem(tile.items[i].id)
      if (isMatch) {
        tile.items.splice(i, 1)
      }
    }

    // Insert new items at correct layer positions
    for (const item of newItems) {
      const layer = classifyItem(item.id, this.appearances)
      const index = this.findInsertIndex(tile, layer)
      tile.items.splice(index, 0, item)
    }
  }

  // Replace wall items on a tile with new aligned ones, preserving non-wall items
  private replaceWallItems(tile: OtbmTile, newWalls: OtbmItem[], registry: BrushRegistry): void {
    // Remove all existing wall items
    for (let i = tile.items.length - 1; i >= 0; i--) {
      if (registry.isWallItem(tile.items[i].id)) {
        tile.items.splice(i, 1)
      }
    }

    // Insert new wall items at correct layer positions
    for (const wall of newWalls) {
      const layer = classifyItem(wall.id, this.appearances)
      const index = this.findInsertIndex(tile, layer)
      tile.items.splice(index, 0, wall)
    }
  }

  private removeBorderItems(tile: OtbmTile, registry: BrushRegistry): void {
    // Remove items in the 'bottom' layer that are border items
    // Border items sit after ground but before common items
    for (let i = tile.items.length - 1; i >= 0; i--) {
      const item = tile.items[i]
      if (registry.isBorderItem(item.id)) {
        tile.items.splice(i, 1)
      }
    }
  }

  private insertBorderItems(tile: OtbmTile, borders: OtbmItem[]): void {
    if (borders.length === 0) return
    // Insert border items after ground but before other items.
    // Find where ground ends.
    let insertAt = 0
    for (let i = 0; i < tile.items.length; i++) {
      if (classifyItem(tile.items[i].id, this.appearances) === 'ground') {
        insertAt = i + 1
      } else {
        break
      }
    }
    tile.items.splice(insertAt, 0, ...borders)
  }

  private itemsEqual(a: OtbmItem[], b: OtbmItem[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false
    }
    return true
  }

  // --- Helpers ---

  private findInsertIndex(tile: OtbmTile, layer: DrawLayer): number {
    // Layer order: ground → bottom → common → top
    // RME convention: render forward, last item in layer = drawn last = visually on top.
    // Insert at the END of the layer section so new items appear on top.
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
