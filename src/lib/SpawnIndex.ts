import type { SpawnPoint, SpawnCreature } from './sidecars'

export interface SpawnEntry {
  spawn: SpawnPoint
  spawnIdx: number
}

/**
 * Spatial index for spawn data.
 * Maps tile positions to the spawn(s) covering them (square radius, RME convention).
 */
export class SpawnIndex {
  private _tileMap = new Map<string, SpawnEntry[]>()

  rebuild(spawns: SpawnPoint[]): void {
    this._tileMap.clear()
    for (let i = 0; i < spawns.length; i++) {
      const sp = spawns[i]
      const r = sp.radius
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const key = `${sp.centerX + dx},${sp.centerY + dy},${sp.centerZ}`
          let arr = this._tileMap.get(key)
          if (!arr) {
            arr = []
            this._tileMap.set(key, arr)
          }
          arr.push({ spawn: sp, spawnIdx: i })
        }
      }
    }
  }

  /** Get all spawns whose area covers this tile. */
  getSpawnsAt(x: number, y: number, z: number): SpawnEntry[] {
    return this._tileMap.get(`${x},${y},${z}`) ?? []
  }

  /** Get all creatures positioned at this exact tile. */
  getCreaturesAt(x: number, y: number, z: number): SpawnCreature[] {
    const entries = this._tileMap.get(`${x},${y},${z}`)
    if (!entries) return []
    const result: SpawnCreature[] = []
    for (const { spawn } of entries) {
      for (const c of spawn.creatures) {
        if (c.x === x && c.y === y && c.z === z) {
          result.push(c)
        }
      }
    }
    return result
  }

  /** Get the spawn whose center is at this exact position, if any. */
  getSpawnCenterAt(x: number, y: number, z: number): SpawnEntry | null {
    const entries = this._tileMap.get(`${x},${y},${z}`)
    if (!entries) return null
    for (const entry of entries) {
      if (entry.spawn.centerX === x && entry.spawn.centerY === y && entry.spawn.centerZ === z) {
        return entry
      }
    }
    return null
  }

  /** Check if a tile is within any spawn's area. */
  isInSpawnArea(x: number, y: number, z: number): boolean {
    return this._tileMap.has(`${x},${y},${z}`)
  }
}
