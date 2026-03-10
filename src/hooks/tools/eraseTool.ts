import type { ToolContext, TilePos } from './types'
import { getTilesInBrush } from './types'
import { tileKey } from '../../lib/otbm'

export function createEraseHandlers(ctx: ToolContext) {
  function eraseTile(x: number, y: number, z: number) {
    const settings = ctx.settingsRef.current

    // Remove all non-ground items (optionally preserving unique/border items)
    ctx.mutator.eraseAllItems(x, y, z, {
      leaveUnique: settings.eraserLeaveUnique,
      cleanBorders: settings.autoMagic,
    })

    const tile = ctx.mapData.tiles.get(tileKey(x, y, z))
    if (tile) {
      // Clear zones and spawns/creatures unless keepZones is on
      if (!settings.eraserKeepZones) {
        ctx.mutator.clearAllTileZones(x, y, z)
        if (tile.spawnMonster) ctx.mutator.removeSpawnZone(x, y, z, 'monster')
        if (tile.spawnNpc) ctx.mutator.removeSpawnZone(x, y, z, 'npc')
        if (tile.monsters) {
          for (let i = tile.monsters.length - 1; i >= 0; i--) {
            ctx.mutator.removeCreature(x, y, z, tile.monsters[i].name, false)
          }
        }
        if (tile.npc) {
          ctx.mutator.removeCreature(x, y, z, tile.npc.name, true)
        }
      }

      // Clear map flags unless keepMapFlags is on
      if (!settings.eraserKeepMapFlags) {
        ctx.mutator.clearAllTileFlags(x, y, z)
      }
    }
  }

  /** Pass 1: erase tiles. Pass 2: reborder all affected tiles at once. */
  function eraseAndReborder(tiles: { x: number; y: number }[], z: number) {
    const settings = ctx.settingsRef.current
    // Pass 1: erase all tiles
    for (const t of tiles) {
      eraseTile(t.x, t.y, z)
    }
    // Pass 2: reborder in a single pass (RME two-pass approach)
    if (settings.autoMagic) {
      ctx.mutator.reborderAfterErase(tiles.map(t => ({ x: t.x, y: t.y, z })))
    }
  }

  function onDown(pos: TilePos) {
    ctx.paintedTilesRef.current.clear()
    ctx.mutator.beginBatch('Erase items')
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      ctx.paintedTilesRef.current.add(`${t.x},${t.y}`)
    }
    eraseAndReborder(tiles, pos.z)
    ctx.mutator.flushChunkUpdates()
  }

  function onMove(pos: TilePos) {
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    const newTiles: { x: number; y: number }[] = []
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      if (ctx.paintedTilesRef.current.has(key)) continue
      ctx.paintedTilesRef.current.add(key)
      newTiles.push(t)
    }
    if (newTiles.length > 0) {
      eraseAndReborder(newTiles, pos.z)
      ctx.mutator.flushChunkUpdates()
    }
  }

  return { onDown, onMove }
}
