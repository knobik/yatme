import type { OtbmItem } from '../../lib/otbm'
import { deepCloneItem } from '../../lib/otbm'
import type { SelectedItemInfo } from '../useSelection'
import { toggleItemInSelection, selectAllItemsOnTiles, mergeItemSelections } from '../useSelection'
import type { ToolContext, TilePos } from './types'

export function createSelectHandlers(ctx: ToolContext) {
  function onDown(pos: TilePos, event: PointerEvent) {
    const ctrlKey = event.ctrlKey || event.metaKey
    ctx.selectStartRef.current = pos
    ctx.isShiftDragRef.current = event.shiftKey
    ctx.isCtrlDragRef.current = ctrlKey

    // Plain click (no modifiers): select top item immediately and begin drag-move
    if (!event.shiftKey && !ctrlKey) {
      const tileKey = `${pos.x},${pos.y},${pos.z}`
      const tile = ctx.mapData.tiles.get(tileKey) ?? null

      const isAlreadySelected = ctx.selectedItemsRef.current.some(
        s => s.x === pos.x && s.y === pos.y && s.z === pos.z
      )

      if (!isAlreadySelected && tile && tile.items.length > 0) {
        const topIdx = tile.items.length - 1
        const newSel: SelectedItemInfo = { x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }
        ctx.setSelectedItems([newSel])
        ctx.selectedItemsRef.current = [newSel]
        ctx.renderer.setHighlights([{ pos: { x: pos.x, y: pos.y, z: pos.z }, indices: [topIdx] }])
      }

      if (isAlreadySelected || (tile && tile.items.length > 0)) {
        ctx.isDragMovingRef.current = true
        ctx.dragMoveOriginRef.current = pos
        ctx.dragMoveLastPosRef.current = pos
      }
    }

    if (ctrlKey && !event.shiftKey) {
      // Ctrl+Click: toggle top item in selection
      const tileKey = `${pos.x},${pos.y},${pos.z}`
      const tile = ctx.mapData.tiles.get(tileKey) ?? null
      if (tile && tile.items.length > 0) {
        const topIdx = tile.items.length - 1
        const newItem: SelectedItemInfo = { x: pos.x, y: pos.y, z: pos.z, itemIndex: topIdx }
        const newItems = toggleItemInSelection(ctx.selectedItemsRef.current, newItem)
        ctx.setSelectedItems(newItems)
        ctx.selectedItemsRef.current = newItems
        ctx.applyHighlights(newItems)
      }
    } else if (ctrlKey && event.shiftKey) {
      // Ctrl+Shift: boundbox append mode
      ctx.selectedItemsSnapshotRef.current = [...ctx.selectedItemsRef.current]
    }
  }

  function onMove(pos: TilePos) {
    // Drag-move: track target position and show ghost preview
    if (ctx.isDragMovingRef.current) {
      ctx.dragMoveLastPosRef.current = pos
      const origin = ctx.dragMoveOriginRef.current
      if (origin) {
        const dx = pos.x - origin.x
        const dy = pos.y - origin.y
        if (dx === 0 && dy === 0) {
          ctx.renderer.clearDragPreview()
          return
        }
        const sourceTiles: TilePos[] = []
        const seen = new Set<string>()
        for (const s of ctx.selectedItemsRef.current) {
          const key = `${s.x},${s.y},${s.z}`
          if (!seen.has(key)) { seen.add(key); sourceTiles.push({ x: s.x, y: s.y, z: s.z }) }
        }
        ctx.renderer.updateDragPreview(sourceTiles, dx, dy)
      }
      return
    }
    // Plain drag without shift: do nothing
    if (!ctx.isShiftDragRef.current) return
    // Shift+drag: rectangle selection
    const start = ctx.selectStartRef.current
    if (!start) return
    const minX = Math.min(start.x, pos.x)
    const maxX = Math.max(start.x, pos.x)
    const minY = Math.min(start.y, pos.y)
    const maxY = Math.max(start.y, pos.y)
    const rectTiles: TilePos[] = []
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        rectTiles.push({ x, y, z: pos.z })
      }
    }

    const rectItems = selectAllItemsOnTiles(rectTiles, ctx.mapData)
    if (ctx.isCtrlDragRef.current) {
      const merged = mergeItemSelections(ctx.selectedItemsSnapshotRef.current, rectItems)
      ctx.setSelectedItems(merged)
      ctx.selectedItemsRef.current = merged
      ctx.applyHighlights(merged)
    } else {
      ctx.setSelectedItems(rectItems)
      ctx.selectedItemsRef.current = rectItems
      ctx.applyHighlights(rectItems)
    }
  }

  function commitDragMove(pos: TilePos) {
    const origin = ctx.dragMoveOriginRef.current
    const target = ctx.dragMoveLastPosRef.current
    ctx.isDragMovingRef.current = false
    ctx.dragMoveOriginRef.current = null
    ctx.dragMoveLastPosRef.current = null
    ctx.renderer.clearDragPreview()

    const didMove = origin && target && (origin.x !== target.x || origin.y !== target.y)

    if (didMove) {
      const dx = target.x - origin.x
      const dy = target.y - origin.y

      const itemsToMove = ctx.selectedItemsRef.current
      if (itemsToMove.length === 0) {
        ctx.selectStartRef.current = null
        ctx.isShiftDragRef.current = false
        ctx.isCtrlDragRef.current = false
        return
      }

      const byTile = new Map<string, SelectedItemInfo[]>()
      for (const item of itemsToMove) {
        const key = `${item.x},${item.y},${item.z}`
        const list = byTile.get(key) ?? []
        list.push(item)
        byTile.set(key, list)
      }

      ctx.mutator.beginBatch('Move items')
      const newItems: SelectedItemInfo[] = []

      for (const [, tileItems] of byTile) {
        const uniqueIndices = [...new Set(tileItems.map(t => t.itemIndex))].sort((a, b) => b - a)
        const removed: OtbmItem[] = []
        const srcX = tileItems[0].x
        const srcY = tileItems[0].y
        const srcZ = tileItems[0].z

        for (const idx of uniqueIndices) {
          const tileKey = `${srcX},${srcY},${srcZ}`
          const tile = ctx.mapData.tiles.get(tileKey)
          if (!tile || idx >= tile.items.length) continue
          const item = deepCloneItem(tile.items[idx])
          removed.unshift(item)
          ctx.mutator.removeItem(srcX, srcY, srcZ, idx)
        }

        const destX = srcX + dx
        const destY = srcY + dy
        const destKey = `${destX},${destY},${srcZ}`
        const destTile = ctx.mapData.tiles.get(destKey)
        const baseIndex = destTile ? destTile.items.length : 0
        for (let ri = 0; ri < removed.length; ri++) {
          ctx.mutator.addItem(destX, destY, srcZ, removed[ri])
          newItems.push({ x: destX, y: destY, z: srcZ, itemIndex: baseIndex + ri })
        }
      }

      ctx.mutator.commitBatch()

      // Update selection to new positions
      const destTilePositions: TilePos[] = []
      const seen = new Set<string>()
      for (const item of newItems) {
        const key = `${item.x},${item.y},${item.z}`
        if (!seen.has(key)) { seen.add(key); destTilePositions.push({ x: item.x, y: item.y, z: item.z }) }
      }
      const expandedItems = selectAllItemsOnTiles(destTilePositions, ctx.mapData)
      ctx.setSelectedItems(expandedItems)
      ctx.selectedItemsRef.current = expandedItems
      ctx.applyHighlights(expandedItems)
    }

    ctx.selectStartRef.current = null
    ctx.isShiftDragRef.current = false
    ctx.isCtrlDragRef.current = false

    // Same tile — selection already happened in pointerDown, just open inspector
    if (!didMove && ctx.clickToInspectRef.current) {
      const key = `${pos.x},${pos.y},${pos.z}`
      const tile = ctx.mapData.tiles.get(key) ?? null
      ctx.renderer.onTileClick?.(tile, pos.x, pos.y)
    }
  }

  function onUp(pos: TilePos) {
    if (ctx.isDragMovingRef.current) {
      commitDragMove(pos)
      return
    }

    const start = ctx.selectStartRef.current
    const wasClick = start && start.x === pos.x && start.y === pos.y
    const ctrlKey = ctx.isCtrlDragRef.current
    const shiftKey = ctx.isShiftDragRef.current

    if (wasClick && !shiftKey && !ctrlKey) {
      const key = `${pos.x},${pos.y},${pos.z}`
      const tile = ctx.mapData.tiles.get(key) ?? null

      if (!tile || tile.items.length === 0) {
        ctx.setSelectedItems([])
        ctx.selectedItemsRef.current = []
        ctx.renderer.clearItemHighlight()
      }

      if (ctx.clickToInspectRef.current) {
        ctx.renderer.onTileClick?.(tile, pos.x, pos.y)
      }
    } else if (wasClick && ctrlKey && !shiftKey) {
      if (ctx.clickToInspectRef.current) {
        const key = `${pos.x},${pos.y},${pos.z}`
        const tile = ctx.mapData.tiles.get(key) ?? null
        ctx.renderer.onTileClick?.(tile, pos.x, pos.y)
      }
    } else if (wasClick && ctrlKey && shiftKey) {
      // Ctrl+Shift+Click: toggle all items for tile
      const tileKey = `${pos.x},${pos.y},${pos.z}`
      const tile = ctx.mapData.tiles.get(tileKey)
      const tileItemCount = tile?.items.length ?? 0
      const currentOnTile = ctx.selectedItemsRef.current.filter(
        s => s.x === pos.x && s.y === pos.y && s.z === pos.z
      )
      let newItems: SelectedItemInfo[]
      if (currentOnTile.length >= tileItemCount && tileItemCount > 0) {
        newItems = ctx.selectedItemsRef.current.filter(
          s => !(s.x === pos.x && s.y === pos.y && s.z === pos.z)
        )
      } else {
        const otherItems = ctx.selectedItemsRef.current.filter(
          s => !(s.x === pos.x && s.y === pos.y && s.z === pos.z)
        )
        const tileItems: SelectedItemInfo[] = []
        for (let i = 0; i < tileItemCount; i++) {
          tileItems.push({ x: pos.x, y: pos.y, z: pos.z, itemIndex: i })
        }
        newItems = [...otherItems, ...tileItems]
      }
      ctx.setSelectedItems(newItems)
      ctx.selectedItemsRef.current = newItems
      ctx.applyHighlights(newItems)
    }

    ctx.selectStartRef.current = null
    ctx.isShiftDragRef.current = false
    ctx.isCtrlDragRef.current = false
  }

  return { onDown, onMove, onUp }
}
