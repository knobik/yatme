import { describe, it, expect, beforeEach } from 'vitest'
import { Graphics } from 'pixi.js'
import { SpawnOverlay } from './SpawnOverlay'
import { SpawnManager } from './SpawnManager'
import { ALPHA_NONE } from '../TileOverlay'
import type { OtbmTile } from '../otbm'

function makeTile(x: number, y: number, z: number): OtbmTile {
  return { x, y, z, flags: 0, items: [] }
}

/** Expose protected methods for testing. */
class TestableSpawnOverlay extends SpawnOverlay {
  public shouldDrawTile(tile: OtbmTile): boolean { return super.shouldDrawTile(tile) }
  public drawTile(g: Graphics, tile: OtbmTile): void { super.drawTile(g, tile) }
  public hasActiveSelection(): boolean { return super.hasActiveSelection() }
}

/** Intercept Graphics.fill() calls to capture the first fill's color/alpha args. */
function spyOnFill(g: Graphics): { color: number; alpha: number } {
  const spy = { color: 0, alpha: 0 }
  let captured = false
  const origFill = g.fill.bind(g)
  g.fill = ((opts: { color: number; alpha: number }) => {
    if (!captured) {
      spy.color = opts.color
      spy.alpha = opts.alpha
      captured = true
    }
    return origFill(opts)
  }) as typeof g.fill
  return spy
}

describe('SpawnOverlay', () => {
  let sm: SpawnManager
  let monsterOverlay: TestableSpawnOverlay
  let npcOverlay: TestableSpawnOverlay

  beforeEach(() => {
    sm = new SpawnManager()
    monsterOverlay = new TestableSpawnOverlay(sm, 'monster', 0xCC4400, 0xFF6600)
    npcOverlay = new TestableSpawnOverlay(sm, 'npc', 0x2288CC, 0x44BBFF)
  })

  describe('shouldDrawTile', () => {
    it('returns false for tiles outside any spawn', () => {
      const tile = makeTile(100, 100, 7)
      expect(monsterOverlay.shouldDrawTile(tile)).toBe(false)
    })

    it('returns true for tiles covered by a monster spawn', () => {
      sm.addMonsterSpawn(100, 100, 7, 2)
      const tile = makeTile(101, 100, 7)
      expect(monsterOverlay.shouldDrawTile(tile)).toBe(true)
    })

    it('returns false for monster overlay when only NPC spawn covers the tile', () => {
      sm.addNpcSpawn(100, 100, 7, 2)
      const tile = makeTile(101, 100, 7)
      expect(monsterOverlay.shouldDrawTile(tile)).toBe(false)
    })

    it('returns true for NPC overlay on NPC-covered tile', () => {
      sm.addNpcSpawn(100, 100, 7, 2)
      const tile = makeTile(101, 100, 7)
      expect(npcOverlay.shouldDrawTile(tile)).toBe(true)
    })
  })

  describe('drawTile', () => {
    it('draws with base alpha for single spawn coverage', () => {
      sm.addMonsterSpawn(100, 100, 7, 2)
      const tile = makeTile(101, 100, 7)
      const g = new Graphics()
      const fillSpy = spyOnFill(g)

      monsterOverlay.drawTile(g, tile)

      expect(fillSpy.color).toBe(0xCC4400) // non-center color
      expect(fillSpy.alpha).toBeCloseTo(ALPHA_NONE, 2)

      g.destroy()
    })

    it('draws with higher alpha for overlapping spawns', () => {
      sm.addMonsterSpawn(100, 100, 7, 3)
      sm.addMonsterSpawn(102, 100, 7, 3)
      // Tile at 101,100 is covered by both spawns (count=2)
      const tile = makeTile(101, 100, 7)
      const g = new Graphics()
      const fillSpy = spyOnFill(g)

      monsterOverlay.drawTile(g, tile)

      expect(fillSpy.alpha).toBeGreaterThan(ALPHA_NONE)

      g.destroy()
    })

    it('draws spawn center with base color (same as other tiles)', () => {
      sm.addMonsterSpawn(100, 100, 7, 2)
      const centerTile = makeTile(100, 100, 7) // this is the spawn center
      const g = new Graphics()
      const fillSpy = spyOnFill(g)

      monsterOverlay.drawTile(g, centerTile)

      expect(fillSpy.color).toBe(0xCC4400) // base color, same as non-center tiles

      g.destroy()
    })
  })

  describe('hasActiveSelection', () => {
    it('always returns false', () => {
      expect(monsterOverlay.hasActiveSelection()).toBe(false)
    })
  })

  describe('visibility', () => {
    it('starts hidden', () => {
      expect(monsterOverlay.visible).toBe(false)
    })

    it('can be toggled', () => {
      monsterOverlay.setVisible(true)
      expect(monsterOverlay.visible).toBe(true)
      monsterOverlay.setVisible(false)
      expect(monsterOverlay.visible).toBe(false)
    })
  })
})
