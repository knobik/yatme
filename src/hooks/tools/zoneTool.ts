import type { ToolContext, TilePos } from './types'
import { getTilesInBrush } from './types'

export function createZoneHandlers(ctx: ToolContext) {
  let isErasing = false
  function applyToTile(x: number, y: number, z: number) {
    const zone = ctx.selectedZoneRef.current
    if (!zone) return

    if (zone.type === 'flag') {
      if (isErasing) {
        ctx.mutator.clearTileFlag(x, y, z, zone.flag)
      } else {
        ctx.mutator.setTileFlag(x, y, z, zone.flag)
      }
    } else {
      if (isErasing) {
        ctx.mutator.removeTileZone(x, y, z, zone.zoneId)
      } else {
        ctx.mutator.addTileZone(x, y, z, zone.zoneId)
      }
    }

    // Draw the tile incrementally on the zone overlay
    const tile = ctx.mapData.tiles.get(`${x},${y},${z}`)
    if (tile) {
      ctx.renderer.paintZoneTile(x, y, tile.flags, tile.zones)
    }
  }

  function onDown(pos: TilePos, event: PointerEvent) {
    const zone = ctx.selectedZoneRef.current
    if (!zone) return
    isErasing = event.button === 2
    ctx.paintedTilesRef.current.clear()
    ctx.mutator.beginBatch(isErasing ? 'Remove zone' : 'Paint zone')
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      ctx.paintedTilesRef.current.add(key)
      applyToTile(t.x, t.y, pos.z)
    }
    ctx.mutator.flushChunkUpdates()
  }

  function onMove(pos: TilePos) {
    const zone = ctx.selectedZoneRef.current
    if (!zone) return
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    let any = false
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      if (ctx.paintedTilesRef.current.has(key)) continue
      ctx.paintedTilesRef.current.add(key)
      applyToTile(t.x, t.y, pos.z)
      any = true
    }
    if (any) ctx.mutator.flushChunkUpdates()
  }

  return { onDown, onMove }
}
