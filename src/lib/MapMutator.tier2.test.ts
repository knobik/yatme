import { describe, it, expect, vi } from 'vitest'
import { MapMutator } from './MapMutator'
import { makeAppearanceData, makeMapData, makeTile, makeItem } from '../test/fixtures'
import type { AppearanceFlags } from '../proto/appearances'
import { BrushRegistry } from './brushes/BrushRegistry'
import { createGroundBrush, type GroundBrush } from './brushes/BrushTypes'
import { makeWallBrushWithItems, makeCarpetBrushWithItems, makeTableBrushWithItems, makeDoodadBrush, makeMinimalRegistry } from '../test/brushFixtures'
import { WALL_POLE, WALL_VERTICAL, WALL_HORIZONTAL } from './brushes/WallTypes'
import { CARPET_CENTER, TABLE_ALONE } from './brushes/CarpetTypes'

// Item IDs by layer
const GROUND_ID = 100
const BOTTOM_ID = 200
const COMMON_ID = 300
const TOP_ID = 400
const GROUND_ID_2 = 101
const WALL_ITEM_POLE = 500
const WALL_ITEM_VERT = 501
const WALL_ITEM_HORIZ = 502
const DOOR_CLOSED = 510
const DOOR_OPEN = 511
const CARPET_CENTER_ID = 600
const CARPET_NORTH_ID = 601
const TABLE_ALONE_ID = 700
const DOODAD_SINGLE = 800
const DOODAD_COMP_A = 801
const DOODAD_COMP_B = 802

function makeLayeredAppearances() {
  return makeAppearanceData([
    [GROUND_ID, { bank: { waypoints: 0 } as AppearanceFlags['bank'] }],
    [GROUND_ID_2, { bank: { waypoints: 0 } as AppearanceFlags['bank'] }],
    [BOTTOM_ID, { bottom: true }],
    [COMMON_ID, {}],
    [TOP_ID, { top: true }],
    [WALL_ITEM_POLE, {}],
    [WALL_ITEM_VERT, {}],
    [WALL_ITEM_HORIZ, {}],
    [DOOR_CLOSED, {}],
    [DOOR_OPEN, {}],
    [CARPET_CENTER_ID, {}],
    [CARPET_NORTH_ID, {}],
    [TABLE_ALONE_ID, {}],
    [DOODAD_SINGLE, {}],
    [DOODAD_COMP_A, {}],
    [DOODAD_COMP_B, {}],
  ])
}

function makeMutator(tiles: ReturnType<typeof makeTile>[] = []) {
  const appearances = makeLayeredAppearances()
  const mapData = makeMapData(tiles)
  const mutator = new MapMutator(mapData, appearances)
  return { mutator, mapData, appearances }
}

