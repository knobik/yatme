import { describe, it, expect, vi } from 'vitest'
import { createSelectHandlers } from './selectTool'
import { makeToolContext, makeMockRenderer, makePointerEvent } from '../../test/toolFixtures'
import { makeMapData, makeTile, makeItem } from '../../test/fixtures'

describe('selectTool', () => {
  describe('onDown — plain click', () => {
    it('selects top item on tile when clicking non-empty tile', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 }), makeItem({ id: 20 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer })
      const { onDown } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      expect(ctx.setSelectedItems).toHaveBeenCalledWith([
        { x: 5, y: 5, z: 7, itemIndex: 1 },
      ])
    })

    it('enables drag-move mode when clicking already-selected tile', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [{ x: 5, y: 5, z: 7, itemIndex: 0 }],
      })
      const { onDown } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())

      expect(ctx.isDragMovingRef.current).toBe(true)
      expect(ctx.dragMoveOriginRef.current).toEqual({ x: 5, y: 5, z: 7 })
    })

    it('clears selection when clicking empty tile (handled in onUp)', () => {
      const map = makeMapData([])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer })
      const { onDown, onUp } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onUp({ x: 5, y: 5, z: 7 })

      expect(ctx.setSelectedItems).toHaveBeenCalledWith([])
    })
  })

  describe('onDown — Ctrl+click', () => {
    it('toggles item in selection via toggleItemInSelection', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer })
      const { onDown } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ ctrlKey: true }))

      // toggles the top item
      expect(ctx.setSelectedItems).toHaveBeenCalledWith([
        { x: 5, y: 5, z: 7, itemIndex: 0 },
      ])
    })
  })

  describe('onDown — Ctrl+Shift+click', () => {
    it('saves selectedItemsSnapshotRef for append mode', () => {
      const existing = [{ x: 1, y: 1, z: 7, itemIndex: 0 }]
      const map = makeMapData([makeTile(1, 1, 7, [makeItem({ id: 10 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer, selectedItems: existing })
      const { onDown } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ ctrlKey: true, shiftKey: true }))

      expect(ctx.selectedItemsSnapshotRef.current).toEqual(existing)
    })
  })

  describe('onMove — drag move', () => {
    it('calls renderer.updateDragPreview with delta from origin', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [{ x: 5, y: 5, z: 7, itemIndex: 0 }],
      })
      const { onDown, onMove } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 7, y: 6, z: 7 })

      expect(renderer.updateDragPreview).toHaveBeenCalledWith(
        [{ pos: { x: 5, y: 5, z: 7 }, indices: [0] }],
        2, 1,
      )
    })

    it('clears preview when delta is (0,0)', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [{ x: 5, y: 5, z: 7, itemIndex: 0 }],
      })
      const { onDown, onMove } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 5, y: 5, z: 7 }) // same position = zero delta

      expect(renderer.clearDragPreview).toHaveBeenCalled()
    })
  })

  describe('onMove — Shift+drag rectangle', () => {
    it('selects all items in bounding rectangle', () => {
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(6, 5, 7, [makeItem({ id: 20 })]),
        makeTile(5, 6, 7, [makeItem({ id: 30 })]),
      ])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer })
      const { onDown, onMove } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ shiftKey: true }))
      onMove({ x: 6, y: 6, z: 7 })

      // Should select all items in the 2x2 rectangle
      expect(ctx.setSelectedItems).toHaveBeenCalled()
      const lastCall = (ctx.setSelectedItems as any).mock.calls.at(-1)[0]
      expect(lastCall).toHaveLength(3) // 3 tiles with 1 item each
    })

    it('merges with snapshot when Ctrl is also held', () => {
      const existing = [{ x: 1, y: 1, z: 7, itemIndex: 0 }]
      const map = makeMapData([
        makeTile(1, 1, 7, [makeItem({ id: 5 })]),
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
      ])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer, selectedItems: existing })
      const { onDown, onMove } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ shiftKey: true, ctrlKey: true }))
      onMove({ x: 5, y: 5, z: 7 })

      // Should have merged existing + new rectangle items
      const lastCall = (ctx.setSelectedItems as any).mock.calls.at(-1)[0]
      expect(lastCall.length).toBeGreaterThanOrEqual(1)
      // The existing item should still be present
      expect(lastCall).toContainEqual({ x: 1, y: 1, z: 7, itemIndex: 0 })
    })
  })

  describe('onUp — plain click on empty', () => {
    it('clears selection', () => {
      const map = makeMapData([])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer })
      const { onDown, onUp } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onUp({ x: 5, y: 5, z: 7 })

      expect(ctx.setSelectedItems).toHaveBeenCalledWith([])
      expect(renderer.clearItemHighlight).toHaveBeenCalled()
    })
  })

  describe('onUp — Ctrl+Shift+click on tile', () => {
    it('toggles all items on tile (select all)', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 }), makeItem({ id: 20 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ mapData: map, renderer })
      const { onDown, onUp } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ ctrlKey: true, shiftKey: true }))
      onUp({ x: 5, y: 5, z: 7 })

      // Should select all items on the tile
      const lastCall = (ctx.setSelectedItems as any).mock.calls.at(-1)[0]
      expect(lastCall).toContainEqual({ x: 5, y: 5, z: 7, itemIndex: 0 })
      expect(lastCall).toContainEqual({ x: 5, y: 5, z: 7, itemIndex: 1 })
    })

    it('deselects all items when all are already selected', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 }), makeItem({ id: 20 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [
          { x: 5, y: 5, z: 7, itemIndex: 0 },
          { x: 5, y: 5, z: 7, itemIndex: 1 },
        ],
      })
      const { onDown, onUp } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent({ ctrlKey: true, shiftKey: true }))
      onUp({ x: 5, y: 5, z: 7 })

      const lastCall = (ctx.setSelectedItems as any).mock.calls.at(-1)[0]
      // All items on this tile should be removed
      expect(lastCall.filter((s: any) => s.x === 5 && s.y === 5)).toHaveLength(0)
    })
  })

  describe('onUp — commit drag move', () => {
    it('removes items from source and adds to destination', () => {
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 }), makeItem({ id: 20 })]),
      ])
      const renderer = makeMockRenderer()
      const { ctx, mutator } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [{ x: 5, y: 5, z: 7, itemIndex: 1 }],
      })
      const { onDown, onMove, onUp } = createSelectHandlers(ctx)

      // Simulate drag-move: click on selected tile, move, release
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 7, y: 5, z: 7 }) // move 2 tiles right
      onUp({ x: 7, y: 5, z: 7 })

      expect(mutator.beginBatch).toHaveBeenCalledWith('Move items')
      expect(mutator.removeItem).toHaveBeenCalledWith(5, 5, 7, 1)
      expect(mutator.addItem).toHaveBeenCalled()
      expect(mutator.commitBatch).toHaveBeenCalled()
    })

    it('batch lifecycle: beginBatch("Move items") -> mutations -> commitBatch', () => {
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
      ])
      const renderer = makeMockRenderer()
      const { ctx, mutator } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [{ x: 5, y: 5, z: 7, itemIndex: 0 }],
      })

      const callOrder: string[] = []
      mutator.beginBatch.mockImplementation(() => { callOrder.push('beginBatch') })
      mutator.removeItem.mockImplementation(() => { callOrder.push('removeItem') })
      mutator.addItem.mockImplementation(() => { callOrder.push('addItem') })
      mutator.commitBatch.mockImplementation(() => { callOrder.push('commitBatch') })

      const { onDown, onMove, onUp } = createSelectHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 6, y: 5, z: 7 })
      onUp({ x: 6, y: 5, z: 7 })

      expect(callOrder[0]).toBe('beginBatch')
      expect(callOrder[callOrder.length - 1]).toBe('commitBatch')
    })

    it('rebuilds selection with new indices after move', () => {
      // Create destination tile with existing item, so moved item gets a new index
      const map = makeMapData([
        makeTile(5, 5, 7, [makeItem({ id: 10 })]),
        makeTile(7, 5, 7, [makeItem({ id: 99 })]),
      ])
      const renderer = makeMockRenderer()
      const { ctx, mutator } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [{ x: 5, y: 5, z: 7, itemIndex: 0 }],
      })

      // Simulate addItem actually adding to destination tile
      mutator.addItem.mockImplementation((x: number, y: number, z: number, item: any) => {
        const key = `${x},${y},${z}`
        const tile = map.tiles.get(key)
        if (tile) tile.items.push(item)
      })
      mutator.removeItem.mockImplementation((x: number, y: number, z: number, idx: number) => {
        const key = `${x},${y},${z}`
        const tile = map.tiles.get(key)
        if (tile) tile.items.splice(idx, 1)
      })

      const { onDown, onMove, onUp } = createSelectHandlers(ctx)
      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 7, y: 5, z: 7 })
      onUp({ x: 7, y: 5, z: 7 })

      // Selection should be rebuilt for the destination tile
      const lastSetCall = (ctx.setSelectedItems as any).mock.calls.at(-1)[0]
      expect(lastSetCall.length).toBeGreaterThan(0)
      expect(lastSetCall[0].x).toBe(7)
      expect(lastSetCall[0].y).toBe(5)
    })

    it('clears drag preview after commit', () => {
      const map = makeMapData([makeTile(5, 5, 7, [makeItem({ id: 10 })])])
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({
        mapData: map,
        renderer,
        selectedItems: [{ x: 5, y: 5, z: 7, itemIndex: 0 }],
      })
      const { onDown, onMove, onUp } = createSelectHandlers(ctx)

      onDown({ x: 5, y: 5, z: 7 }, makePointerEvent())
      onMove({ x: 6, y: 5, z: 7 })
      onUp({ x: 6, y: 5, z: 7 })

      expect(renderer.clearDragPreview).toHaveBeenCalled()
    })
  })
})
