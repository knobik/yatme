// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from './useClipboard'
import { makeMapData, makeTile, makeItem } from '../test/fixtures'
import type { SelectedItemInfo } from './useSelection'
import type { EditorSettings } from '../lib/EditorSettings'
import { DEFAULT_SETTINGS } from '../lib/EditorSettings'

import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'

function makeMockRenderer() {
  return {
    floor: 7,
    clearDragPreview: vi.fn(),
    updateBrushCursor: vi.fn(),
    clearItemHighlight: vi.fn(),
    updatePastePreview: vi.fn(),
  } as unknown as MapRenderer
}

function makeMockMutator() {
  return {
    beginBatch: vi.fn(),
    commitBatch: vi.fn(),
    removeItem: vi.fn(),
    setTileItems: vi.fn(),
    borderizeSelection: vi.fn(),
  } as unknown as MapMutator
}

describe('useClipboard', () => {
  let renderer: ReturnType<typeof makeMockRenderer>
  let mutator: ReturnType<typeof makeMockMutator>
  let mapData: ReturnType<typeof makeMapData>
  let selectedItemsRef: { current: SelectedItemInfo[] }
  let setSelectedItems: (items: SelectedItemInfo[]) => void
  let applyHighlights: (items: SelectedItemInfo[]) => void
  let hoverPosRef: { current: { x: number; y: number; z: number } | null }
  let settingsRef: { current: EditorSettings }

  beforeEach(() => {
    renderer = makeMockRenderer()
    mutator = makeMockMutator()
    mapData = makeMapData([
      makeTile(5, 5, 7, [makeItem({ id: 10 }), makeItem({ id: 20 })]),
    ])
    selectedItemsRef = { current: [] }
    setSelectedItems = vi.fn()
    applyHighlights = vi.fn()
    hoverPosRef = { current: null }
    settingsRef = { current: { ...DEFAULT_SETTINGS } }
  })

  function renderClipboard() {
    return renderHook(() =>
      useClipboard(renderer, mutator, mapData, selectedItemsRef, setSelectedItems, applyHighlights, hoverPosRef, settingsRef)
    )
  }

  it('copy populates buffer from selected items', () => {
    selectedItemsRef.current = [{ x: 5, y: 5, z: 7, itemIndex: 0 }]
    const { result } = renderClipboard()

    act(() => { result.current.copy() })

    expect(result.current.canPaste).toBe(true)
    // Verify buffer actually captured the tile data
    const buffer = result.current.copyBufferRef.current
    expect(buffer.getTileCount()).toBe(1)
  })

  it('cut copies then removes selected items', () => {
    selectedItemsRef.current = [{ x: 5, y: 5, z: 7, itemIndex: 0 }]
    const { result } = renderClipboard()

    act(() => { result.current.cut() })

    expect(result.current.canPaste).toBe(true)
    // Verify buffer captured tile data
    const buffer = result.current.copyBufferRef.current
    expect(buffer.getTileCount()).toBe(1)
    // Verify mutation happened (cut removes from map)
    expect(mutator.beginBatch).toHaveBeenCalledWith('Cut')
    expect(mutator.commitBatch).toHaveBeenCalled()
    // Verify selection was cleared
    expect(setSelectedItems).toHaveBeenCalledWith([])
    expect(renderer.clearItemHighlight).toHaveBeenCalled()
  })

  it('paste sets isPasting state', () => {
    selectedItemsRef.current = [{ x: 5, y: 5, z: 7, itemIndex: 0 }]
    const { result } = renderClipboard()

    // First copy, then paste
    act(() => { result.current.copy() })
    act(() => { result.current.paste() })

    expect(result.current.isPasting).toBe(true)
  })

  it('cancelPaste clears paste state', () => {
    selectedItemsRef.current = [{ x: 5, y: 5, z: 7, itemIndex: 0 }]
    const { result } = renderClipboard()

    act(() => { result.current.copy() })
    act(() => { result.current.paste() })
    act(() => { result.current.cancelPaste() })

    expect(result.current.isPasting).toBe(false)
    expect(renderer.clearDragPreview).toHaveBeenCalled()
  })

  it('canPaste reflects buffer state', () => {
    const { result } = renderClipboard()
    expect(result.current.canPaste).toBe(false)

    selectedItemsRef.current = [{ x: 5, y: 5, z: 7, itemIndex: 0 }]
    act(() => { result.current.copy() })

    expect(result.current.canPaste).toBe(true)
  })

  it('deleteSelection removes selected items via removeSelectedItems', () => {
    selectedItemsRef.current = [
      { x: 5, y: 5, z: 7, itemIndex: 0 },
      { x: 5, y: 5, z: 7, itemIndex: 1 },
    ]
    const { result } = renderClipboard()

    act(() => { result.current.deleteSelection() })

    expect(mutator.beginBatch).toHaveBeenCalledWith('Delete selection')
    // Verify actual tile mutation: setTileItems should be called to clear the tile
    expect(mutator.setTileItems).toHaveBeenCalledWith(5, 5, 7, [])
    expect(mutator.commitBatch).toHaveBeenCalled()
    expect(setSelectedItems).toHaveBeenCalledWith([])
    expect(renderer.clearItemHighlight).toHaveBeenCalled()
  })

  it('paste toggles off when already pasting', () => {
    selectedItemsRef.current = [{ x: 5, y: 5, z: 7, itemIndex: 0 }]
    const { result } = renderClipboard()

    act(() => { result.current.copy() })
    act(() => { result.current.paste() })
    expect(result.current.isPasting).toBe(true)

    act(() => { result.current.paste() })
    expect(result.current.isPasting).toBe(false)
  })

  it('executePasteAt is a no-op when buffer is empty', () => {
    const { result } = renderClipboard()

    act(() => { result.current.executePasteAt(5, 5, 7) })

    // No mutations should happen
    expect(mutator.beginBatch).not.toHaveBeenCalled()
  })
})
