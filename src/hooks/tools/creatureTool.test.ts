import { describe, it, expect, vi } from 'vitest'
import { createCreatureHandlers } from './creatureTool'
import { makeToolContext, makePointerEvent } from '../../test/toolFixtures'
import type { BrushSelection } from './types'

// Mock the creatureBrushes module
vi.mock('../../lib/creatures/creatureBrushes', () => ({
  applyCreatureBrush: vi.fn(),
  eraseCreatureBrush: vi.fn(),
}))

import { applyCreatureBrush, eraseCreatureBrush } from '../../lib/creatures/creatureBrushes'
const mockApply = applyCreatureBrush as ReturnType<typeof vi.fn>
const mockErase = eraseCreatureBrush as ReturnType<typeof vi.fn>

describe('creatureTool', () => {
  beforeEach(() => {
    mockApply.mockClear()
    mockErase.mockClear()
  })

  describe('isReady', () => {
    it('does nothing when no creature/spawn selection', () => {
      const { ctx, mutator } = makeToolContext({ selectedBrush: null })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      expect(mutator.beginBatch).not.toHaveBeenCalled()
    })

    it('does nothing when brush selection is not creature or spawn mode', () => {
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'raw', itemId: 100 },
      })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      expect(mutator.beginBatch).not.toHaveBeenCalled()
    })
  })

  describe('creature placement', () => {
    const monsterSel: BrushSelection = { mode: 'creature', creatureName: 'Rat', isNpc: false }

    it('calls applyCreatureBrush on down', () => {
      const { ctx } = makeToolContext({ selectedBrush: monsterSel })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      expect(mockApply).toHaveBeenCalledTimes(1)
      const args = mockApply.mock.calls[0]
      expect(args[0]).toBe(monsterSel)
      expect(args[1]).toBe(ctx.mutator)
      expect(args[2]).toBe(5) // x
      expect(args[3]).toBe(5) // y
      expect(args[4]).toBe(7) // z
      expect(args[5]).toEqual(expect.objectContaining({ spawnTime: 60, weight: 100, autoCreateSpawn: true }))
      expect(args[6]).toBe(ctx.mapData)
    })

    it('smears to new tiles on move', () => {
      const { ctx } = makeToolContext({ selectedBrush: monsterSel })
      const { onDown, onMove } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 6, y: 5, z: 7 })

      expect(mockApply).toHaveBeenCalledTimes(2)
    })

    it('skips already-painted tiles on move', () => {
      const { ctx } = makeToolContext({ selectedBrush: monsterSel })
      const { onDown, onMove } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 5, y: 5, z: 7 }) // same tile
      expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('commits batch on up', () => {
      const { ctx, mutator } = makeToolContext({ selectedBrush: monsterSel })
      const { onDown, onUp } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onUp()
      expect(mutator.commitBatch).toHaveBeenCalled()
    })
  })

  describe('creature erasure (right-click)', () => {
    const monsterSel: BrushSelection = { mode: 'creature', creatureName: 'Rat', isNpc: false }

    it('calls eraseCreatureBrush on right-click', () => {
      const { ctx } = makeToolContext({ selectedBrush: monsterSel })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ button: 2 }))

      expect(mockErase).toHaveBeenCalledTimes(1)
      expect(mockErase).toHaveBeenCalledWith(monsterSel, ctx.mutator, 5, 5, 7)
      expect(mockApply).not.toHaveBeenCalled()
    })

    it('calls eraseCreatureBrush on ctrl+click', () => {
      const { ctx } = makeToolContext({ selectedBrush: monsterSel })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ ctrlKey: true }))

      expect(mockErase).toHaveBeenCalledTimes(1)
      expect(mockApply).not.toHaveBeenCalled()
    })
  })

  describe('spawn mode', () => {
    const spawnMonsterSel: BrushSelection = { mode: 'spawn', spawnType: 'monster' }

    it('calls applyCreatureBrush with spawn selection', () => {
      const { ctx } = makeToolContext({ selectedBrush: spawnMonsterSel })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      expect(mockApply).toHaveBeenCalledTimes(1)
      const args = mockApply.mock.calls[0]
      expect(args[0]).toBe(spawnMonsterSel)
      expect(args[1]).toBe(ctx.mutator)
      expect(args[6]).toBe(ctx.mapData)
    })

    it('uses spawnRadius for spawn placement', () => {
      const { ctx } = makeToolContext({ selectedBrush: spawnMonsterSel, spawnRadius: 5 })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      // Creature tool always paints single tile — spawnRadius is passed to applyCreatureBrush
      expect(mockApply).toHaveBeenCalledTimes(1)
      const lastCall = mockApply.mock.calls[0]
      expect(lastCall[lastCall.length - 1]).toBe(5)
    })
  })

  describe('config from refs', () => {
    const monsterSel: BrushSelection = { mode: 'creature', creatureName: 'Rat', isNpc: false }

    it('reads spawnTime from creatureSpawnTimeRef', () => {
      const { ctx } = makeToolContext({ selectedBrush: monsterSel })
      ctx.creatureSpawnTimeRef = { current: 120 }
      ctx.creatureWeightRef = { current: 50 }
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      const args = mockApply.mock.calls[0]
      expect(args[5]).toEqual(expect.objectContaining({ spawnTime: 120, weight: 50 }))
    })

    it('reads weight from creatureWeightRef', () => {
      const { ctx } = makeToolContext({ selectedBrush: monsterSel })
      ctx.creatureSpawnTimeRef = { current: 60 }
      ctx.creatureWeightRef = { current: 200 }
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      const args = mockApply.mock.calls[0]
      expect(args[5]).toEqual(expect.objectContaining({ weight: 200 }))
    })
  })

  describe('autoCreateSpawn setting', () => {
    const monsterSel: BrushSelection = { mode: 'creature', creatureName: 'Rat', isNpc: false }

    it('passes autoCreateSpawn from settings', () => {
      const { ctx } = makeToolContext({
        selectedBrush: monsterSel,
        settings: { autoCreateSpawn: false },
      })
      const { onDown } = createCreatureHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      const args = mockApply.mock.calls[0]
      expect(args[5]).toEqual(expect.objectContaining({ autoCreateSpawn: false }))
    })
  })
})
