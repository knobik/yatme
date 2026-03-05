import type { ToolContext, TilePos } from './types'
import { getTilesInBrush } from './types'

export function createEraseHandlers(ctx: ToolContext) {
  function onDown(pos: TilePos) {
    ctx.paintedTilesRef.current.clear()
    ctx.mutator.beginBatch('Erase items')
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      ctx.paintedTilesRef.current.add(key)
      ctx.mutator.removeTopItem(t.x, t.y, pos.z)
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
      ctx.mutator.removeTopItem(t.x, t.y, pos.z)
      any = true
    }
    if (any) ctx.mutator.flushChunkUpdates()
  }

  return { onDown, onMove }
}
