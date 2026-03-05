import type { MapRenderer } from '../../lib/MapRenderer'
import type { MapMutator } from '../../lib/MapMutator'
import type { OtbmMap } from '../../lib/otbm'
import type { BrushRegistry } from '../../lib/brushes/BrushRegistry'
import type { GroundBrush } from '../../lib/brushes/BrushTypes'
import type { WallBrush } from '../../lib/brushes/WallTypes'
import type { CarpetBrush, TableBrush } from '../../lib/brushes/CarpetTypes'
import type { DoodadBrush } from '../../lib/brushes/DoodadTypes'
import type { SelectedItemInfo } from '../useSelection'

export type EditorTool = 'select' | 'draw' | 'erase' | 'door'
export type BrushShape = 'square' | 'circle'

export interface TilePos {
  x: number
  y: number
  z: number
}

/** Shared context passed to all tool handler factories. */
export interface ToolContext {
  mutator: MapMutator
  renderer: MapRenderer
  mapData: OtbmMap
  // Brush config refs
  selectedItemIdRef: React.RefObject<number | null>
  brushSizeRef: React.RefObject<number>
  brushShapeRef: React.RefObject<BrushShape>
  brushRegistryRef: React.RefObject<BrushRegistry | null>
  activeDoorTypeRef: React.RefObject<number>
  // Shared drag state
  paintedTilesRef: React.MutableRefObject<Set<string>>
  isDraggingRef: React.MutableRefObject<boolean>
  // Selection
  selectedItemsRef: React.MutableRefObject<SelectedItemInfo[]>
  setSelectedItems: (items: SelectedItemInfo[]) => void
  applyHighlights: (items: SelectedItemInfo[]) => void
  // Select tool drag state
  selectStartRef: React.MutableRefObject<TilePos | null>
  isShiftDragRef: React.MutableRefObject<boolean>
  isCtrlDragRef: React.MutableRefObject<boolean>
  selectedItemsSnapshotRef: React.MutableRefObject<SelectedItemInfo[]>
  // Drag-move state
  isDragMovingRef: React.MutableRefObject<boolean>
  dragMoveOriginRef: React.MutableRefObject<TilePos | null>
  dragMoveLastPosRef: React.MutableRefObject<TilePos | null>
  hoverPosRef: React.MutableRefObject<TilePos | null>
  // Callbacks
  onRequestEditItemRef: React.MutableRefObject<((x: number, y: number, z: number, itemIndex: number) => void) | undefined>
  clickToInspectRef: React.MutableRefObject<boolean>
  // Paste state
  isPastingRef: React.MutableRefObject<boolean>
  clipboardRef: React.MutableRefObject<ClipboardData | null>
  executePasteAt: (targetX: number, targetY: number, targetZ: number) => void
  cancelPaste: () => void
  // Active tool
  activeToolRef: React.MutableRefObject<EditorTool>
}

// ── Brush resolution ─────────────────────────────────────────────────

export type ResolvedBrush =
  | { type: 'ground'; brush: GroundBrush; registry: BrushRegistry }
  | { type: 'door'; doorType: number; registry: BrushRegistry }
  | { type: 'wall'; brush: WallBrush; registry: BrushRegistry }
  | { type: 'carpet'; brush: CarpetBrush; registry: BrushRegistry }
  | { type: 'table'; brush: TableBrush; registry: BrushRegistry }
  | { type: 'doodad'; brush: DoodadBrush; registry: BrushRegistry }
  | { type: 'raw'; itemId: number }

export function resolveBrush(itemId: number, registry: BrushRegistry | null): ResolvedBrush {
  if (registry) {
    const ground = registry.getBrushForItem(itemId)
    if (ground) return { type: 'ground', brush: ground, registry }
    const door = registry.getDoorInfo(itemId)
    if (door) return { type: 'door', doorType: door.type, registry }
    const wall = registry.getWallBrushForItem(itemId)
    if (wall) return { type: 'wall', brush: wall, registry }
    const carpet = registry.getCarpetBrushForItem(itemId)
    if (carpet) return { type: 'carpet', brush: carpet, registry }
    const table = registry.getTableBrushForItem(itemId)
    if (table) return { type: 'table', brush: table, registry }
    const doodad = registry.getDoodadBrushForItem(itemId)
    if (doodad) return { type: 'doodad', brush: doodad, registry }
  }
  return { type: 'raw', itemId }
}

export function brushBatchName(brush: ResolvedBrush): string {
  switch (brush.type) {
    case 'ground': return 'Paint ground'
    case 'door': return 'Place door'
    case 'wall': return 'Paint wall'
    case 'carpet': return 'Paint carpet'
    case 'table': return 'Paint table'
    case 'doodad': return 'Paint doodad'
    case 'raw': return 'Draw items'
  }
}

export function applyBrushToTile(
  mutator: MapMutator, x: number, y: number, z: number,
  brush: ResolvedBrush, brushSize: number,
): void {
  switch (brush.type) {
    case 'ground': mutator.paintGround(x, y, z, brush.brush, brush.registry); break
    case 'door': mutator.paintDoor(x, y, z, brush.doorType, brush.registry); break
    case 'wall': mutator.paintWall(x, y, z, brush.brush, brush.registry); break
    case 'carpet': mutator.paintCarpet(x, y, z, brush.brush, brush.registry); break
    case 'table': mutator.paintTable(x, y, z, brush.brush, brush.registry); break
    case 'doodad':
      if (brushSize > 0 && Math.random() * brush.brush.thicknessCeiling >= brush.brush.thickness) return
      mutator.paintDoodad(x, y, z, brush.brush, brush.registry)
      break
    case 'raw': mutator.addItem(x, y, z, { id: brush.itemId }); break
  }
}

export function getPreviewItemId(brush: ResolvedBrush, fallbackId: number): number {
  switch (brush.type) {
    case 'ground': return brush.brush.lookId > 0 ? brush.brush.lookId : fallbackId
    case 'wall': return brush.brush.lookId > 0 ? brush.brush.lookId : fallbackId
    case 'carpet': return brush.brush.lookId > 0 ? brush.brush.lookId : fallbackId
    case 'table': return brush.brush.lookId > 0 ? brush.brush.lookId : fallbackId
    case 'doodad': return brush.brush.lookId > 0 ? brush.brush.lookId : fallbackId
    default: return fallbackId
  }
}

export function getTilesInBrush(cx: number, cy: number, size: number, shape: BrushShape): { x: number; y: number }[] {
  if (size === 0) return [{ x: cx, y: cy }]
  const tiles: { x: number; y: number }[] = []
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      if (shape === 'square' || Math.sqrt(dx * dx + dy * dy) < size + 0.005) {
        tiles.push({ x: cx + dx, y: cy + dy })
      }
    }
  }
  return tiles
}

export interface ClipboardData {
  originX: number
  originY: number
  z: number
  tiles: { dx: number; dy: number; items: import('../../lib/otbm').OtbmItem[] }[]
}

export function getClipboardFootprint(cb: ClipboardData, targetX: number, targetY: number, targetZ: number): TilePos[] {
  return cb.tiles.map(t => ({ x: targetX + t.dx, y: targetY + t.dy, z: targetZ }))
}
