import type { OtbmItem, OtbmTile } from '../../lib/otbm'
import { deepCloneItem } from '../../lib/otbm'
import type { SelectedItemInfo } from '../useSelection'
import { toggleItemInSelection, selectAllItemsOnTiles, mergeItemSelections } from '../useSelection'
import type { ToolContext, TilePos, SelectedCreatureInfo } from './types'
import type { EditorSettings } from '../../lib/EditorSettings'

/** Find the highest-priority selectable creature or spawn zone on a tile. */
export function findSelectableOnTile(tile: OtbmTile | null, settings: EditorSettings): SelectedCreatureInfo | null {
  if (!tile) return null
  const { x, y, z } = tile

  // Priority 1: spawnMonster center
  if (settings.showMonsterSpawns && tile.spawnMonster) {
    return { type: 'spawnZone', x, y, z, spawnType: 'monster' }
  }

  // Priority 2: top monster
  if (settings.showMonsters && tile.monsters && tile.monsters.length > 0) {
    const top = tile.monsters[tile.monsters.length - 1]
    return { type: 'creature', x, y, z, creatureName: top.name, isNpc: false }
  }

  // Priority 3: spawnNpc center
  if (settings.showNpcSpawns && tile.spawnNpc) {
    return { type: 'spawnZone', x, y, z, spawnType: 'npc' }
  }

  // Priority 4: NPC
  if (settings.showNpcs && tile.npc) {
    return { type: 'creature', x, y, z, creatureName: tile.npc.name, isNpc: true }
  }

  return null
}

