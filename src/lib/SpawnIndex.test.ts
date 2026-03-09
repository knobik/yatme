import { describe, it, expect, beforeEach } from 'vitest'
import { SpawnIndex } from './SpawnIndex'
import type { SpawnPoint } from './sidecars'

function makeSpawn(cx: number, cy: number, cz: number, radius: number, creatures: { name: string; x: number; y: number; z: number }[] = []): SpawnPoint {
  return {
    centerX: cx, centerY: cy, centerZ: cz, radius,
    creatures: creatures.map(c => ({ ...c, spawnTime: 60, direction: 0 })),
  }
}

describe('SpawnIndex', () => {
  let index: SpawnIndex

  beforeEach(() => {
    index = new SpawnIndex()
  })

  it('should return empty for no spawns', () => {
    index.rebuild([])
    expect(index.getSpawnsAt(100, 100, 7)).toEqual([])
    expect(index.isInSpawnArea(100, 100, 7)).toBe(false)
  })

  it('should index spawn center', () => {
    const spawn = makeSpawn(100, 100, 7, 3)
    index.rebuild([spawn])

    const entries = index.getSpawnsAt(100, 100, 7)
    expect(entries).toHaveLength(1)
    expect(entries[0].spawn).toBe(spawn)
    expect(entries[0].spawnIdx).toBe(0)
  })

  it('should index tiles within square radius', () => {
    const spawn = makeSpawn(100, 100, 7, 2)
    index.rebuild([spawn])

    // Corner of radius
    expect(index.isInSpawnArea(98, 98, 7)).toBe(true)
    expect(index.isInSpawnArea(102, 102, 7)).toBe(true)

    // Just outside radius
    expect(index.isInSpawnArea(97, 100, 7)).toBe(false)
    expect(index.isInSpawnArea(103, 100, 7)).toBe(false)
  })

  it('should not match different floors', () => {
    index.rebuild([makeSpawn(100, 100, 7, 3)])
    expect(index.isInSpawnArea(100, 100, 6)).toBe(false)
    expect(index.isInSpawnArea(100, 100, 8)).toBe(false)
  })

  it('should handle overlapping spawns', () => {
    const spawn1 = makeSpawn(100, 100, 7, 2)
    const spawn2 = makeSpawn(101, 100, 7, 2)
    index.rebuild([spawn1, spawn2])

    // Tile at 100,100 is in both spawns
    const entries = index.getSpawnsAt(100, 100, 7)
    expect(entries).toHaveLength(2)
    expect(entries[0].spawnIdx).toBe(0)
    expect(entries[1].spawnIdx).toBe(1)
  })

  it('should find spawn center at exact position', () => {
    const spawn = makeSpawn(100, 100, 7, 3)
    index.rebuild([spawn])

    const center = index.getSpawnCenterAt(100, 100, 7)
    expect(center).not.toBeNull()
    expect(center!.spawn).toBe(spawn)

    // Not a center — just within area
    expect(index.getSpawnCenterAt(101, 100, 7)).toBeNull()
  })

  it('should find creatures at position', () => {
    const spawn = makeSpawn(100, 100, 7, 3, [
      { name: 'Rat', x: 101, y: 100, z: 7 },
      { name: 'Spider', x: 101, y: 100, z: 7 },
      { name: 'Wolf', x: 102, y: 100, z: 7 },
    ])
    index.rebuild([spawn])

    const creatures = index.getCreaturesAt(101, 100, 7)
    expect(creatures).toHaveLength(2)
    expect(creatures[0].name).toBe('Rat')
    expect(creatures[1].name).toBe('Spider')

    expect(index.getCreaturesAt(102, 100, 7)).toHaveLength(1)
    expect(index.getCreaturesAt(100, 100, 7)).toHaveLength(0)
  })

  it('should find creatures from overlapping spawns', () => {
    const spawn1 = makeSpawn(100, 100, 7, 2, [{ name: 'Rat', x: 101, y: 100, z: 7 }])
    const spawn2 = makeSpawn(102, 100, 7, 2, [{ name: 'Wolf', x: 101, y: 100, z: 7 }])
    index.rebuild([spawn1, spawn2])

    const creatures = index.getCreaturesAt(101, 100, 7)
    expect(creatures).toHaveLength(2)
    expect(creatures.map(c => c.name)).toEqual(['Rat', 'Wolf'])
  })

  it('should handle radius 0 (single tile)', () => {
    const spawn = makeSpawn(50, 50, 7, 0)
    index.rebuild([spawn])

    expect(index.isInSpawnArea(50, 50, 7)).toBe(true)
    expect(index.isInSpawnArea(51, 50, 7)).toBe(false)
    expect(index.isInSpawnArea(50, 51, 7)).toBe(false)
  })

  it('should clear on rebuild', () => {
    index.rebuild([makeSpawn(100, 100, 7, 1)])
    expect(index.isInSpawnArea(100, 100, 7)).toBe(true)

    index.rebuild([])
    expect(index.isInSpawnArea(100, 100, 7)).toBe(false)
  })
})
