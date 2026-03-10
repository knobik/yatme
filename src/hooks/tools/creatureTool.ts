import type { ToolContext } from './types'
import { createPaintToolHandlers } from './paintTool'
import { applyCreatureBrush, eraseCreatureBrush } from '../../lib/creatures/creatureBrushes'

export function createCreatureHandlers(ctx: ToolContext) {
  return createPaintToolHandlers(ctx, {
    label: 'Place creature',
    eraseLabel: 'Remove creature',
    flushChunks: true,
    isReady: () => {
      const sel = ctx.selectedBrushRef.current
      return sel?.mode === 'creature' || sel?.mode === 'spawn'
    },
    applyToTile: (x, y, z, erasing) => {
      const sel = ctx.selectedBrushRef.current!
      if (erasing) {
        eraseCreatureBrush(sel, ctx.mutator, x, y, z)
      } else {
        const settings = ctx.settingsRef.current
        applyCreatureBrush(
          sel, ctx.mutator, x, y, z,
          { spawnTime: 60, autoCreateSpawn: settings.autoCreateSpawn },
          ctx.mapData, ctx.mutator.getAppearances(), ctx.mutator.spawnManager!,
          ctx.brushSizeRef.current,
        )
      }
    },
  })
}
