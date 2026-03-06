import type { ToolContext, TilePos } from './types'
import { getSelectionPreviewId, getTilesInBrush, getCopyBufferFootprint } from './types'

export function createHoverHandler(ctx: ToolContext) {
  function onHover(pos: TilePos) {
    ctx.hoverPosRef.current = pos

    // Paste preview mode: show clipboard ghost at hover position
    if (ctx.isPastingRef.current && ctx.copyBufferRef.current.canPaste()) {
      const buffer = ctx.copyBufferRef.current
      ctx.renderer.updatePastePreview(buffer, pos.x, pos.y, ctx.renderer.floor)
      ctx.renderer.updateBrushCursor(getCopyBufferFootprint(buffer, pos.x, pos.y, ctx.renderer.floor))
      ctx.renderer.clearGhostPreview()
      return
    }

    const tool = ctx.activeToolRef.current
    const size = (tool === 'draw' || tool === 'erase' || tool === 'door') ? ctx.brushSizeRef.current : 0
    // Fill tool always uses single-tile cursor
    const shape = ctx.brushShapeRef.current
    const tiles = getTilesInBrush(pos.x, pos.y, size, shape)
      .map(t => ({ x: t.x, y: t.y, z: pos.z }))
    ctx.renderer.updateBrushCursor(tiles)

    // Ghost sprite preview for draw/fill tool
    if (tool === 'draw' || tool === 'fill') {
      const selection = ctx.selectedBrushRef.current
      if (selection) {
        const previewId = getSelectionPreviewId(selection, ctx.brushRegistryRef.current)
        if (previewId > 0) {
          ctx.renderer.updateGhostPreview(previewId, tiles)
        } else {
          ctx.renderer.clearGhostPreview()
        }
      } else {
        ctx.renderer.clearGhostPreview()
      }
    } else {
      ctx.renderer.clearGhostPreview()
    }
  }

  return { onHover }
}
