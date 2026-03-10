import type { ToolContext, TilePos } from './types'
import { getTilesInBrush } from './types'
import { tileKey } from '../../lib/otbm'

export function createEraseHandlers(ctx: ToolContext) {
  function eraseTile(x: number, y: number, z: number) {
    ctx.mutator.removeTopItem(x, y, z)
    // Also erase creatures and spawns
    const tile = ctx.mapData.tiles.get(tileKey(x, y, z))
    if (tile) {
      if (tile.monsters) {
        for (let i = tile.monsters.length - 1; i >= 0; i--) {
          ctx.mutator.removeCreature(x, y, z, tile.monsters[i].name, false)
        }
      }
      if (tile.npc) {
        ctx.mutator.removeCreature(x, y, z, tile.npc.name, true)
      }
      if (tile.spawnMonster) ctx.mutator.removeSpawnZone(x, y, z, 'monster')
      if (tile.spawnNpc) ctx.mutator.removeSpawnZone(x, y, z, 'npc')
    }
  }

  function onDown(pos: TilePos) {
    ctx.paintedTilesRef.current.clear()
    ctx.mutator.beginBatch('Erase items')
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      ctx.paintedTilesRef.current.add(key)
      eraseTile(t.x, t.y, pos.z)
    }
    ctx.mutator.flushChunkUpdates()
  }

  function onMove(pos: TilePos) {
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    let any = false
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      if (ctx.paintedTilesRef.current.has(key)) continue
      ctx.paintedTilesRef.current.add(key)
      eraseTile(t.x, t.y, pos.z)
      any = true
    }
    if (any) ctx.mutator.flushChunkUpdates()
  }

  return { onDown, onMove }
}
