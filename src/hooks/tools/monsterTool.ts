import type { ToolContext } from './types'
import { createPaintToolHandlers } from './paintTool'

export function createMonsterHandlers(ctx: ToolContext) {
  return createPaintToolHandlers(ctx, {
    label: 'Place monster',
    eraseLabel: 'Remove monsters',
    isReady: () => ctx.selectedMonsterRef.current != null,
    applyToTile: (x, y, z, erasing) => {
      if (erasing) {
        ctx.mutator.removeCreaturesAt(x, y, z)
      } else {
        const m = ctx.selectedMonsterRef.current!
        ctx.mutator.placeMonster(x, y, z, m.name, m.spawnTime, m.direction)
      }
      ctx.renderer.markSpawnOverlayDirty()
    },
  })
}
