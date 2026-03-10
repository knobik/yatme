import { describe, it, expect, beforeEach } from 'vitest'
import { SpawnManager } from './SpawnManager'

describe('SpawnManager', () => {
  let manager: SpawnManager

  beforeEach(() => {
    manager = new SpawnManager()
  })

  describe('getTilesInRadius', () => {
    it('returns 1 tile for radius 0', () => {
      const tiles = manager.getTilesInRadius(100, 100, 7, 0)
      expect(tiles).toEqual([{ x: 100, y: 100, z: 7 }])
    })

    it('returns 9 tiles for radius 1 (3x3)', () => {
      const tiles = manager.getTilesInRadius(100, 100, 7, 1)
      expect(tiles).toHaveLength(9)
      expect(tiles).toContainEqual({ x: 99, y: 99, z: 7 })
      expect(tiles).toContainEqual({ x: 100, y: 100, z: 7 })
      expect(tiles).toContainEqual({ x: 101, y: 101, z: 7 })
    })

    it('returns 25 tiles for radius 2 (5x5)', () => {
      const tiles = manager.getTilesInRadius(100, 100, 7, 2)
      expect(tiles).toHaveLength(25)
    })

    it('clamps to map bounds at origin', () => {
      const tiles = manager.getTilesInRadius(0, 0, 7, 2)
      // x: 0..2, y: 0..2 = 3x3 = 9 tiles (negative coords clamped)
      expect(tiles).toHaveLength(9)
      expect(tiles.every(t => t.x >= 0 && t.y >= 0)).toBe(true)
    })

    it('clamps to map bounds at max edge', () => {
      const tiles = manager.getTilesInRadius(65000, 65000, 7, 2)
      // x: 64998..65000, y: 64998..65000 = 3x3 = 9 tiles
      expect(tiles).toHaveLength(9)
      expect(tiles.every(t => t.x <= 65000 && t.y <= 65000)).toBe(true)
    })

    it('all tiles share the same z level', () => {
      const tiles = manager.getTilesInRadius(100, 100, 5, 3)
      expect(tiles.every(t => t.z === 5)).toBe(true)
    })
  })

  describe('addMonsterSpawn', () => {
    it('registers the center in monsterSpawns', () => {
      manager.addMonsterSpawn(100, 100, 7, 2)
      expect(manager.monsterSpawns.has('100,100,7')).toBe(true)
    })

    it('increments counts for all covered tiles', () => {
      manager.addMonsterSpawn(100, 100, 7, 1)
      // 3x3 area, all should have count 1
      for (let x = 99; x <= 101; x++) {
        for (let y = 99; y <= 101; y++) {
          expect(manager.getMonsterSpawnCount(x, y, 7)).toBe(1)
        }
      }
    })

    it('includes edge tiles', () => {
      manager.addMonsterSpawn(100, 100, 7, 2)
      expect(manager.isInMonsterSpawn(98, 98, 7)).toBe(true)
      expect(manager.isInMonsterSpawn(102, 102, 7)).toBe(true)
    })

    it('does not affect tiles outside radius', () => {
      manager.addMonsterSpawn(100, 100, 7, 1)
      expect(manager.isInMonsterSpawn(97, 100, 7)).toBe(false)
      expect(manager.isInMonsterSpawn(100, 103, 7)).toBe(false)
    })
  })

  describe('removeMonsterSpawn', () => {
    it('unregisters the center from monsterSpawns', () => {
      manager.addMonsterSpawn(100, 100, 7, 2)
      manager.removeMonsterSpawn(100, 100, 7, 2)
      expect(manager.monsterSpawns.has('100,100,7')).toBe(false)
    })

    it('decrements counts and cleans up zero entries', () => {
      manager.addMonsterSpawn(100, 100, 7, 1)
      manager.removeMonsterSpawn(100, 100, 7, 1)
      for (let x = 99; x <= 101; x++) {
        for (let y = 99; y <= 101; y++) {
          expect(manager.getMonsterSpawnCount(x, y, 7)).toBe(0)
        }
      }
    })

    it('removing a never-added spawn is a no-op', () => {
      manager.removeMonsterSpawn(50, 50, 7, 3)
      expect(manager.getMonsterSpawnCount(50, 50, 7)).toBe(0)
      expect(manager.monsterSpawns.size).toBe(0)
    })
  })

  describe('addNpcSpawn / removeNpcSpawn', () => {
    it('registers and tracks NPC spawns separately from monsters', () => {
      manager.addNpcSpawn(200, 200, 7, 1)
      expect(manager.npcSpawns.has('200,200,7')).toBe(true)
      expect(manager.monsterSpawns.has('200,200,7')).toBe(false)
      expect(manager.isInNpcSpawn(200, 200, 7)).toBe(true)
      expect(manager.isInMonsterSpawn(200, 200, 7)).toBe(false)
    })

    it('increments and decrements NPC counts correctly', () => {
      manager.addNpcSpawn(200, 200, 7, 1)
      expect(manager.getNpcSpawnCount(200, 200, 7)).toBe(1)
      manager.removeNpcSpawn(200, 200, 7, 1)
      expect(manager.getNpcSpawnCount(200, 200, 7)).toBe(0)
    })
  })

  describe('overlapping zones', () => {
    it('two overlapping monster spawns give count=2 on shared tiles', () => {
      manager.addMonsterSpawn(100, 100, 7, 1)
      manager.addMonsterSpawn(101, 100, 7, 1)
      // tile (100, 100) is in both spawns
      expect(manager.getMonsterSpawnCount(100, 100, 7)).toBe(2)
      // tile (101, 100) is also in both
      expect(manager.getMonsterSpawnCount(101, 100, 7)).toBe(2)
      // tile (99, 100) only in first spawn
      expect(manager.getMonsterSpawnCount(99, 100, 7)).toBe(1)
      // tile (102, 100) only in second spawn
      expect(manager.getMonsterSpawnCount(102, 100, 7)).toBe(1)
    })

    it('removing one overlapping spawn leaves count=1 on shared tiles', () => {
      manager.addMonsterSpawn(100, 100, 7, 1)
      manager.addMonsterSpawn(101, 100, 7, 1)
      manager.removeMonsterSpawn(100, 100, 7, 1)
      expect(manager.getMonsterSpawnCount(100, 100, 7)).toBe(1)
      expect(manager.getMonsterSpawnCount(101, 100, 7)).toBe(1)
      expect(manager.getMonsterSpawnCount(99, 100, 7)).toBe(0)
    })
  })

  describe('z-level isolation', () => {
    it('spawn on z=7 does not affect z=8', () => {
      manager.addMonsterSpawn(100, 100, 7, 2)
      expect(manager.isInMonsterSpawn(100, 100, 7)).toBe(true)
      expect(manager.isInMonsterSpawn(100, 100, 8)).toBe(false)
    })
  })

  describe('query methods', () => {
    it('getMonsterSpawnCount returns 0 for uncovered tile', () => {
      expect(manager.getMonsterSpawnCount(500, 500, 7)).toBe(0)
    })

    it('getNpcSpawnCount returns 0 for uncovered tile', () => {
      expect(manager.getNpcSpawnCount(500, 500, 7)).toBe(0)
    })

    it('isInMonsterSpawn returns false for uncovered tile', () => {
      expect(manager.isInMonsterSpawn(500, 500, 7)).toBe(false)
    })

    it('isInNpcSpawn returns false for uncovered tile', () => {
      expect(manager.isInNpcSpawn(500, 500, 7)).toBe(false)
    })
  })

  describe('clear', () => {
    it('resets all structures', () => {
      manager.addMonsterSpawn(100, 100, 7, 2)
      manager.addNpcSpawn(200, 200, 7, 1)
      manager.clear()
      expect(manager.monsterSpawns.size).toBe(0)
      expect(manager.npcSpawns.size).toBe(0)
      expect(manager.isInMonsterSpawn(100, 100, 7)).toBe(false)
      expect(manager.isInNpcSpawn(200, 200, 7)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('radius 0 covers exactly 1 tile', () => {
      manager.addMonsterSpawn(100, 100, 7, 0)
      expect(manager.getMonsterSpawnCount(100, 100, 7)).toBe(1)
      expect(manager.getMonsterSpawnCount(101, 100, 7)).toBe(0)
      expect(manager.getMonsterSpawnCount(99, 100, 7)).toBe(0)
    })

    it('large radius covers expected tile count', () => {
      const tiles = manager.getTilesInRadius(1000, 1000, 7, 15)
      // 31x31 = 961 tiles
      expect(tiles).toHaveLength(961)
    })
  })

  describe('performance', () => {
    it('radius 15 spawn: add + query all + remove under 100ms', () => {
      const start = performance.now()
      manager.addMonsterSpawn(1000, 1000, 7, 15)
      // Query all 961 tiles
      for (let x = 985; x <= 1015; x++) {
        for (let y = 985; y <= 1015; y++) {
          manager.getMonsterSpawnCount(x, y, 7)
        }
      }
      manager.removeMonsterSpawn(1000, 1000, 7, 15)
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(100)
    })

    it('50 overlapping radius-10 spawns: add all under 500ms with correct counts', () => {
      const start = performance.now()
      for (let i = 0; i < 50; i++) {
        manager.addMonsterSpawn(1000 + i, 1000, 7, 10)
      }
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(500)
      // Center of the cluster should have count > 1
      expect(manager.getMonsterSpawnCount(1010, 1000, 7)).toBeGreaterThan(1)
    })
  })
})