export function createSelectHandlers(ctx: ToolContext) {
  function clearCreatureSelection() {
    ctx.selectedCreatureRef.current = null
    ctx.setSelectedCreature(null)
  }

  /** Set a full-tile highlight on a single position (used for creature/spawn selection). */
  function highlightTile(pos: TilePos) {
    ctx.renderer.setHighlights([{ pos: { x: pos.x, y: pos.y, z: pos.z }, indices: null }])
  }

  function onDown(pos: TilePos, event: PointerEvent) {
    const ctrlKey = event.ctrlKey || event.metaKey
    ctx.selectStartRef.current = pos
    ctx.isShiftDragRef.current = event.shiftKey
    ctx.isCtrlDragRef.current = ctrlKey

    // Plain click (no modifiers): check creatures first, then items
    if (!event.shiftKey && !ctrlKey) {
      const tileKey = `${pos.x},${pos.y},${pos.z}`
      const tile = ctx.mapData.tiles.get(tileKey) ?? null

      // Try creature/spawn selection first
      const creatureHit = findSelectableOnTile(tile, ctx.settingsRef.current)
      if (creatureHit) {
        // Select this creature/spawn, clear item selection
        ctx.selectedCreatureRef.current = creatureHit
        ctx.setSelectedCreature(creatureHit)
        ctx.setSelectedItems([])
        ctx.selectedItemsRef.current = []
        ctx.renderer.clearItemHighlight()
        highlightTile(pos)

        // Enable drag-move for creatures and spawn zones
        ctx.isDragMovingRef.current = true
        ctx.isCreatureDragRef.current = true
        ctx.dragMoveOriginRef.current = pos
        ctx.dragMoveLastPosRef.current = pos
        return
      }

      // Try waypoint selection (if overlay visible)
      if (ctx.renderer.showWaypointOverlay) {
        const wm = ctx.mutator.waypointManager
        const wpHit = wm?.getByPosition(pos.x, pos.y, pos.z)
        if (wpHit) {
          ctx.onWaypointSelected?.(wpHit.name)
          ctx.isWaypointDragRef.current = true
          ctx.dragWaypointNameRef.current = wpHit.name
          ctx.isDragMovingRef.current = true
          ctx.dragMoveOriginRef.current = pos
          ctx.dragMoveLastPosRef.current = pos
          ctx.setSelectedItems([])
          ctx.selectedItemsRef.current = []
          ctx.renderer.clearItemHighlight()
          return
        }
      }

      // No creature hit — fall through to item selection
      const isAlreadySelected = ctx.selectedItemsRef.current.some(
        s => s.x === pos.x && s.y === pos.y && s.z === pos.z
      )

      // Clear any creature selection when selecting items
      if (ctx.selectedCreatureRef.current) {
        clearCreatureSelection()
      }

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

      // Creature/spawn drag ghost
      if (ctx.isCreatureDragRef.current) {
        const sel = ctx.selectedCreatureRef.current
        if (sel && sel.type === 'spawnZone') {
          const origin = ctx.dragMoveOriginRef.current
          if (origin) {
            const srcKey = `${origin.x},${origin.y},${origin.z}`
            const srcTile = ctx.mapData.tiles.get(srcKey)
            const spawnData = sel.spawnType === 'monster' ? srcTile?.spawnMonster : srcTile?.spawnNpc
            if (spawnData) {
              ctx.renderer.setSpawnDragGhost(sel.spawnType, pos.x, pos.y, pos.z, spawnData.radius)
            }
          }
        }
        return
      }

      // Waypoint drag ghost
      if (ctx.isWaypointDragRef.current) {
        ctx.renderer.setWaypointDragGhost(pos.x, pos.y, pos.z)
        return
      }

      const origin = ctx.dragMoveOriginRef.current
      if (origin) {
        const dx = pos.x - origin.x
        const dy = pos.y - origin.y
        if (dx === 0 && dy === 0) {
          ctx.renderer.clearDragPreview()
          return
        }
        const tileIndices = new Map<string, { pos: TilePos; indices: Set<number> }>()
        for (const s of ctx.selectedItemsRef.current) {
          const key = `${s.x},${s.y},${s.z}`
          let entry = tileIndices.get(key)
          if (!entry) {
            entry = { pos: { x: s.x, y: s.y, z: s.z }, indices: new Set() }
            tileIndices.set(key, entry)
          }
          entry.indices.add(s.itemIndex)
        }
        const selectedPerTile: { pos: TilePos; indices: number[] }[] = []
        for (const [, entry] of tileIndices) {
          selectedPerTile.push({ pos: entry.pos, indices: [...entry.indices] })
        }
        ctx.renderer.updateDragPreview(selectedPerTile, dx, dy)
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
    const wasCreatureDrag = ctx.isCreatureDragRef.current
    const wasWaypointDrag = ctx.isWaypointDragRef.current
    const draggedWaypointName = ctx.dragWaypointNameRef.current
    ctx.isDragMovingRef.current = false
    ctx.dragMoveOriginRef.current = null
    ctx.dragMoveLastPosRef.current = null
    ctx.isCreatureDragRef.current = false
    ctx.isWaypointDragRef.current = false
    ctx.dragWaypointNameRef.current = null
    ctx.renderer.clearDragPreview()
    ctx.renderer.clearWaypointDragGhost()
    // Clear spawn drag ghosts for both types
    ctx.renderer.clearSpawnDragGhost('monster')
    ctx.renderer.clearSpawnDragGhost('npc')

    const didMove = origin && target && (origin.x !== target.x || origin.y !== target.y)

    // Creature / spawn zone drag-move
    if (wasCreatureDrag) {
      if (didMove) {
        const sel = ctx.selectedCreatureRef.current
        if (sel && sel.type === 'creature') {
          ctx.mutator.moveCreature(
            origin.x, origin.y, origin.z,
            target.x, target.y, target.z,
            sel.creatureName, sel.isNpc,
          )
          // Update selection to new position
          const updated: SelectedCreatureInfo = { ...sel, x: target.x, y: target.y, z: target.z }
          ctx.selectedCreatureRef.current = updated
          ctx.setSelectedCreature(updated)
          highlightTile(target)
        } else if (sel && sel.type === 'spawnZone') {
          // Move spawn zone: remove from source, place at destination
          const srcKey = `${origin.x},${origin.y},${origin.z}`
          const srcTile = ctx.mapData.tiles.get(srcKey)
          const spawnData = sel.spawnType === 'monster' ? srcTile?.spawnMonster : srcTile?.spawnNpc
          if (spawnData) {
            ctx.mutator.beginBatch('Move spawn zone')
            ctx.mutator.removeSpawnZone(origin.x, origin.y, origin.z, sel.spawnType)
            ctx.mutator.placeSpawnZone(target.x, target.y, target.z, sel.spawnType, spawnData.radius)
            ctx.mutator.commitBatch()
            const updated: SelectedCreatureInfo = { ...sel, x: target.x, y: target.y, z: target.z }
            ctx.selectedCreatureRef.current = updated
            ctx.setSelectedCreature(updated)
            highlightTile(target)
          }
        }
      }
      ctx.selectStartRef.current = null
      ctx.isShiftDragRef.current = false
      ctx.isCtrlDragRef.current = false

      if (!didMove && ctx.clickToInspectRef.current) {
        const key = `${pos.x},${pos.y},${pos.z}`
        const tile = ctx.mapData.tiles.get(key) ?? null
        ctx.renderer.onTileClick?.(tile, pos.x, pos.y)
      }
      return
    }

    // Waypoint drag-move
    if (wasWaypointDrag && draggedWaypointName) {
      if (didMove) {
        const wm = ctx.mutator.waypointManager
        if (wm && !wm.hasPosition(target.x, target.y, target.z)) {
          ctx.mutator.moveWaypoint(draggedWaypointName, target.x, target.y, target.z)
        }
      }
      ctx.selectStartRef.current = null
      ctx.isShiftDragRef.current = false
      ctx.isCtrlDragRef.current = false
      return
    }

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

      // Phase 1: Snapshot all items to move before any mutations
      const moveOps: { srcX: number; srcY: number; srcZ: number; indices: number[]; items: OtbmItem[] }[] = []
      for (const [, tileItems] of byTile) {
        const uniqueIndices = [...new Set(tileItems.map(t => t.itemIndex))].sort((a, b) => b - a)
        const srcX = tileItems[0].x
        const srcY = tileItems[0].y
        const srcZ = tileItems[0].z
        const tileKey = `${srcX},${srcY},${srcZ}`
        const tile = ctx.mapData.tiles.get(tileKey)
        if (!tile) continue

        const snapshotItems: OtbmItem[] = []
        for (const idx of uniqueIndices) {
          if (idx >= tile.items.length) continue
          snapshotItems.unshift(deepCloneItem(tile.items[idx]))
        }
        moveOps.push({ srcX, srcY, srcZ, indices: uniqueIndices, items: snapshotItems })
      }

      ctx.mutator.beginBatch('Move items')

      // Phase 2: Remove all items from source tiles (reverse index order already ensures safe removal)
      for (const op of moveOps) {
        for (const idx of op.indices) {
          const tileKey = `${op.srcX},${op.srcY},${op.srcZ}`
          const tile = ctx.mapData.tiles.get(tileKey)
          if (!tile || idx >= tile.items.length) continue
          ctx.mutator.removeItem(op.srcX, op.srcY, op.srcZ, idx)
        }
      }

      // Phase 3: Add all items to destination tiles, tracking moved item IDs (with counts for duplicates)
      const movedCountsByTile = new Map<string, Map<number, number>>()
      for (const op of moveOps) {
        const destX = op.srcX + dx
        const destY = op.srcY + dy
        const destKey = `${destX},${destY},${op.srcZ}`
        let counts = movedCountsByTile.get(destKey)
        if (!counts) { counts = new Map(); movedCountsByTile.set(destKey, counts) }
        for (const item of op.items) {
          ctx.mutator.addItem(destX, destY, op.srcZ, item)
          counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
        }
      }

      ctx.mutator.commitBatch()

      // Rebuild selection from actual tile state to get correct indices
      const newItems: SelectedItemInfo[] = []
      for (const [destKey, idCounts] of movedCountsByTile) {
        const destTile = ctx.mapData.tiles.get(destKey)
        if (!destTile) continue
        const [dx_, dy_, dz_] = destKey.split(',').map(Number)
        const remaining = new Map(idCounts)
        for (let i = 0; i < destTile.items.length; i++) {
          const count = remaining.get(destTile.items[i].id)
          if (count && count > 0) {
            newItems.push({ x: dx_, y: dy_, z: dz_, itemIndex: i })
            remaining.set(destTile.items[i].id, count - 1)
          }
        }
      }

      ctx.setSelectedItems(newItems)
      ctx.selectedItemsRef.current = newItems
      ctx.applyHighlights(newItems)
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
        // Also clear creature selection when clicking truly empty tile
        if (!ctx.selectedCreatureRef.current) {
          ctx.setSelectedItems([])
          ctx.selectedItemsRef.current = []
          ctx.renderer.clearItemHighlight()
        }
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
