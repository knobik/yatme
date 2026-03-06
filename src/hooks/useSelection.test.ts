import { describe, it, expect } from 'vitest'
import {
  toggleItemInSelection,
  mergeItemSelections,
  selectAllItemsOnTiles,
  deriveHighlights,
  type SelectedItemInfo,
} from './useSelection'
import { makeMapData, makeTile, makeItem } from '../test/fixtures'

describe('toggleItemInSelection', () => {
  const item1: SelectedItemInfo = { x: 0, y: 0, z: 7, itemIndex: 0 }
  const item2: SelectedItemInfo = { x: 1, y: 0, z: 7, itemIndex: 0 }

  it('adds item to empty selection', () => {
    expect(toggleItemInSelection([], item1)).toEqual([item1])
  })

  it('adds item to existing selection', () => {
    expect(toggleItemInSelection([item1], item2)).toEqual([item1, item2])
  })

  it('removes item if already selected', () => {
    expect(toggleItemInSelection([item1, item2], item1)).toEqual([item2])
  })

  it('returns empty array when removing last item', () => {
    expect(toggleItemInSelection([item1], item1)).toEqual([])
  })
})

describe('mergeItemSelections', () => {
  const item1: SelectedItemInfo = { x: 0, y: 0, z: 7, itemIndex: 0 }
  const item2: SelectedItemInfo = { x: 1, y: 0, z: 7, itemIndex: 0 }
  const item3: SelectedItemInfo = { x: 2, y: 0, z: 7, itemIndex: 0 }

  it('merges non-overlapping selections', () => {
    expect(mergeItemSelections([item1], [item2, item3])).toEqual([item1, item2, item3])
  })

  it('deduplicates overlapping items', () => {
    expect(mergeItemSelections([item1, item2], [item2, item3])).toEqual([item1, item2, item3])
  })

  it('handles empty inputs', () => {
    expect(mergeItemSelections([], [item1])).toEqual([item1])
    expect(mergeItemSelections([item1], [])).toEqual([item1])
    expect(mergeItemSelections([], [])).toEqual([])
  })
})

describe('selectAllItemsOnTiles', () => {
  it('selects all items on existing tiles', () => {
    const tile = makeTile(5, 10, 7, [makeItem({ id: 1 }), makeItem({ id: 2 })])
    const mapData = makeMapData([tile])
    const result = selectAllItemsOnTiles([{ x: 5, y: 10, z: 7 }], mapData)
    expect(result).toEqual([
      { x: 5, y: 10, z: 7, itemIndex: 0 },
      { x: 5, y: 10, z: 7, itemIndex: 1 },
    ])
  })

  it('skips missing tiles', () => {
    const mapData = makeMapData([])
    expect(selectAllItemsOnTiles([{ x: 0, y: 0, z: 7 }], mapData)).toEqual([])
  })

  it('handles multiple tiles', () => {
    const t1 = makeTile(0, 0, 7, [makeItem()])
    const t2 = makeTile(1, 0, 7, [makeItem(), makeItem()])
    const mapData = makeMapData([t1, t2])
    const result = selectAllItemsOnTiles([{ x: 0, y: 0, z: 7 }, { x: 1, y: 0, z: 7 }], mapData)
    expect(result).toHaveLength(3)
  })
})

describe('deriveHighlights', () => {
  it('returns empty for no selection', () => {
    const mapData = makeMapData([])
    expect(deriveHighlights([], mapData)).toEqual([])
  })

  it('returns null indices when all items on tile selected (full-tile highlight)', () => {
    const tile = makeTile(0, 0, 7, [makeItem(), makeItem()])
    const mapData = makeMapData([tile])
    const items: SelectedItemInfo[] = [
      { x: 0, y: 0, z: 7, itemIndex: 0 },
      { x: 0, y: 0, z: 7, itemIndex: 1 },
    ]
    const result = deriveHighlights(items, mapData)
    expect(result).toEqual([{ pos: { x: 0, y: 0, z: 7 }, indices: null }])
  })

  it('returns specific indices for partial selection', () => {
    const tile = makeTile(0, 0, 7, [makeItem(), makeItem(), makeItem()])
    const mapData = makeMapData([tile])
    const items: SelectedItemInfo[] = [
      { x: 0, y: 0, z: 7, itemIndex: 1 },
    ]
    const result = deriveHighlights(items, mapData)
    expect(result).toEqual([{ pos: { x: 0, y: 0, z: 7 }, indices: [1] }])
  })
})
