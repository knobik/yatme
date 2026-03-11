import type { SpawnPoint } from '../sidecars'
import type { OtbmMap, OtbmTile } from '../otbm'
import { tileKey } from '../otbm'
import type { SpawnManager } from './SpawnManager'
import type { CreatureDatabase } from './CreatureDatabase'
import { Direction, type TileCreature } from './types'

export interface ApplySpawnsResult {
  spawnsApplied: number
  creaturesApplied: number
  unknownCreatures: string[]
}

function getOrCreateTile(mapData: OtbmMap, x: number, y: number, z: number): OtbmTile {
  const key = tileKey(x, y, z)
  let tile = mapData.tiles.get(key)
  if (!tile) {
    tile = { x, y, z, flags: 0, items: [] }
    mapData.tiles.set(key, tile)
  }
  return tile
}

function clampDirection(dir: number): Direction {
  if (dir >= 0 && dir <= 3) return dir as Direction
  return Direction.NORTH
}

interface SpawnConfig {
  label: string
  isNpc: boolean
  setSpawnCenter: (tile: OtbmTile, radius: number) => void
  registerSpawn: (sm: SpawnManager, cx: number, cy: number, cz: number, radius: number) => void
  placeCreature: (tile: OtbmTile, creature: TileCreature) => void
}

const MONSTER_CONFIG: SpawnConfig = {
  label: 'monster',
  isNpc: false,
  setSpawnCenter: (tile, radius) => { tile.spawnMonster = { radius } },
  registerSpawn: (sm, cx, cy, cz, radius) => sm.addMonsterSpawn(cx, cy, cz, radius),
  placeCreature: (tile, creature) => {
    if (!tile.monsters) tile.monsters = []
    tile.monsters.push(creature)
  },
}

const NPC_CONFIG: SpawnConfig = {
  label: 'NPC',
  isNpc: true,
  setSpawnCenter: (tile, radius) => { tile.spawnNpc = { radius } },
  registerSpawn: (sm, cx, cy, cz, radius) => sm.addNpcSpawn(cx, cy, cz, radius),
  placeCreature: (tile, creature) => {
    if (tile.npc) {
      console.warn(`[applySpawns] Replacing NPC "${tile.npc.name}" with "${creature.name}" at ${tile.x},${tile.y},${tile.z}`)
    }
    tile.npc = creature
  },
}

function applySpawns(
  spawns: SpawnPoint[],
  mapData: OtbmMap,
  spawnManager: SpawnManager,
  creatureDb: CreatureDatabase,
  config: SpawnConfig,
): ApplySpawnsResult {
  let spawnsApplied = 0
  let creaturesApplied = 0
  const unknownCreatures: string[] = []
  const seenUnknown = new Set<string>()

  for (const spawn of spawns) {
    const centerTile = getOrCreateTile(mapData, spawn.centerX, spawn.centerY, spawn.centerZ)
    config.setSpawnCenter(centerTile, spawn.radius)
    config.registerSpawn(spawnManager, spawn.centerX, spawn.centerY, spawn.centerZ, spawn.radius)
    spawnsApplied++

    for (const creature of spawn.creatures) {
      if (!creature.name) {
        console.warn(`[applySpawns] Skipping ${config.label} with empty name at`, creature.x, creature.y, creature.z)
        continue
      }

      const known = creatureDb.getByName(creature.name)
      if (!known && !seenUnknown.has(creature.name.toLowerCase())) {
        seenUnknown.add(creature.name.toLowerCase())
        unknownCreatures.push(creature.name)
        console.warn(`[applySpawns] Unknown ${config.label}: "${creature.name}"`)
      }

      const tile = getOrCreateTile(mapData, creature.x, creature.y, creature.z)

      const tileCreature: TileCreature = {
        name: creature.name,
        direction: clampDirection(creature.direction),
        spawnTime: creature.spawnTime,
        weight: config.isNpc ? undefined : creature.weight,
        isNpc: config.isNpc,
      }
      config.placeCreature(tile, tileCreature)
      creaturesApplied++
    }
  }

  return { spawnsApplied, creaturesApplied, unknownCreatures }
}

export function applyMonsterSpawns(
  spawns: SpawnPoint[],
  mapData: OtbmMap,
  spawnManager: SpawnManager,
  creatureDb: CreatureDatabase,
): ApplySpawnsResult {
  return applySpawns(spawns, mapData, spawnManager, creatureDb, MONSTER_CONFIG)
}

export function applyNpcSpawns(
  spawns: SpawnPoint[],
  mapData: OtbmMap,
  spawnManager: SpawnManager,
  creatureDb: CreatureDatabase,
): ApplySpawnsResult {
  return applySpawns(spawns, mapData, spawnManager, creatureDb, NPC_CONFIG)
}
