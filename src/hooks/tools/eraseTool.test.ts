import { describe, it, expect } from 'vitest'
import { createEraseHandlers } from './eraseTool'
import { makeToolContext } from '../../test/toolFixtures'
import type { OtbmMap } from '../../lib/otbm'

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

  describe('creature and spawn erasure', () => {
    it('removes monsters from tile', () => {
      const mapData = {
        version: 2, width: 1024, height: 1024, description: '', spawnFile: '', houseFile: '',
        tiles: new Map([['5,5,7', { x: 5, y: 5, z: 7, flags: 0, items: [], monsters: [{ name: 'Rat', direction: 2, spawnTime: 60, isNpc: false }] }]]),
        towns: [], waypoints: [],
      }
      const { ctx, mutator } = makeToolContext({ mapData: mapData as unknown as OtbmMap })
      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.removeCreature).toHaveBeenCalledWith(5, 5, 7, 'Rat', false)
    })

    it('removes NPC from tile', () => {
      const mapData = {
        version: 2, width: 1024, height: 1024, description: '', spawnFile: '', houseFile: '',
        tiles: new Map([['5,5,7', { x: 5, y: 5, z: 7, flags: 0, items: [], npc: { name: 'Shopkeeper', direction: 2, spawnTime: 60, isNpc: true } }]]),
        towns: [], waypoints: [],
      }
      const { ctx, mutator } = makeToolContext({ mapData: mapData as unknown as OtbmMap })
      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.removeCreature).toHaveBeenCalledWith(5, 5, 7, 'Shopkeeper', true)
    })

    it('removes spawn zones from tile', () => {
      const mapData = {
        version: 2, width: 1024, height: 1024, description: '', spawnFile: '', houseFile: '',
        tiles: new Map([['5,5,7', { x: 5, y: 5, z: 7, flags: 0, items: [], spawnMonster: { radius: 3 }, spawnNpc: { radius: 2 } }]]),
        towns: [], waypoints: [],
      }
      const { ctx, mutator } = makeToolContext({ mapData: mapData as unknown as OtbmMap })
      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.removeSpawnZone).toHaveBeenCalledWith(5, 5, 7, 'monster')
      expect(mutator.removeSpawnZone).toHaveBeenCalledWith(5, 5, 7, 'npc')
    })

    it('erases items, creatures, and spawns together', () => {
      const mapData = {
        version: 2, width: 1024, height: 1024, description: '', spawnFile: '', houseFile: '',
        tiles: new Map([['5,5,7', {
          x: 5, y: 5, z: 7, flags: 0, items: [{ id: 100 }],
          monsters: [{ name: 'Rat', direction: 2, spawnTime: 60, isNpc: false }],
          npc: { name: 'Shopkeeper', direction: 2, spawnTime: 60, isNpc: true },
          spawnMonster: { radius: 3 },
        }]]),
        towns: [], waypoints: [],
      }
      const { ctx, mutator } = makeToolContext({ mapData: mapData as unknown as OtbmMap })
      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      expect(mutator.removeTopItem).toHaveBeenCalledWith(5, 5, 7)
      expect(mutator.removeCreature).toHaveBeenCalledWith(5, 5, 7, 'Rat', false)
      expect(mutator.removeCreature).toHaveBeenCalledWith(5, 5, 7, 'Shopkeeper', true)
      expect(mutator.removeSpawnZone).toHaveBeenCalledWith(5, 5, 7, 'monster')
    })

    it('does not call creature/spawn removal for tiles without them', () => {
      const { ctx, mutator } = makeToolContext()
      const { onDown } = createEraseHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 })

      // mapData has no tiles at 5,5,7 so no creature/spawn removal
      expect(mutator.removeCreature).not.toHaveBeenCalled()
      expect(mutator.removeSpawnZone).not.toHaveBeenCalled()
    })
  })
})
