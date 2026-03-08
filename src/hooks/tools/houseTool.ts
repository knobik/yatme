import type { ToolContext } from './types'
import { createPaintToolHandlers } from './paintTool'

export function createHouseHandlers(ctx: ToolContext) {
  return createPaintToolHandlers(ctx, {
    label: 'Paint house',
    eraseLabel: 'Remove house',
    isReady: () => ctx.selectedHouseRef.current != null,
    beginPaint: () => ctx.renderer.beginHousePaint(),
    endPaint: () => ctx.renderer.endHousePaint(),
    applyToTile: (x, y, z, erasing) => {
      const houseId = ctx.selectedHouseRef.current!
      if (erasing) {
        ctx.mutator.clearTileHouseId(x, y, z)
      } else {
        ctx.mutator.setTileHouseId(x, y, z, houseId)
      }
      const tile = ctx.mapData.tiles.get(`${x},${y},${z}`)
      if (tile) ctx.renderer.paintHouseTile(x, y, tile.houseId)
    },
  })
}
