import type { ToolContext } from './types'
import { createPaintToolHandlers } from './paintTool'

export function createZoneHandlers(ctx: ToolContext) {
  return createPaintToolHandlers(ctx, {
    label: 'Paint zone',
    eraseLabel: 'Remove zone',
    isReady: () => ctx.selectedZoneRef.current != null,
    applyToTile: (x, y, z, erasing) => {
      const zone = ctx.selectedZoneRef.current!
      if (zone.type === 'flag') {
        if (erasing) ctx.mutator.clearTileFlag(x, y, z, zone.flag)
        else ctx.mutator.setTileFlag(x, y, z, zone.flag)
      } else {
        if (erasing) ctx.mutator.removeTileZone(x, y, z, zone.zoneId)
        else ctx.mutator.addTileZone(x, y, z, zone.zoneId)
      }
      ctx.renderer.paintZoneTile(x, y)
    },
  })
}
