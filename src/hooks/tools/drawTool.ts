import type { ToolContext } from './types'
import { resolveBrush, brushBatchName, eraseBatchName, applyBrushToTile, eraseBrushFromTile } from './types'
import { createPaintToolHandlers } from './paintTool'

export function createDrawHandlers(ctx: ToolContext) {
  function resolveLabel(erase: boolean): string {
    const selection = ctx.selectedBrushRef.current
    if (!selection) return erase ? 'Erase' : 'Draw'
    const brush = resolveBrush(selection, ctx.brushRegistryRef.current)
    return erase ? eraseBatchName(brush) : brushBatchName(brush)
  }

  return createPaintToolHandlers(ctx, {
    get label() { return resolveLabel(false) },
    get eraseLabel() { return resolveLabel(true) },
    isReady: () => ctx.selectedBrushRef.current != null,
    flushChunks: true,
    applyToTile: (x, y, z, erasing) => {
      const selection = ctx.selectedBrushRef.current
      if (!selection) return
      const brush = resolveBrush(selection, ctx.brushRegistryRef.current)
      if (erasing) {
        eraseBrushFromTile(ctx.mutator, x, y, z, brush, ctx.brushRegistryRef.current)
      } else {
        applyBrushToTile(ctx.mutator, x, y, z, brush, ctx.brushSizeRef.current)
      }
    },
  })
}
