import { useState, useCallback, useRef } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import { type OtbmMap, deepCloneItem } from '../lib/otbm'
import type { SelectedItemInfo } from './useSelection'
import { selectAllItemsOnTiles } from './useSelection'
import { type ClipboardData, getClipboardFootprint } from './tools/types'

export function useClipboard(
  renderer: MapRenderer | null,
  mutator: MapMutator | null,
  mapData: OtbmMap | null,
  selectedItemsRef: React.MutableRefObject<SelectedItemInfo[]>,
  setSelectedItems: (items: SelectedItemInfo[]) => void,
  applyHighlights: (items: SelectedItemInfo[]) => void,
  hoverPosRef: React.MutableRefObject<{ x: number; y: number; z: number } | null>,
) {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)
  const [isPasting, setIsPasting] = useState(false)
  const isPastingRef = useRef(false)
  const clipboardRef = useRef<ClipboardData | null>(null)
  clipboardRef.current = clipboard

  const cancelPaste = useCallback(() => {
    isPastingRef.current = false
    setIsPasting(false)
    renderer?.clearDragPreview()
    renderer?.updateBrushCursor([])
  }, [renderer])

  const executePasteAt = useCallback((targetX: number, targetY: number, targetZ: number) => {
    const cb = clipboardRef.current
    if (!cb || !mutator || !renderer || !mapData) return
    mutator.beginBatch('Paste')
    const pastedTilePositions: { x: number; y: number; z: number }[] = []
    for (const t of cb.tiles) {
      const tx = targetX + t.dx
      const ty = targetY + t.dy
      mutator.mergePasteItems(tx, ty, targetZ, t.items)
      const tile = mutator.getTile(tx, ty, targetZ)
      if (tile) renderer.updateChunkIndex(tile)
      pastedTilePositions.push({ x: tx, y: ty, z: targetZ })
    }
    mutator.commitBatch()

    const pastedItems = selectAllItemsOnTiles(pastedTilePositions, mapData)
    setSelectedItems(pastedItems)
    selectedItemsRef.current = pastedItems
    applyHighlights(pastedItems)
  }, [mutator, renderer, mapData, selectedItemsRef, setSelectedItems, applyHighlights])

  const copy = useCallback(() => {
    if (!mapData) return
    const items = selectedItemsRef.current
    if (items.length === 0) return

    const byTile = new Map<string, { pos: { x: number; y: number; z: number }; indices: Set<number> }>()
    for (const item of items) {
      const key = `${item.x},${item.y},${item.z}`
      let entry = byTile.get(key)
      if (!entry) {
        entry = { pos: { x: item.x, y: item.y, z: item.z }, indices: new Set() }
        byTile.set(key, entry)
      }
      entry.indices.add(item.itemIndex)
    }

    const positions = [...byTile.values()].map(e => e.pos)
    const minX = Math.min(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const z = positions[0].z
    const tiles: ClipboardData['tiles'] = []

    for (const [key, entry] of byTile) {
      const tile = mapData.tiles.get(key)
      if (tile && tile.items.length > 0) {
        const copiedItems = tile.items
          .filter((_, i) => entry.indices.has(i))
          .map(deepCloneItem)
        if (copiedItems.length > 0) {
          tiles.push({
            dx: entry.pos.x - minX,
            dy: entry.pos.y - minY,
            items: copiedItems,
          })
        }
      }
    }
    if (tiles.length > 0) {
      setClipboard({ originX: minX, originY: minY, z, tiles })
    }
  }, [mapData, selectedItemsRef])

  const paste = useCallback(() => {
    if (!clipboard || !renderer) return
    if (isPastingRef.current) {
      cancelPaste()
      return
    }
    isPastingRef.current = true
    setIsPasting(true)
    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
    const hover = hoverPosRef.current
    if (hover) {
      renderer.updatePastePreview(clipboard, hover.x, hover.y, renderer.floor)
      renderer.updateBrushCursor(getClipboardFootprint(clipboard, hover.x, hover.y, renderer.floor))
    }
  }, [clipboard, renderer, cancelPaste, selectedItemsRef, setSelectedItems, hoverPosRef])

  const deleteSelection = useCallback(() => {
    const items = selectedItemsRef.current
    if (!mutator || !renderer || !mapData) return
    if (items.length === 0) return

    mutator.beginBatch('Delete selection')

    const byTile = new Map<string, SelectedItemInfo[]>()
    for (const item of items) {
      const key = `${item.x},${item.y},${item.z}`
      const list = byTile.get(key) ?? []
      list.push(item)
      byTile.set(key, list)
    }

    for (const [key, tileItems] of byTile) {
      const tile = mapData.tiles.get(key)
      if (!tile) continue
      if (tileItems.length >= tile.items.length) {
        mutator.setTileItems(tileItems[0].x, tileItems[0].y, tileItems[0].z, [])
      } else {
        const indices = [...new Set(tileItems.map(t => t.itemIndex))].sort((a, b) => b - a)
        for (const idx of indices) {
          mutator.removeItem(tileItems[0].x, tileItems[0].y, tileItems[0].z, idx)
        }
      }
    }

    mutator.commitBatch()

    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
  }, [mutator, renderer, mapData, selectedItemsRef, setSelectedItems])

  const cut = useCallback(() => {
    copy()
    deleteSelection()
  }, [copy, deleteSelection])

  return {
    clipboard,
    isPasting,
    isPastingRef,
    clipboardRef,
    copy,
    cut,
    paste,
    deleteSelection,
    cancelPaste,
    executePasteAt,
  }
}
