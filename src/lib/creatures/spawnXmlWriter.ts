import type { OtbmMap } from '../otbm'
import { tileKey } from '../otbm'
import type { SpawnPoint, SpawnCreature } from '../sidecars'
import type { SpawnManager } from './SpawnManager'

export interface CollectResult {
  spawns: SpawnPoint[]
  orphans: string[]
}

/**
 * Iterate spawn centers from SpawnManager and gather creatures from tiles,
 * producing SpawnPoint[] ready for serializeSpawnsXml().
 */
function collectSpawnPoints(
  mapData: OtbmMap,
  spawnManager: SpawnManager,
  type: 'monster' | 'npc',
): CollectResult {
  const centers = type === 'monster' ? spawnManager.monsterSpawns : spawnManager.npcSpawns
  const spawns: SpawnPoint[] = []
  // Track which creatures have been claimed (by tile key + creature index/name)
  // to avoid duplicating creatures in overlapping spawn zones.
  const claimed = new Set<string>()

  for (const centerKey of centers) {
    const centerTile = mapData.tiles.get(centerKey)
    if (!centerTile) continue

    const spawnData = type === 'monster' ? centerTile.spawnMonster : centerTile.spawnNpc
    if (!spawnData) continue

    const { x: cx, y: cy, z: cz } = centerTile
    const radius = spawnData.radius
    const creatures: SpawnCreature[] = []

    const tilesInRadius = spawnManager.getTilesInRadius(cx, cy, cz, radius)
    for (const pos of tilesInRadius) {
      const tile = mapData.tiles.get(tileKey(pos.x, pos.y, pos.z))
      if (!tile) continue

      if (type === 'monster') {
        if (tile.monsters) {
          for (let i = 0; i < tile.monsters.length; i++) {
            const claimKey = `m:${pos.x},${pos.y},${pos.z}:${i}`
            if (claimed.has(claimKey)) continue
            claimed.add(claimKey)
            const m = tile.monsters[i]
            creatures.push({
              name: m.name,
              x: pos.x,
              y: pos.y,
              z: pos.z,
              spawnTime: m.spawnTime,
              direction: m.direction,
              weight: m.weight,
            })
          }
        }
      } else {
        if (tile.npc) {
          const claimKey = `n:${pos.x},${pos.y},${pos.z}`
          if (!claimed.has(claimKey)) {
            claimed.add(claimKey)
            creatures.push({
              name: tile.npc.name,
              x: pos.x,
              y: pos.y,
              z: pos.z,
              spawnTime: tile.npc.spawnTime,
              direction: tile.npc.direction,
            })
          }
        }
      }
    }

    spawns.push({ centerX: cx, centerY: cy, centerZ: cz, radius, creatures })
  }

  // Detect orphan creatures — creatures on tiles not claimed by any spawn
  const orphans: string[] = []
  for (const tile of mapData.tiles.values()) {
    if (type === 'monster' && tile.monsters) {
      for (let i = 0; i < tile.monsters.length; i++) {
        const claimKey = `m:${tile.x},${tile.y},${tile.z}:${i}`
        if (!claimed.has(claimKey)) {
          orphans.push(`${tile.monsters[i].name} at ${tile.x},${tile.y},${tile.z}`)
        }
      }
    }
    if (type === 'npc' && tile.npc) {
      const claimKey = `n:${tile.x},${tile.y},${tile.z}`
      if (!claimed.has(claimKey)) {
        orphans.push(`${tile.npc.name} at ${tile.x},${tile.y},${tile.z}`)
      }
    }
  }

  return { spawns, orphans }
}

export function collectMonsterSpawns(mapData: OtbmMap, spawnManager: SpawnManager): CollectResult {
  return collectSpawnPoints(mapData, spawnManager, 'monster')
}

export function collectNpcSpawns(mapData: OtbmMap, spawnManager: SpawnManager): CollectResult {
  return collectSpawnPoints(mapData, spawnManager, 'npc')
}
