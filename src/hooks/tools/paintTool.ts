import type { ToolContext, TilePos } from './types'
import { getTilesInBrush } from './types'

export interface PaintToolConfig {
  /** Label for the undo batch (e.g. 'Paint house', 'Paint zone'). */
  label: string
  /** Label for the erase undo batch. */
  eraseLabel: string
  /** Return true if the tool has a valid selection to paint. */
  isReady: () => boolean
  /** Apply the mutation + overlay paint for a single tile. */
  applyToTile: (x: number, y: number, z: number, erasing: boolean) => void
  /** Called before the first tile on pointer down (e.g. beginPaint on overlay). */
  beginPaint?: (erasing: boolean) => void
  /** Called after batch commit on pointer up (e.g. endPaint on overlay). */
  endPaint?: () => void
}

/**
 * Creates onDown/onMove/onUp handlers for brush-based paint tools (house, zone, etc.).
 * Handles brush size/shape, painted-tile dedup, batch management, and overlay lifecycle.
 */
export function createPaintToolHandlers(ctx: ToolContext, config: PaintToolConfig) {
  let isErasing = false

  function onDown(pos: TilePos, event: PointerEvent) {
    if (!config.isReady()) return
    isErasing = event.button === 2 || (event.button === 0 && (event.ctrlKey || event.metaKey))
    ctx.paintedTilesRef.current.clear()
    ctx.mutator.beginBatch(isErasing ? config.eraseLabel : config.label)
    config.beginPaint?.(isErasing)
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      ctx.paintedTilesRef.current.add(key)
      config.applyToTile(t.x, t.y, pos.z, isErasing)
    }
  }

  function onMove(pos: TilePos) {
    if (!config.isReady()) return
    const tiles = getTilesInBrush(pos.x, pos.y, ctx.brushSizeRef.current, ctx.brushShapeRef.current)
    for (const t of tiles) {
      const key = `${t.x},${t.y}`
      if (ctx.paintedTilesRef.current.has(key)) continue
      ctx.paintedTilesRef.current.add(key)
      config.applyToTile(t.x, t.y, pos.z, isErasing)
    }
  }

  function onUp() {
    ctx.paintedTilesRef.current.clear()
    ctx.mutator.commitBatch()
    config.endPaint?.()
  }

  return { onDown, onMove, onUp }
}
