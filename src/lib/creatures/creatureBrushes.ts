import type { OtbmMap, OtbmTile } from '../otbm'
import { tileKey, PZ_FLAG } from '../otbm'
import type { AppearanceData } from '../appearances'
import type { MapMutator } from '../MapMutator'
import { classifyItem } from '../MapMutator'
import type { SpawnManager } from './SpawnManager'
import type { TileCreature } from './types'
import { Direction } from './types'
import type { BrushSelection } from '../../hooks/tools/types'

export interface CreatureBrushConfig {
  spawnTime: number        // default 60
  weight?: number          // 0-255, monsters only
  autoCreateSpawn: boolean // from EditorSettings
}

function tileHasGround(tile: OtbmTile, appearances: AppearanceData): boolean {
  return tile.items.some(item => classifyItem(item.id, appearances) === 'ground')
}

function isPz(tile: OtbmTile): boolean {
  return (tile.flags & PZ_FLAG) !== 0
}

// ── Monster brush ──────────────────────────────────────────────────

export function canDrawMonster(
  tile: OtbmTile | undefined,
  appearances: AppearanceData,
  spawnManager: SpawnManager,
  autoCreateSpawn: boolean,
): boolean {
  if (!tile) return false
  if (!tileHasGround(tile, appearances)) return false
  if (isPz(tile)) return false
  return autoCreateSpawn || spawnManager.isInMonsterSpawn(tile.x, tile.y, tile.z)
}

export function drawMonster(
  mutator: MapMutator,
  x: number, y: number, z: number,
  name: string,
  config: CreatureBrushConfig,
  mapData: OtbmMap,
  appearances: AppearanceData,
  spawnManager: SpawnManager,
): void {
  const tile = mapData.tiles.get(tileKey(x, y, z))
  if (!tile) return
  if (!tileHasGround(tile, appearances)) return
  if (isPz(tile)) return

  // Auto-create spawn zone if needed
  if (!spawnManager.isInMonsterSpawn(x, y, z) && config.autoCreateSpawn) {
    mutator.placeSpawnZone(x, y, z, 'monster', 1)
  }

  // Skip if already has this monster
  if (tile.monsters?.some(m => m.name === name)) return

  const creature: TileCreature = {
    name,
    direction: Direction.SOUTH,
    spawnTime: config.spawnTime,
    weight: config.weight,
    isNpc: false,
  }
  mutator.placeCreature(x, y, z, creature)
}

export function eraseMonster(
  mutator: MapMutator,
  x: number, y: number, z: number,
  name: string,
): void {
  mutator.removeCreature(x, y, z, name, false)
}

// ── NPC brush ──────────────────────────────────────────────────────

export function canDrawNpc(
  tile: OtbmTile | undefined,
  appearances: AppearanceData,
  spawnManager: SpawnManager,
  autoCreateSpawn: boolean,
): boolean {
  if (!tile) return false
  if (!tileHasGround(tile, appearances)) return false
  // PZ is allowed for NPCs
  return autoCreateSpawn || spawnManager.isInNpcSpawn(tile.x, tile.y, tile.z)
}

export function drawNpc(
  mutator: MapMutator,
  x: number, y: number, z: number,
  name: string,
  config: CreatureBrushConfig,
  mapData: OtbmMap,
  appearances: AppearanceData,
  spawnManager: SpawnManager,
): void {
  const tile = mapData.tiles.get(tileKey(x, y, z))
  if (!tile) return
  if (!tileHasGround(tile, appearances)) return

  // Auto-create spawn zone if needed
  if (!spawnManager.isInNpcSpawn(x, y, z) && config.autoCreateSpawn) {
    mutator.placeSpawnZone(x, y, z, 'npc', 1)
  }

  // placeCreature replaces existing NPC automatically (via setNpc action)
  const creature: TileCreature = {
    name,
    direction: Direction.SOUTH,
    spawnTime: config.spawnTime,
    isNpc: true,
  }
  mutator.placeCreature(x, y, z, creature)
}

export function eraseNpc(
  mutator: MapMutator,
  x: number, y: number, z: number,
  name: string,
): void {
  mutator.removeCreature(x, y, z, name, true)
}

// ── Spawn brushes (shared for monster and NPC) ─────────────────────

type SpawnType = 'monster' | 'npc'

function getExistingSpawn(tile: OtbmTile, spawnType: SpawnType) {
  return spawnType === 'monster' ? tile.spawnMonster : tile.spawnNpc
}

export function canDrawSpawn(
  tile: OtbmTile | undefined,
  appearances: AppearanceData,
  spawnType: SpawnType,
): boolean {
  if (!tile) return false
  if (!tileHasGround(tile, appearances)) return false
  return !getExistingSpawn(tile, spawnType)
}

export function drawSpawn(
  mutator: MapMutator,
  x: number, y: number, z: number,
  radius: number,
  mapData: OtbmMap,
  appearances: AppearanceData,
  spawnType: SpawnType,
): void {
  const tile = mapData.tiles.get(tileKey(x, y, z))
  if (!tile) return
  if (!tileHasGround(tile, appearances)) return
  if (getExistingSpawn(tile, spawnType)) return
  mutator.placeSpawnZone(x, y, z, spawnType, radius)
}

export function eraseSpawn(
  mutator: MapMutator,
  x: number, y: number, z: number,
  spawnType: SpawnType,
): void {
  mutator.removeSpawnZone(x, y, z, spawnType)
}

// ── Unified dispatch ───────────────────────────────────────────────

export function applyCreatureBrush(
  selection: BrushSelection,
  mutator: MapMutator,
  x: number, y: number, z: number,
  config: CreatureBrushConfig,
  mapData: OtbmMap,
  appearances: AppearanceData,
  spawnManager: SpawnManager,
  spawnRadius: number,
): void {
  if (selection.mode === 'creature') {
    if (selection.isNpc) {
      drawNpc(mutator, x, y, z, selection.creatureName, config, mapData, appearances, spawnManager)
    } else {
      drawMonster(mutator, x, y, z, selection.creatureName, config, mapData, appearances, spawnManager)
    }
  } else if (selection.mode === 'spawn') {
    drawSpawn(mutator, x, y, z, spawnRadius, mapData, appearances, selection.spawnType)
  }
}

export function eraseCreatureBrush(
  selection: BrushSelection,
  mutator: MapMutator,
  x: number, y: number, z: number,
): void {
  if (selection.mode === 'creature') {
    if (selection.isNpc) {
      eraseNpc(mutator, x, y, z, selection.creatureName)
    } else {
      eraseMonster(mutator, x, y, z, selection.creatureName)
    }
  } else if (selection.mode === 'spawn') {
    eraseSpawn(mutator, x, y, z, selection.spawnType)
  }
}
