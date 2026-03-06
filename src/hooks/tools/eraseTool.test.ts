import { describe, it, expect } from 'vitest'
import { createEraseHandlers } from './eraseTool'
import { makeToolContext } from '../../test/toolFixtures'

describe('eraseTool', () => {
  describe('onDown', () => {
    it('begins batch "Erase items" and calls removeTopItem for single tile', () => {
      const { ctx, mutator } = makeToolContext()
      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.beginBatch).toHaveBeenCalledWith('Erase items')
      expect(mutator.removeTopItem).toHaveBeenCalledWith(5, 5, 7)
      expect(mutator.removeTopItem).toHaveBeenCalledTimes(1)
    })

    it('erases all tiles in brush footprint (size > 0)', () => {
      const { ctx, mutator } = makeToolContext({ brushSize: 1 })
      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      // size=1 square = 9 tiles
      expect(mutator.removeTopItem).toHaveBeenCalledTimes(9)
    })

    it('calls flushChunkUpdates after erasing', () => {
      const { ctx, mutator } = makeToolContext()
      const callOrder: string[] = []
      mutator.removeTopItem.mockImplementation(() => { callOrder.push('removeTopItem') })
      mutator.flushChunkUpdates.mockImplementation(() => { callOrder.push('flushChunkUpdates') })

      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(callOrder[callOrder.length - 1]).toBe('flushChunkUpdates')
    })
  })

  describe('onMove', () => {
    it('erases only NEW tiles not in paintedTilesRef', () => {
      const { ctx, mutator } = makeToolContext()
      const { onDown, onMove } = createEraseHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 })
      expect(mutator.removeTopItem).toHaveBeenCalledTimes(1)

      onMove({ x: 5, y: 5, z: 7 }) // same tile
      expect(mutator.removeTopItem).toHaveBeenCalledTimes(1) // no new call
    })

    it('skips already-erased tiles', () => {
      const { ctx, mutator } = makeToolContext()
      const { onDown, onMove } = createEraseHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 })
      onMove({ x: 6, y: 5, z: 7 })
      onMove({ x: 5, y: 5, z: 7 }) // already done

      // 1 from onDown + 1 from first onMove
      expect(mutator.removeTopItem).toHaveBeenCalledTimes(2)
    })

    it('accumulates erased tiles across moves', () => {
      const { ctx, mutator } = makeToolContext()
      const { onDown, onMove } = createEraseHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 })
      onMove({ x: 6, y: 5, z: 7 })
      onMove({ x: 7, y: 5, z: 7 })

      expect(mutator.removeTopItem).toHaveBeenCalledTimes(3)
      expect(mutator.removeTopItem).toHaveBeenCalledWith(5, 5, 7)
      expect(mutator.removeTopItem).toHaveBeenCalledWith(6, 5, 7)
      expect(mutator.removeTopItem).toHaveBeenCalledWith(7, 5, 7)
    })
  })
})