describe('MapMutator — Tier 2', () => {
  describe('addItem layer insertion', () => {
    it('ground item placed at index 0', () => {
      const { mutator, mapData } = makeMutator([makeTile(10, 10, 7)])
      mutator.addItem(10, 10, 7, makeItem({ id: GROUND_ID }))
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items[0].id).toBe(GROUND_ID)
    })

    it('ground item replaces existing ground', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })]),
      ])
      mutator.addItem(10, 10, 7, makeItem({ id: GROUND_ID_2 }))
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items.length).toBe(1)
      expect(tile.items[0].id).toBe(GROUND_ID_2)
    })

    it('bottom item inserted after ground', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })]),
      ])
      mutator.addItem(10, 10, 7, makeItem({ id: BOTTOM_ID }))
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items[0].id).toBe(GROUND_ID)
      expect(tile.items[1].id).toBe(BOTTOM_ID)
    })

    it('common item inserted after bottom items', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID }), makeItem({ id: BOTTOM_ID })]),
      ])
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items[0].id).toBe(GROUND_ID)
      expect(tile.items[1].id).toBe(BOTTOM_ID)
      expect(tile.items[2].id).toBe(COMMON_ID)
    })

    it('top item inserted at end', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [
          makeItem({ id: GROUND_ID }),
          makeItem({ id: BOTTOM_ID }),
          makeItem({ id: COMMON_ID }),
        ]),
      ])
      mutator.addItem(10, 10, 7, makeItem({ id: TOP_ID }))
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items[3].id).toBe(TOP_ID)
    })

    it('creates tile if it does not exist', () => {
      const { mutator, mapData } = makeMutator()
      mutator.addItem(5, 5, 7, makeItem({ id: COMMON_ID }))
      const tile = mapData.tiles.get('5,5,7')
      expect(tile).toBeDefined()
      expect(tile!.items[0].id).toBe(COMMON_ID)
    })
  })

  describe('removeItem', () => {
    it('removes item at valid index', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID }), makeItem({ id: COMMON_ID })]),
      ])
      mutator.removeItem(10, 10, 7, 1)
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items.length).toBe(1)
      expect(tile.items[0].id).toBe(GROUND_ID)
    })

    it('no-op for negative index', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: COMMON_ID })]),
      ])
      mutator.removeItem(10, 10, 7, -1)
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(1)
    })

    it('no-op for nonexistent tile', () => {
      const { mutator } = makeMutator()
      // Should not throw
      mutator.removeItem(99, 99, 7, 0)
    })
  })

  describe('removeTopItem', () => {
    it('removes topmost non-ground item', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [
          makeItem({ id: GROUND_ID }),
          makeItem({ id: COMMON_ID }),
          makeItem({ id: TOP_ID }),
        ]),
      ])
      mutator.removeTopItem(10, 10, 7)
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items.length).toBe(2)
      expect(tile.items.map(i => i.id)).toEqual([GROUND_ID, COMMON_ID])
    })

    it('falls back to ground when only ground exists', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })]),
      ])
      mutator.removeTopItem(10, 10, 7)
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(0)
    })

    it('no-op on empty tile', () => {
      const { mutator, mapData } = makeMutator([makeTile(10, 10, 7)])
      mutator.removeTopItem(10, 10, 7)
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(0)
    })
  })

  describe('setTileItems', () => {
    it('replaces all items, creates tile if needed', () => {
      const { mutator, mapData } = makeMutator()
      mutator.setTileItems(5, 5, 7, [makeItem({ id: COMMON_ID }), makeItem({ id: TOP_ID })])
      const tile = mapData.tiles.get('5,5,7')!
      expect(tile.items.map(i => i.id)).toEqual([COMMON_ID, TOP_ID])
    })

    it('records old items for undo', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })]),
      ])
      mutator.setTileItems(10, 10, 7, [makeItem({ id: COMMON_ID })])
      mutator.undo()
      expect(mapData.tiles.get('10,10,7')!.items[0].id).toBe(GROUND_ID)
    })
  })

  describe('beginBatch / commitBatch', () => {
    it('multiple mutations produce single undo entry', () => {
      const { mutator, mapData } = makeMutator([makeTile(10, 10, 7)])
      mutator.beginBatch('batch')
      mutator.addItem(10, 10, 7, makeItem({ id: GROUND_ID }))
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      mutator.commitBatch()

      // Single undo should revert both
      mutator.undo()
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(0)
    })

    it('empty batch does not push to undo stack', () => {
      const { mutator } = makeMutator()
      mutator.beginBatch('empty')
      mutator.commitBatch()
      expect(mutator.canUndo()).toBe(false)
    })

    it('committing clears redo stack', () => {
      const { mutator } = makeMutator([makeTile(10, 10, 7)])
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      mutator.undo()
      expect(mutator.canRedo()).toBe(true)

      mutator.addItem(10, 10, 7, makeItem({ id: TOP_ID }))
      expect(mutator.canRedo()).toBe(false)
    })

    it('onChunksInvalidated called once at commit', () => {
      const { mutator } = makeMutator([makeTile(10, 10, 7)])
      const spy = vi.fn()
      mutator.onChunksInvalidated = spy

      mutator.beginBatch('batch')
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      mutator.addItem(10, 10, 7, makeItem({ id: TOP_ID }))
      expect(spy).not.toHaveBeenCalled()
      mutator.commitBatch()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('undo / redo', () => {
    it('single addItem then undo restores original state', () => {
      const { mutator, mapData } = makeMutator([makeTile(10, 10, 7)])
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(1)

      mutator.undo()
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(0)
    })

    it('undo then redo restores mutated state', () => {
      const { mutator, mapData } = makeMutator([makeTile(10, 10, 7)])
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      mutator.undo()
      mutator.redo()
      expect(mapData.tiles.get('10,10,7')!.items[0].id).toBe(COMMON_ID)
    })

    it('multiple batches undo in reverse order', () => {
      const { mutator, mapData } = makeMutator([makeTile(10, 10, 7)])
      mutator.addItem(10, 10, 7, makeItem({ id: GROUND_ID }))
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))

      mutator.undo() // undo COMMON
      expect(mapData.tiles.get('10,10,7')!.items.map(i => i.id)).toEqual([GROUND_ID])

      mutator.undo() // undo GROUND
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(0)
    })

    it('undo when empty does nothing', () => {
      const { mutator } = makeMutator()
      expect(mutator.canUndo()).toBe(false)
      mutator.undo() // should not throw
    })

    it('redo stack cleared when new mutation after undo', () => {
      const { mutator } = makeMutator([makeTile(10, 10, 7)])
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      mutator.undo()
      expect(mutator.canRedo()).toBe(true)

      mutator.addItem(10, 10, 7, makeItem({ id: TOP_ID }))
      expect(mutator.canRedo()).toBe(false)
    })

    it('onUndoRedoChanged callback fires', () => {
      const { mutator } = makeMutator([makeTile(10, 10, 7)])
      const spy = vi.fn()
      mutator.onUndoRedoChanged = spy

      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      expect(spy).toHaveBeenCalledWith(true, false) // canUndo=true, canRedo=false

      mutator.undo()
      expect(spy).toHaveBeenCalledWith(false, true) // canUndo=false, canRedo=true
    })

    it('onTileChanged callback fires on mutation', () => {
      const { mutator } = makeMutator([makeTile(10, 10, 7)])
      const spy = vi.fn()
      mutator.onTileChanged = spy

      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      expect(spy).toHaveBeenCalledWith(10, 10, 7)
    })
  })

  describe('mergePasteItems', () => {
    it('replaces ground and appends non-ground items', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID }), makeItem({ id: COMMON_ID })]),
      ])
      mutator.mergePasteItems(10, 10, 7, [
        makeItem({ id: GROUND_ID_2 }),
        makeItem({ id: TOP_ID }),
      ])
      const items = mapData.tiles.get('10,10,7')!.items
      expect(items[0].id).toBe(GROUND_ID_2) // ground replaced
      expect(items.find(i => i.id === COMMON_ID)).toBeDefined() // original kept
      expect(items.find(i => i.id === TOP_ID)).toBeDefined() // pasted appended
    })

    it('creates tile if it does not exist', () => {
      const { mutator, mapData } = makeMutator()
      mutator.mergePasteItems(5, 5, 7, [makeItem({ id: COMMON_ID })])
      expect(mapData.tiles.get('5,5,7')).toBeDefined()
      expect(mapData.tiles.get('5,5,7')!.items[0].id).toBe(COMMON_ID)
    })

    it('non-ground items inserted at correct layer positions', () => {
      const { mutator, mapData } = makeMutator([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID })]),
      ])
      mutator.mergePasteItems(10, 10, 7, [
        makeItem({ id: TOP_ID }),
        makeItem({ id: BOTTOM_ID }),
      ])
      const ids = mapData.tiles.get('10,10,7')!.items.map(i => i.id)
      // Order should be: ground, bottom, top
      expect(ids.indexOf(GROUND_ID)).toBeLessThan(ids.indexOf(BOTTOM_ID))
      expect(ids.indexOf(BOTTOM_ID)).toBeLessThan(ids.indexOf(TOP_ID))
    })
  })

  describe('paintGround', () => {
    function makeGroundBrush(overrides: Partial<GroundBrush> = {}): GroundBrush {
      return { ...createGroundBrush(), ...overrides }
    }

    function makePaintSetup() {
      const appearances = makeLayeredAppearances()
      const brush = makeGroundBrush({
        id: 1, name: 'grass',
        items: [{ id: GROUND_ID, chance: 100 }],
        totalChance: 100,
      })
      const registry = new BrushRegistry([brush], new Map())
      return { appearances, brush, registry }
    }

    it('replaces ground item on tile', () => {
      const { appearances, brush, registry } = makePaintSetup()
      const mapData = makeMapData([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID_2 })]),
      ])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintGround(10, 10, 7, brush)
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items[0].id).toBe(GROUND_ID)
    })

    it('creates tile if it does not exist', () => {
      const { appearances, brush, registry } = makePaintSetup()
      const mapData = makeMapData()
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintGround(5, 5, 7, brush)
      const tile = mapData.tiles.get('5,5,7')
      expect(tile).toBeDefined()
      expect(tile!.items[0].id).toBe(GROUND_ID)
    })

    it('undo restores previous ground', () => {
      const { appearances, brush, registry } = makePaintSetup()
      const mapData = makeMapData([
        makeTile(10, 10, 7, [makeItem({ id: GROUND_ID_2 })]),
      ])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintGround(10, 10, 7, brush)
      mutator.undo()
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items[0].id).toBe(GROUND_ID_2)
    })

    it('onTileChanged fires for center tile', () => {
      const { appearances, brush, registry } = makePaintSetup()
      const mapData = makeMapData([makeTile(10, 10, 7)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry
      const spy = vi.fn()
      mutator.onTileChanged = spy

      mutator.paintGround(10, 10, 7, brush)
      expect(spy).toHaveBeenCalledWith(10, 10, 7)
    })
  })

  describe('MAX_UNDO limit', () => {
    it('undo stack limited to 200 entries', () => {
      const { mutator } = makeMutator([makeTile(10, 10, 7)])
      for (let i = 0; i < 210; i++) {
        mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      }
      // Count how many undos are possible
      let undoCount = 0
      while (mutator.canUndo()) {
        mutator.undo()
        undoCount++
      }
      expect(undoCount).toBe(200)
    })
  })

  describe('paintWall', () => {
    function makeWallSetup() {
      const appearances = makeLayeredAppearances()
      const wallBrush = makeWallBrushWithItems(1, 'stone', {
        [WALL_POLE]: WALL_ITEM_POLE,
        [WALL_VERTICAL]: WALL_ITEM_VERT,
        [WALL_HORIZONTAL]: WALL_ITEM_HORIZ,
      })
      const registry = makeMinimalRegistry({ wallBrushes: [wallBrush] })
      return { appearances, wallBrush, registry }
    }

    it('places wall item on tile', () => {
      const { appearances, wallBrush, registry } = makeWallSetup()
      const mapData = makeMapData([makeTile(10, 10, 7)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintWall(10, 10, 7, wallBrush)
      const tile = mapData.tiles.get('10,10,7')!
      // At least one wall item should be placed
      const wallItems = tile.items.filter(it =>
        [WALL_ITEM_POLE, WALL_ITEM_VERT, WALL_ITEM_HORIZ].includes(it.id)
      )
      expect(wallItems.length).toBeGreaterThan(0)
    })

    it('replaces existing wall from same brush', () => {
      const { appearances, wallBrush, registry } = makeWallSetup()
      const mapData = makeMapData([makeTile(10, 10, 7, [makeItem({ id: WALL_ITEM_POLE })])])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintWall(10, 10, 7, wallBrush)
      const tile = mapData.tiles.get('10,10,7')!
      // Should have exactly one wall item (replaced, not duplicated)
      const wallItems = tile.items.filter(it =>
        [WALL_ITEM_POLE, WALL_ITEM_VERT, WALL_ITEM_HORIZ].includes(it.id)
      )
      expect(wallItems.length).toBe(1)
    })

    it('undo restores previous state', () => {
      const { appearances, wallBrush, registry } = makeWallSetup()
      const mapData = makeMapData([makeTile(10, 10, 7)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintWall(10, 10, 7, wallBrush)
      mutator.undo()
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items.length).toBe(0)
    })
  })

  describe('switchDoorItem', () => {
    function makeDoorSetup() {
      const appearances = makeLayeredAppearances()
      const wallBrush = makeWallBrushWithItems(1, 'stone', {
        [WALL_VERTICAL]: WALL_ITEM_VERT,
      })
      // Add door items to the brush
      wallBrush.doorItems[9].push(
        { id: DOOR_CLOSED, type: 2, open: false },
        { id: DOOR_OPEN, type: 2, open: true },
      )
      const registry = makeMinimalRegistry({ wallBrushes: [wallBrush] })
      return { appearances, wallBrush, registry }
    }

    it('toggles door open/closed', () => {
      const { appearances, registry } = makeDoorSetup()
      const mapData = makeMapData([makeTile(10, 10, 7, [makeItem({ id: DOOR_CLOSED })])])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.switchDoorItem(10, 10, 7, 0)
      expect(mapData.tiles.get('10,10,7')!.items[0].id).toBe(DOOR_OPEN)
    })

    it('no-op for invalid index', () => {
      const { appearances, registry } = makeDoorSetup()
      const mapData = makeMapData([makeTile(10, 10, 7, [makeItem({ id: DOOR_CLOSED })])])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.switchDoorItem(10, 10, 7, 5) // invalid index
      expect(mapData.tiles.get('10,10,7')!.items[0].id).toBe(DOOR_CLOSED)
    })
  })

  describe('paintCarpet', () => {
    function makeCarpetSetup() {
      const appearances = makeLayeredAppearances()
      const carpetBrush = makeCarpetBrushWithItems(1, 'red carpet', {
        [CARPET_CENTER]: CARPET_CENTER_ID,
      })
      const registry = makeMinimalRegistry({ carpetBrushes: [carpetBrush] })
      return { appearances, carpetBrush, registry }
    }

    it('places carpet item on tile', () => {
      const { appearances, carpetBrush, registry } = makeCarpetSetup()
      const mapData = makeMapData([makeTile(10, 10, 7)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintCarpet(10, 10, 7, carpetBrush)
      const tile = mapData.tiles.get('10,10,7')!
      const carpetItems = tile.items.filter(it =>
        [CARPET_CENTER_ID, CARPET_NORTH_ID].includes(it.id)
      )
      expect(carpetItems.length).toBeGreaterThan(0)
    })

    it('replaces existing carpet from same brush', () => {
      const { appearances, carpetBrush, registry } = makeCarpetSetup()
      const mapData = makeMapData([makeTile(10, 10, 7, [makeItem({ id: CARPET_CENTER_ID })])])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintCarpet(10, 10, 7, carpetBrush)
      const tile = mapData.tiles.get('10,10,7')!
      const carpetItems = tile.items.filter(it =>
        [CARPET_CENTER_ID, CARPET_NORTH_ID].includes(it.id)
      )
      expect(carpetItems.length).toBe(1) // replaced, not duplicated
    })
  })

  describe('paintTable', () => {
    it('places table item on tile', () => {
      const appearances = makeLayeredAppearances()
      const tableBrush = makeTableBrushWithItems(1, 'wooden table', {
        [TABLE_ALONE]: TABLE_ALONE_ID,
      })
      const registry = makeMinimalRegistry({ tableBrushes: [tableBrush] })
      const mapData = makeMapData([makeTile(10, 10, 7)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.paintTable(10, 10, 7, tableBrush)
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items.some(it => it.id === TABLE_ALONE_ID)).toBe(true)
    })
  })

  describe('paintDoodad', () => {
    function makeDoodadSetup() {
      const appearances = makeLayeredAppearances()
      const singleBrush = makeDoodadBrush({
        id: 1,
        name: 'flower',
        alternatives: [{
          singles: [{ itemId: DOODAD_SINGLE, chance: 100 }],
          composites: [],
          totalChance: 100,
        }],
      })
      const compositeBrush = makeDoodadBrush({
        id: 2,
        name: 'statue',
        alternatives: [{
          singles: [],
          composites: [{
            chance: 100,
            tiles: [
              { dx: 0, dy: 0, dz: 0, itemIds: [DOODAD_COMP_A] },
              { dx: 1, dy: 0, dz: 0, itemIds: [DOODAD_COMP_B] },
            ],
          }],
          totalChance: 100,
        }],
      })
      const registry = makeMinimalRegistry({
        doodadBrushes: [singleBrush, compositeBrush],
      })
      return { appearances, singleBrush, compositeBrush, registry }
    }

    it('places single doodad item', () => {
      const { appearances, singleBrush, registry } = makeDoodadSetup()
      const mapData = makeMapData([makeTile(10, 10, 7)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.beginBatch('doodad')
      mutator.paintDoodad(10, 10, 7, singleBrush)
      mutator.commitBatch()
      const tile = mapData.tiles.get('10,10,7')!
      expect(tile.items.some(it => it.id === DOODAD_SINGLE)).toBe(true)
    })

    it('places composite doodad across multiple tiles', () => {
      const { appearances, compositeBrush, registry } = makeDoodadSetup()
      const mapData = makeMapData([makeTile(10, 10, 7), makeTile(11, 10, 7)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.beginBatch('doodad')
      mutator.paintDoodad(10, 10, 7, compositeBrush)
      mutator.commitBatch()
      expect(mapData.tiles.get('10,10,7')!.items.some(it => it.id === DOODAD_COMP_A)).toBe(true)
      expect(mapData.tiles.get('11,10,7')!.items.some(it => it.id === DOODAD_COMP_B)).toBe(true)
    })

    it('cleans old doodad items before placing (no onDuplicate)', () => {
      const { appearances, singleBrush, registry } = makeDoodadSetup()
      const mapData = makeMapData([makeTile(10, 10, 7, [makeItem({ id: DOODAD_SINGLE })])])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.beginBatch('doodad')
      mutator.paintDoodad(10, 10, 7, singleBrush)
      mutator.commitBatch()
      const tile = mapData.tiles.get('10,10,7')!
      const doodadItems = tile.items.filter(it => it.id === DOODAD_SINGLE)
      // Old one cleaned + new one placed = exactly 1
      expect(doodadItems.length).toBe(1)
    })
  })

  describe('removeDoodadItems', () => {
    it('removes matching doodad items', () => {
      const appearances = makeLayeredAppearances()
      const brush = makeDoodadBrush({
        id: 1, name: 'flower',
        alternatives: [{ singles: [{ itemId: DOODAD_SINGLE, chance: 100 }], composites: [], totalChance: 100 }],
      })
      const registry = makeMinimalRegistry({ doodadBrushes: [brush] })
      const mapData = makeMapData([makeTile(10, 10, 7, [makeItem({ id: DOODAD_SINGLE })])])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.removeDoodadItems(10, 10, 7, brush)
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(0)
    })

    it('no-op when no matching items', () => {
      const appearances = makeLayeredAppearances()
      const brush = makeDoodadBrush({
        id: 1, name: 'flower',
        alternatives: [{ singles: [{ itemId: DOODAD_SINGLE, chance: 100 }], composites: [], totalChance: 100 }],
      })
      const registry = makeMinimalRegistry({ doodadBrushes: [brush] })
      const mapData = makeMapData([makeTile(10, 10, 7, [makeItem({ id: COMMON_ID })])])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry

      mutator.removeDoodadItems(10, 10, 7, brush)
      expect(mapData.tiles.get('10,10,7')!.items.length).toBe(1)
    })
  })

  describe('randomizeSelection', () => {
    function makeRandomizeSetup(opts: {
      isRandomizable: boolean
      items: { id: number; chance: number }[]
      tileItems?: Parameters<typeof makeItem>[0][]
    }) {
      const appearances = makeLayeredAppearances()
      const brush = createGroundBrush()
      brush.id = 1
      brush.name = 'grass'
      brush.isRandomizable = opts.isRandomizable
      brush.items = opts.items
      brush.totalChance = opts.items.reduce((sum, it) => sum + it.chance, 0)
      const registry = new BrushRegistry([brush], new Map())
      const tiles = (opts.tileItems ?? [{ id: GROUND_ID }]).map(o => makeItem(o))
      const mapData = makeMapData([makeTile(10, 10, 7, tiles)])
      const mutator = new MapMutator(mapData, appearances)
      mutator.brushRegistry = registry
      return { mutator, mapData }
    }

    it('randomizes ground item variant', () => {
      const { mutator, mapData } = makeRandomizeSetup({
        isRandomizable: true,
        items: [{ id: GROUND_ID, chance: 50 }, { id: GROUND_ID_2, chance: 50 }],
      })

      let changed = false
      for (let i = 0; i < 20; i++) {
        mutator.randomizeSelection([{ x: 10, y: 10, z: 7 }])
        if (mapData.tiles.get('10,10,7')!.items[0].id !== GROUND_ID) {
          changed = true
          break
        }
        mutator.undo()
      }
      expect(changed).toBe(true)
    })

    it('preserves item attributes on randomize', () => {
      const { mutator, mapData } = makeRandomizeSetup({
        isRandomizable: true,
        items: [{ id: GROUND_ID, chance: 0 }, { id: GROUND_ID_2, chance: 100 }],
        tileItems: [{ id: GROUND_ID, actionId: 999 }],
      })

      mutator.randomizeSelection([{ x: 10, y: 10, z: 7 }])
      const item = mapData.tiles.get('10,10,7')!.items[0]
      expect(item.id).toBe(GROUND_ID_2)
      expect(item.actionId).toBe(999)
    })

    it('skips non-randomizable ground', () => {
      const { mutator, mapData } = makeRandomizeSetup({
        isRandomizable: false,
        items: [{ id: GROUND_ID, chance: 100 }],
      })

      mutator.randomizeSelection([{ x: 10, y: 10, z: 7 }])
      expect(mapData.tiles.get('10,10,7')!.items[0].id).toBe(GROUND_ID)
    })
  })

  describe('flushChunkUpdates', () => {
    it('fires onChunksInvalidated during active batch', () => {
      const { mutator } = makeMutator([makeTile(10, 10, 7)])
      const spy = vi.fn()
      mutator.onChunksInvalidated = spy

      mutator.beginBatch('test')
      mutator.addItem(10, 10, 7, makeItem({ id: COMMON_ID }))
      mutator.flushChunkUpdates()
      expect(spy).toHaveBeenCalledTimes(1)
      mutator.commitBatch()
    })
  })
})
