import { describe, it, expect, vi } from 'vitest'
import { CopyBuffer, removeSelectedItems } from './CopyBuffer'
import { MapMutator } from './MapMutator'
import { makeAppearanceData, makeMapData, makeTile, makeItem } from '../test/fixtures'
import type { AppearanceFlags } from '../proto/appearances'
import type { SelectedItemInfo } from '../hooks/useSelection'

const GROUND_ID = 100
const COMMON_ID = 300

function makeTestSetup(tiles = [
  makeTile(10, 10, 7, [makeItem({ id: GROUND_ID }), makeItem({ id: COMMON_ID })]),
  makeTile(11, 10, 7, [makeItem({ id: COMMON_ID })]),
]) {
  const appearances = makeAppearanceData([
    [GROUND_ID, { bank: { waypoints: 0 } as AppearanceFlags['bank'] }],
    [COMMON_ID, {}],
  ])
  const mapData = makeMapData(tiles)
  const mutator = new MapMutator(mapData, appearances)
  const renderer = { updateChunkIndex: vi.fn() }
  return { mapData, mutator, appearances, renderer }
}

function sel(x: number, y: number, z: number, itemIndex: number): SelectedItemInfo {
  return { x, y, z, itemIndex }
}

describe('CopyBuffer', () => {
  describe('copy', () => {
    it('copies selected items with relative offsets', () => {
      const { mapData } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 0), sel(11, 10, 7, 0)], mapData)
      expect(buffer.canPaste()).toBe(true)
      expect(buffer.getTileCount()).toBe(2)
    })

    it('empty selection results in empty buffer', () => {
      const { mapData } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([], mapData)
      expect(buffer.canPaste()).toBe(false)
      expect(buffer.getTileCount()).toBe(0)
    })

    it('origin computed as min(x,y,z) of selection', () => {
      const { mapData } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 0), sel(11, 10, 7, 0)], mapData)
      expect(buffer.getOrigin()).toEqual({ x: 10, y: 10, z: 7 })
    })

    it('items are deep-cloned', () => {
      const { mapData } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 1)], mapData)

      // Modify original
      mapData.tiles.get('10,10,7')!.items[1].id = 999

      // Buffer should retain original value
      const tiles = [...buffer.getTiles()]
      expect(tiles[0].items[0].id).toBe(COMMON_ID)
    })
  })

  describe('paste', () => {
    it('pastes items at target position with correct offsets', () => {
      const { mapData, mutator, renderer } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 1), sel(11, 10, 7, 0)], mapData)

      // Paste at (20, 20, 7) — offsets are (0,0,0) and (1,0,0) relative to origin (10,10,7)
      buffer.paste(20, 20, 7, mutator, renderer, false, false)

      expect(mapData.tiles.get('20,20,7')).toBeDefined()
      expect(mapData.tiles.get('21,20,7')).toBeDefined()
      expect(renderer.updateChunkIndex).toHaveBeenCalledTimes(2)
    })

    it('empty buffer produces no mutations', () => {
      const { mutator, renderer } = makeTestSetup()
      const buffer = new CopyBuffer()
      const result = buffer.paste(20, 20, 7, mutator, renderer, false, false)
      expect(result).toEqual([])
    })

    it('mergePaste=false uses setTileItems (full replace)', () => {
      const { mapData, mutator, renderer } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 1)], mapData) // copy COMMON_ID

      // Pre-populate target
      mutator.addItem(20, 20, 7, makeItem({ id: GROUND_ID }))

      buffer.paste(20, 20, 7, mutator, renderer, false, false)
      const tile = mapData.tiles.get('20,20,7')!
      // Full replace: only the pasted item
      expect(tile.items.map(i => i.id)).toEqual([COMMON_ID])
    })

    it('mergePaste=true uses mergePasteItems (merge)', () => {
      const { mapData, mutator, renderer } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 1)], mapData) // copy COMMON_ID

      // Pre-populate target
      mutator.addItem(20, 20, 7, makeItem({ id: GROUND_ID }))

      buffer.paste(20, 20, 7, mutator, renderer, true, false)
      const tile = mapData.tiles.get('20,20,7')!
      // Merge: ground preserved + pasted COMMON_ID appended
      expect(tile.items.find(i => i.id === GROUND_ID)).toBeDefined()
      expect(tile.items.find(i => i.id === COMMON_ID)).toBeDefined()
    })
  })

  describe('cut', () => {
    it('copies then removes source items', () => {
      const { mapData, mutator } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.cut([sel(10, 10, 7, 1)], mapData, mutator, false)

      // Buffer should have the item
      expect(buffer.canPaste()).toBe(true)
      const tiles = [...buffer.getTiles()]
      expect(tiles[0].items[0].id).toBe(COMMON_ID)

      // Source should have it removed
      const sourceTile = mapData.tiles.get('10,10,7')!
      expect(sourceTile.items.find(i => i.id === COMMON_ID)).toBeUndefined()
    })

    it('undo restores cut items', () => {
      const { mapData, mutator } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.cut([sel(10, 10, 7, 1)], mapData, mutator, false)
      mutator.undo()
      const sourceTile = mapData.tiles.get('10,10,7')!
      expect(sourceTile.items.find(i => i.id === COMMON_ID)).toBeDefined()
    })
  })

  describe('serialize / deserialize', () => {
    it('round-trip preserves tile offsets and items', () => {
      const { mapData } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 0), sel(11, 10, 7, 0)], mapData)

      const json = buffer.serialize()
      const restored = CopyBuffer.deserialize(json)

      expect(restored.getTileCount()).toBe(buffer.getTileCount())
      expect(restored.getOrigin()).toEqual(buffer.getOrigin())
      expect(restored.getBounds()).toEqual(buffer.getBounds())
    })

    it('item attributes survive round-trip', () => {
      const tiles = [
        makeTile(10, 10, 7, [makeItem({ id: COMMON_ID, actionId: 42, text: 'hello' })]),
      ]
      const { mapData } = makeTestSetup(tiles)
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 0)], mapData)

      const restored = CopyBuffer.deserialize(buffer.serialize())
      const restoredTiles = [...restored.getTiles()]
      expect(restoredTiles[0].items[0].actionId).toBe(42)
      expect(restoredTiles[0].items[0].text).toBe('hello')
    })

    it('deserialized buffer can paste correctly', () => {
      const { mapData, mutator, renderer } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 1)], mapData)

      const restored = CopyBuffer.deserialize(buffer.serialize())
      restored.paste(30, 30, 7, mutator, renderer, false, false)

      const tile = mapData.tiles.get('30,30,7')
      expect(tile).toBeDefined()
      expect(tile!.items[0].id).toBe(COMMON_ID)
    })
  })

  describe('canPaste / clear / getTileCount / getBounds', () => {
    it('canPaste false initially, true after copy', () => {
      const buffer = new CopyBuffer()
      expect(buffer.canPaste()).toBe(false)

      const { mapData } = makeTestSetup()
      buffer.copy([sel(10, 10, 7, 0)], mapData)
      expect(buffer.canPaste()).toBe(true)
    })

    it('clear empties buffer', () => {
      const { mapData } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 0)], mapData)
      buffer.clear()
      expect(buffer.canPaste()).toBe(false)
      expect(buffer.getTileCount()).toBe(0)
    })

    it('getBounds returns correct dimensions', () => {
      const { mapData } = makeTestSetup()
      const buffer = new CopyBuffer()
      buffer.copy([sel(10, 10, 7, 0), sel(11, 10, 7, 0)], mapData)
      const bounds = buffer.getBounds()
      expect(bounds.width).toBe(2) // dx 0 and 1 -> width = 1+1
      expect(bounds.height).toBe(1) // dy 0 -> height = 0+1
      expect(bounds.minDz).toBe(0)
      expect(bounds.maxDz).toBe(0)
    })
  })

  describe('removeSelectedItems', () => {
    it('removes items at specified indices from map tiles', () => {
      const { mapData, mutator } = makeTestSetup()
      const affected = removeSelectedItems([sel(10, 10, 7, 1)], mapData, mutator)
      expect(affected).toHaveLength(1)
      expect(affected[0]).toEqual({ x: 10, y: 10, z: 7 })
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(1) // only ground remains
    })

    it('when all items selected, clears tile', () => {
      const { mapData, mutator } = makeTestSetup()
      removeSelectedItems([sel(10, 10, 7, 0), sel(10, 10, 7, 1)], mapData, mutator)
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(0)
    })
  })
})
