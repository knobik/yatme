import type { ToolContext, TilePos } from './types'
import { resolveBrush } from './types'
import type { GroundBrush } from '../../lib/brushes/BrushTypes'

const MAX_FILL_TILES = 4096
const MAX_FILL_RADIUS = 64

export function createFillHandlers(ctx: ToolContext) {
  function resolveGroundBrush(): GroundBrush | null {
    const selection = ctx.selectedBrushRef.current
    if (!selection) return null
    const registry = ctx.brushRegistryRef.current
    if (!registry) return null

    // Try standard brush resolution first
    const resolved = resolveBrush(selection, registry)
    if (resolved.type === 'ground') return resolved.brush

    // For raw items, check if the item belongs to a ground brush
    if (resolved.type === 'raw' && resolved.itemId > 0) {
      return registry.getBrushForItem(resolved.itemId) ?? null
    }

    return null
  }

  function onDown(pos: TilePos) {
    const registry = ctx.brushRegistryRef.current
    if (!registry) return

    const newBrush = resolveGroundBrush()
    if (!newBrush) return

    // Determine the ground brush of the clicked tile
    const clickKey = `${pos.x},${pos.y},${pos.z}`
    const clickTile = ctx.mapData.tiles.get(clickKey)
    const clickGroundId = clickTile?.items[0]?.id
    const oldBrush = clickGroundId != null ? registry.getBrushForItem(clickGroundId) ?? null : null

    // Same brush → no-op
    if (oldBrush && oldBrush.name === newBrush.name) return

    // BFS flood fill
    const visited = new Set<string>()
    const queue: { x: number; y: number }[] = [{ x: pos.x, y: pos.y }]
    const toFill: { x: number; y: number }[] = []
    visited.add(`${pos.x},${pos.y}`)

    while (queue.length > 0 && toFill.length < MAX_FILL_TILES) {
      const cur = queue.shift()!

      // Radius check
      if (Math.abs(cur.x - pos.x) > MAX_FILL_RADIUS || Math.abs(cur.y - pos.y) > MAX_FILL_RADIUS) continue

      // Check if this tile matches the old brush
      const key = `${cur.x},${cur.y},${pos.z}`
      const tile = ctx.mapData.tiles.get(key)
      const groundId = tile?.items[0]?.id
      const tileBrush = groundId != null ? registry.getBrushForItem(groundId) ?? null : null

      // Match condition: same brush as clicked tile (both null = both empty, or same named brush)
      const matches = oldBrush === null
        ? tileBrush === null
        : tileBrush !== null && tileBrush.name === oldBrush.name

      if (!matches) continue

      toFill.push(cur)

      // Enqueue 4 neighbors
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = cur.x + dx
        const ny = cur.y + dy
        const nk = `${nx},${ny}`
        if (!visited.has(nk)) {
          visited.add(nk)
          queue.push({ x: nx, y: ny })
        }
      }
    }

    if (toFill.length === 0) return

    // Paint all collected tiles in a single batch
    ctx.mutator.beginBatch('Flood fill')
    for (const t of toFill) {
      ctx.mutator.paintGround(t.x, t.y, pos.z, newBrush)
    }
    ctx.mutator.flushChunkUpdates()
    ctx.mutator.commitBatch()
  }

  function onMove(_pos: TilePos) {
    // Flood fill is single-click only
  }

  return { onDown, onMove }
}
