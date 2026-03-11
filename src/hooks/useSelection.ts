import { useState } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { OtbmMap } from '../lib/otbm'
import { useLatestRef } from './useLatestRef'

export interface SelectedItemInfo {
  x: number
  y: number
  z: number
  itemIndex: number
}

// ── Pure utility functions ───────────────────────────────────────────

export function toggleItemInSelection(
  items: SelectedItemInfo[],
  newItem: SelectedItemInfo,
): SelectedItemInfo[] {
  const idx = items.findIndex(i =>
    i.x === newItem.x && i.y === newItem.y && i.z === newItem.z && i.itemIndex === newItem.itemIndex
  )
  if (idx >= 0) {
    return items.filter((_, i) => i !== idx)
  }
  return [...items, newItem]
}

export function selectAllItemsOnTiles(
  tiles: { x: number; y: number; z: number }[],
  mapData: OtbmMap,
): SelectedItemInfo[] {
  const result: SelectedItemInfo[] = []
  for (const t of tiles) {
    const tile = mapData.tiles.get(`${t.x},${t.y},${t.z}`)
    if (!tile) continue
    for (let i = 0; i < tile.items.length; i++) {
      result.push({ x: t.x, y: t.y, z: t.z, itemIndex: i })
    }
  }
  return result
}

export function mergeItemSelections(
  existing: SelectedItemInfo[],
  newItems: SelectedItemInfo[],
): SelectedItemInfo[] {
  const set = new Set(existing.map(i => `${i.x},${i.y},${i.z},${i.itemIndex}`))
  const merged = [...existing]
  for (const item of newItems) {
    const key = `${item.x},${item.y},${item.z},${item.itemIndex}`
    if (!set.has(key)) {
      set.add(key)
      merged.push(item)
    }
  }
  return merged
}

export function deriveHighlights(
  items: SelectedItemInfo[],
  mapData: OtbmMap,
): { pos: { x: number; y: number; z: number }; indices: number[] | null }[] {
  if (items.length === 0) return []
  const byTile = new Map<string, { pos: { x: number; y: number; z: number }; indices: number[] }>()
  for (const item of items) {
    const key = `${item.x},${item.y},${item.z}`
    let entry = byTile.get(key)
    if (!entry) {
      entry = { pos: { x: item.x, y: item.y, z: item.z }, indices: [] }
      byTile.set(key, entry)
    }
    entry.indices.push(item.itemIndex)
  }
  const result: { pos: { x: number; y: number; z: number }; indices: number[] | null }[] = []
  for (const [key, entry] of byTile) {
    const tile = mapData.tiles.get(key)
    if (tile && entry.indices.length >= tile.items.length) {
      result.push({ pos: entry.pos, indices: null })
    } else {
      result.push({ pos: entry.pos, indices: entry.indices })
    }
  }
  return result
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useSelection(renderer: MapRenderer | null, mapData: OtbmMap | null) {
  const [selectedItems, setSelectedItems] = useState<SelectedItemInfo[]>([])
  const selectedItemsRef = useLatestRef(selectedItems)

  const applyHighlights = (items: SelectedItemInfo[]) => {
    if (!mapData || !renderer) return
    if (items.length === 0) {
      renderer.clearItemHighlight()
    } else {
      renderer.setHighlights(deriveHighlights(items, mapData))
    }
  }

  const selectTiles = (tiles: { x: number; y: number; z: number }[]) => {
    if (!mapData) {
      setSelectedItems([])
      selectedItemsRef.current = []
      renderer?.clearItemHighlight()
      return
    }
    const items = selectAllItemsOnTiles(tiles, mapData)
    setSelectedItems(items)
    selectedItemsRef.current = items
    applyHighlights(items)
  }

  return {
    selectedItems,
    setSelectedItems,
    selectedItemsRef,
    applyHighlights,
    selectTiles,
    hasSelection: selectedItems.length > 0,
  }
}
