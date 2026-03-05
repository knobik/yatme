import type { ToolContext, TilePos } from './types'
import { resolveBrush, brushBatchName, applyBrushToTile, getTilesInBrush } from './types'

export function createDrawHandlers(ctx: ToolContext) {
  function onDown(pos: TilePos) {
    const itemId = ctx.selectedItemIdRef.current
    if (itemId == null) return
    ctx.paintedTilesRef.current.clear()
    const brush = resolveBrush(itemId, ctx.brushRegistryRef.current)
    ctx.mutator.beginBatch(brushBatchName(brush))
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      ctx.paintedTilesRef.current.add(key)
      applyBrushToTile(ctx.mutator, t.x, t.y, pos.z, brush, ctx.brushSizeRef.current)
    }
    ctx.mutator.flushChunkUpdates()
  }

  function onMove(pos: TilePos) {
    const itemId = ctx.selectedItemIdRef.current
    if (itemId == null) return
    const brush = resolveBrush(itemId, ctx.brushRegistryRef.current)
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    let any = false
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      if (ctx.paintedTilesRef.current.has(key)) continue
      ctx.paintedTilesRef.current.add(key)
      applyBrushToTile(ctx.mutator, t.x, t.y, pos.z, brush, ctx.brushSizeRef.current)
      any = true
    }
    if (any) ctx.mutator.flushChunkUpdates()
  }

  return { onDown, onMove }
}
