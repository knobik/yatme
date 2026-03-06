import { describe, it, expect, vi } from 'vitest'
import { createDrawHandlers } from './drawTool'
import { makeToolContext } from '../../test/toolFixtures'
import { makeGroundBrush, makeMinimalRegistry } from '../../test/brushFixtures'

// Mock resolveBrush — we control what brush is "selected"
vi.mock('./types', async (importOriginal) => {
  const original = await importOriginal<typeof import('./types')>()
  return {
    ...original,
    resolveBrush: vi.fn(() => ({ type: 'raw' as const, itemId: 0 })),
  }
})

import { resolveBrush } from './types'
const mockResolveBrush = vi.mocked(resolveBrush)

describe('drawTool', () => {
  const grassBrush = makeGroundBrush({
    id: 1, name: 'grass',
    items: [{ id: 10, chance: 100 }], totalChance: 100,
  })
  const registry = makeMinimalRegistry({ groundBrushes: [grassBrush] })

  describe('onDown', () => {
    it('clears paintedTilesRef and begins batch with brushBatchName', () => {
      mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
      })
      ctx.paintedTilesRef.current.add('old')

      const { onDown } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(ctx.paintedTilesRef.current.has('old')).toBe(false)
      expect(mutator.beginBatch).toHaveBeenCalledWith('Paint ground')
    })

    it('applies brush to all tiles in brush footprint (size=0 -> 1 tile)', () => {
      mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
      })

      const { onDown } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.paintGround).toHaveBeenCalledTimes(1)
      expect(mutator.paintGround).toHaveBeenCalledWith(5, 5, 7, grassBrush)
    })

    it('applies brush to multi-tile footprint (size=1 -> 9 tiles)', () => {
      mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
        brushSize: 1,
      })

      const { onDown } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.paintGround).toHaveBeenCalledTimes(9)
    })

    it('calls flushChunkUpdates after painting', () => {
      mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
      })

      const callOrder: string[] = []
      mutator.paintGround.mockImplementation(() => { callOrder.push('paintGround') })
      mutator.flushChunkUpdates.mockImplementation(() => { callOrder.push('flushChunkUpdates') })

      const { onDown } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(callOrder[callOrder.length - 1]).toBe('flushChunkUpdates')
    })

    it('no-op when no brush selected (selectedBrushRef is null)', () => {
      const { ctx, mutator } = makeToolContext({ selectedBrush: null })
      const { onDown } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.beginBatch).not.toHaveBeenCalled()
    })
  })

  describe('onMove', () => {
    it('paints only NEW tiles not already in paintedTilesRef', () => {
      mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
      })

      const { onDown, onMove } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })
      expect(mutator.paintGround).toHaveBeenCalledTimes(1)

      onMove({ x: 5, y: 5, z: 7 }) // same tile
      expect(mutator.paintGround).toHaveBeenCalledTimes(1) // no new call
    })

    it('skips tiles already painted on onDown', () => {
      mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
      })

      const { onDown, onMove } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })
      onMove({ x: 6, y: 5, z: 7 }) // new tile
      onMove({ x: 5, y: 5, z: 7 }) // already done on onDown

      expect(mutator.paintGround).toHaveBeenCalledTimes(2) // 1 onDown + 1 new onMove
    })

    it('accumulates painted tile keys across multiple onMove calls', () => {
      mockResolveBrush.mockReturnValue({ type: 'ground', brush: grassBrush })
      const { ctx, mutator } = makeToolContext({
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
      })

      const { onDown, onMove } = createDrawHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })
      onMove({ x: 6, y: 5, z: 7 })
      onMove({ x: 7, y: 5, z: 7 })
      onMove({ x: 6, y: 5, z: 7 }) // already done

      expect(mutator.paintGround).toHaveBeenCalledTimes(3) // 3 unique tiles
    })
  })
})
