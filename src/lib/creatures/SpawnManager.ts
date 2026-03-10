import { MAP_MAX_WIDTH, MAP_MAX_HEIGHT, tileKey } from '../otbm'
import type { Position } from './types'

export class SpawnManager {
  readonly monsterSpawns = new Set<string>()
  readonly npcSpawns = new Set<string>()
  private monsterSpawnCounts = new Map<string, number>()
  private npcSpawnCounts = new Map<string, number>()

  getTilesInRadius(cx: number, cy: number, cz: number, radius: number): Position[] {
    const tiles: Position[] = []
    this.forEachInRadius(cx, cy, cz, radius, (x, y, z) => {
      tiles.push({ x, y, z })
    })
    return tiles
  }

  addMonsterSpawn(cx: number, cy: number, cz: number, radius: number): void {
    this.addSpawn(this.monsterSpawns, this.monsterSpawnCounts, cx, cy, cz, radius)
  }

  removeMonsterSpawn(cx: number, cy: number, cz: number, radius: number): void {
    this.removeSpawn(this.monsterSpawns, this.monsterSpawnCounts, cx, cy, cz, radius)
  }

  addNpcSpawn(cx: number, cy: number, cz: number, radius: number): void {
    this.addSpawn(this.npcSpawns, this.npcSpawnCounts, cx, cy, cz, radius)
  }

  removeNpcSpawn(cx: number, cy: number, cz: number, radius: number): void {
    this.removeSpawn(this.npcSpawns, this.npcSpawnCounts, cx, cy, cz, radius)
  }

  getMonsterSpawnCount(x: number, y: number, z: number): number {
    return this.monsterSpawnCounts.get(tileKey(x, y, z)) ?? 0
  }

  getNpcSpawnCount(x: number, y: number, z: number): number {
    return this.npcSpawnCounts.get(tileKey(x, y, z)) ?? 0
  }

  isInMonsterSpawn(x: number, y: number, z: number): boolean {
    return this.getMonsterSpawnCount(x, y, z) > 0
  }

  isInNpcSpawn(x: number, y: number, z: number): boolean {
    return this.getNpcSpawnCount(x, y, z) > 0
  }

  clear(): void {
    this.monsterSpawns.clear()
    this.npcSpawns.clear()
    this.monsterSpawnCounts.clear()
    this.npcSpawnCounts.clear()
  }

  private addSpawn(centers: Set<string>, counts: Map<string, number>, cx: number, cy: number, cz: number, radius: number): void {
    centers.add(tileKey(cx, cy, cz))
    this.forEachInRadius(cx, cy, cz, radius, (x, y, z) => {
      const key = tileKey(x, y, z)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
  }

  private removeSpawn(centers: Set<string>, counts: Map<string, number>, cx: number, cy: number, cz: number, radius: number): void {
    centers.delete(tileKey(cx, cy, cz))
    this.forEachInRadius(cx, cy, cz, radius, (x, y, z) => {
      const key = tileKey(x, y, z)
      const count = (counts.get(key) ?? 0) - 1
      if (count <= 0) {
        counts.delete(key)
      } else {
        counts.set(key, count)
      }
    })
  }

  private forEachInRadius(cx: number, cy: number, cz: number, radius: number, fn: (x: number, y: number, z: number) => void): void {
    const minX = Math.max(0, cx - radius)
    const maxX = Math.min(MAP_MAX_WIDTH, cx + radius)
    const minY = Math.max(0, cy - radius)
    const maxY = Math.min(MAP_MAX_HEIGHT, cy + radius)
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        fn(x, y, cz)
      }
    }
  }
}
