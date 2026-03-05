import type { ToolContext, TilePos } from './types'
import { getTilesInBrush } from './types'

export function createDoorHandlers(ctx: ToolContext) {
  function onDown(pos: TilePos) {
    const registry = ctx.brushRegistryRef.current
    if (!registry) return
    const doorType = ctx.activeDoorTypeRef.current
    ctx.paintedTilesRef.current.clear()
    ctx.mutator.beginBatch('Place door')
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      ctx.paintedTilesRef.current.add(key)
      ctx.mutator.paintDoor(t.x, t.y, pos.z, doorType, registry)
    }
    ctx.mutator.flushChunkUpdates()
  }

  function onMove(pos: TilePos) {
    const registry = ctx.brushRegistryRef.current
    if (!registry) return
    const doorType = ctx.activeDoorTypeRef.current
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    let any = false
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      if (ctx.paintedTilesRef.current.has(key)) continue
      ctx.paintedTilesRef.current.add(key)
      ctx.mutator.paintDoor(t.x, t.y, pos.z, doorType, registry)
      any = true
    }
    if (any) ctx.mutator.flushChunkUpdates()
  }

  return { onDown, onMove }
}
