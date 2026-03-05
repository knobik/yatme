import type { ToolContext, TilePos } from './types'
import { resolveBrush, getPreviewItemId, getTilesInBrush, getClipboardFootprint } from './types'

export function createHoverHandler(ctx: ToolContext) {
  function onHover(pos: TilePos) {
    ctx.hoverPosRef.current = pos

    // Paste preview mode: show clipboard ghost at hover position
    if (ctx.isPastingRef.current && ctx.clipboardRef.current) {
      const cb = ctx.clipboardRef.current
      ctx.renderer.updatePastePreview(cb, pos.x, pos.y, ctx.renderer.floor)
      ctx.renderer.updateBrushCursor(getClipboardFootprint(cb, pos.x, pos.y, ctx.renderer.floor))
      ctx.renderer.clearGhostPreview()
      return
    }

    const tool = ctx.activeToolRef.current
    const size = (tool === 'draw' || tool === 'erase' || tool === 'door') ? ctx.brushSizeRef.current : 0
    const shape = ctx.brushShapeRef.current
    const tiles = getTilesInBrush(pos.x, pos.y, size, shape)
      .map(t => ({ x: t.x, y: t.y, z: pos.z }))
    ctx.renderer.updateBrushCursor(tiles)

    // Ghost sprite preview for draw tool
    if (tool === 'draw') {
      const itemId = ctx.selectedItemIdRef.current
      if (itemId != null) {
        const brush = resolveBrush(itemId, ctx.brushRegistryRef.current)
        ctx.renderer.updateGhostPreview(getPreviewItemId(brush, itemId), tiles)
      } else {
        ctx.renderer.clearGhostPreview()
      }
    } else {
      ctx.renderer.clearGhostPreview()
    }
  }

  return { onHover }
}
