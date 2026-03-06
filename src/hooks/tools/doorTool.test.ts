import { describe, it, expect } from 'vitest'
import { createDoorHandlers } from './doorTool'
import { makeToolContext } from '../../test/toolFixtures'
import { makeMinimalRegistry } from '../../test/brushFixtures'

describe('doorTool', () => {
  describe('onDown', () => {
    it('begins batch and calls paintDoor with activeDoorType', () => {
      const registry = makeMinimalRegistry()
      const { ctx, mutator } = makeToolContext({ registry, activeDoorType: 5 })
      const { onDown } = createDoorHandlers(ctx)
      onDown({ x: 10, y: 10, z: 7 })

      expect(mutator.beginBatch).toHaveBeenCalledWith('Place door')
      expect(mutator.paintDoor).toHaveBeenCalledWith(10, 10, 7, 5)
    })

    it('paints door on all tiles in brush footprint', () => {
      const registry = makeMinimalRegistry()
      const { ctx, mutator } = makeToolContext({ registry, activeDoorType: 3, brushSize: 1 })
      const { onDown } = createDoorHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      // size=1 square = 9 tiles
      expect(mutator.paintDoor).toHaveBeenCalledTimes(9)
    })

    it('no-op when brushRegistryRef is null', () => {
      const { ctx, mutator } = makeToolContext({ registry: null, activeDoorType: 5 })
      const { onDown } = createDoorHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.beginBatch).not.toHaveBeenCalled()
      expect(mutator.paintDoor).not.toHaveBeenCalled()
    })
  })

  describe('onMove', () => {
    it('paints only new tiles not in paintedTilesRef', () => {
      const registry = makeMinimalRegistry()
      const { ctx, mutator } = makeToolContext({ registry, activeDoorType: 2 })
      const { onDown, onMove } = createDoorHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 })
      onMove({ x: 5, y: 5, z: 7 }) // same tile
      expect(mutator.paintDoor).toHaveBeenCalledTimes(1)
    })

    it('uses correct door type from activeDoorTypeRef', () => {
      const registry = makeMinimalRegistry()
      const { ctx, mutator } = makeToolContext({ registry, activeDoorType: 7 })
      const { onDown, onMove } = createDoorHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 })
      onMove({ x: 6, y: 5, z: 7 })

      expect(mutator.paintDoor).toHaveBeenCalledWith(6, 5, 7, 7)
    })

    it('calls flushChunkUpdates after painting', () => {
      const registry = makeMinimalRegistry()
      const { ctx, mutator } = makeToolContext({ registry, activeDoorType: 1 })
      const { onDown, onMove } = createDoorHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 })
      mutator.flushChunkUpdates.mockClear()

      onMove({ x: 6, y: 5, z: 7 })
      expect(mutator.flushChunkUpdates).toHaveBeenCalledTimes(1)
    })
  })
})
