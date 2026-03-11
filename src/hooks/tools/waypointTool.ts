import type { ToolContext, TilePos } from './types'

export function createWaypointHandlers(ctx: ToolContext) {
  let dragWaypointName: string | null = null
  let dragStartPos: TilePos | null = null

  function onDown(pos: TilePos, event: PointerEvent) {
    const wm = ctx.mutator.waypointManager
    if (!wm) return

    dragWaypointName = null
    dragStartPos = null

    const isRightClick = event.button === 2

    if (isRightClick) {
      // Right-click: remove waypoint at position
      const existing = wm.getByPosition(pos.x, pos.y, pos.z)
      if (existing) {
        ctx.mutator.removeWaypoint(existing.name)
      }
      return
    }

    // Left-click: check if waypoint exists at position
    const existing = wm.getByPosition(pos.x, pos.y, pos.z)
    if (existing) {
      // Select and start potential drag
      ctx.onWaypointSelected?.(existing.name)
      dragWaypointName = existing.name
      dragStartPos = { ...pos }
    } else {
      // Place new waypoint
      const name = wm.generateUniqueName()
      ctx.mutator.addWaypoint(name, pos.x, pos.y, pos.z)
      ctx.onWaypointSelected?.(name)
    }
  }

  function onMove(pos: TilePos) {
    if (dragWaypointName) {
      ctx.renderer.setWaypointDragGhost(pos.x, pos.y, pos.z)
    }
  }

  function onUp(pos: TilePos) {
    if (!dragWaypointName || !dragStartPos) {
      dragWaypointName = null
      dragStartPos = null
      return
    }

    const wm = ctx.mutator.waypointManager
    if (!wm) { dragWaypointName = null; dragStartPos = null; return }

    ctx.renderer.clearWaypointDragGhost()

    // Only move if the position actually changed
    if (pos.x !== dragStartPos.x || pos.y !== dragStartPos.y || pos.z !== dragStartPos.z) {
      // Check target position is free
      if (!wm.hasPosition(pos.x, pos.y, pos.z)) {
        ctx.mutator.moveWaypoint(dragWaypointName, pos.x, pos.y, pos.z)
      }
    }

    dragWaypointName = null
    dragStartPos = null
  }

  return { onDown, onMove, onUp }
}
