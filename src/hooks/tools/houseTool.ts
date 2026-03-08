import type { ToolContext } from './types'
import { createPaintToolHandlers } from './paintTool'

export function createHouseHandlers(ctx: ToolContext) {
  return createPaintToolHandlers(ctx, {
    label: 'Paint house',
    eraseLabel: 'Remove house',
    isReady: () => ctx.selectedHouseRef.current != null,
    applyToTile: (x, y, z, erasing) => {
      const houseId = ctx.selectedHouseRef.current!
      if (erasing) {
        ctx.mutator.clearTileHouseId(x, y, z)
      } else {
        ctx.mutator.setTileHouseId(x, y, z, houseId)
      }
      ctx.renderer.paintHouseTile(x, y)
    },
  })
}
