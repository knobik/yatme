import type { MapRenderer } from '../../lib/MapRenderer'
import type { MapMutator } from '../../lib/MapMutator'
import type { OtbmMap } from '../../lib/otbm'
import type { BrushRegistry } from '../../lib/brushes/BrushRegistry'
import type { GroundBrush } from '../../lib/brushes/BrushTypes'
import type { WallBrush } from '../../lib/brushes/WallTypes'
import type { CarpetBrush, TableBrush } from '../../lib/brushes/CarpetTypes'
import type { DoodadBrush } from '../../lib/brushes/DoodadTypes'
import type { SelectedItemInfo } from '../useSelection'
import type { CopyBuffer } from '../../lib/CopyBuffer'

export type EditorTool = 'select' | 'draw' | 'erase' | 'door' | 'fill' | 'zone' | 'house'
export type BrushShape = 'square' | 'circle'

export type ZoneSelection =
  | { type: 'flag'; flag: number; label: string }
  | { type: 'zone'; zoneId: number; name: string }

export const ZONE_FLAG_DEFS = [
  { flag: 0x0001, label: 'PZ', color: 0x00c800 },
  { flag: 0x0004, label: 'No PvP', color: 0x0064c8 },
  { flag: 0x0008, label: 'No Logout', color: 0xc89600 },
  { flag: 0x0010, label: 'PvP Zone', color: 0xc80000 },
  { flag: 0x0020, label: 'Refresh', color: 0xc800c8 },
] as const

// ── Brush selection (what the user picked in the palette) ───────────

export type BrushSelectionBrushType = 'ground' | 'wall' | 'carpet' | 'table' | 'doodad'

export type BrushSelection =
  | { mode: 'brush'; brushType: BrushSelectionBrushType; brushName: string }
  | { mode: 'raw'; itemId: number }

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
  selectedBrushRef: React.RefObject<BrushSelection | null>
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
  copyBufferRef: React.MutableRefObject<CopyBuffer>
  executePasteAt: (targetX: number, targetY: number, targetZ: number) => void
  cancelPaste: () => void
  // Active tool
  activeToolRef: React.MutableRefObject<EditorTool>
  // Zone tool
  selectedZoneRef: React.RefObject<ZoneSelection | null>
  // House tool
  selectedHouseRef: React.RefObject<number | null>
}

// ── Brush resolution ─────────────────────────────────────────────────

export type ResolvedBrush =
  | { type: 'ground'; brush: GroundBrush }
  | { type: 'door'; doorType: number }
  | { type: 'wall'; brush: WallBrush }
  | { type: 'carpet'; brush: CarpetBrush }
  | { type: 'table'; brush: TableBrush }
  | { type: 'doodad'; brush: DoodadBrush }
  | { type: 'raw'; itemId: number }

export function resolveBrush(selection: BrushSelection, registry: BrushRegistry | null): ResolvedBrush {
  if (selection.mode === 'raw') {
    return { type: 'raw', itemId: selection.itemId }
  }

  // Brush mode — look up by name
  if (registry) {
    switch (selection.brushType) {
      case 'ground': {
        const brush = registry.getBrushByName(selection.brushName)
        if (brush) return { type: 'ground', brush }
        break
      }
      case 'wall': {
        const brush = registry.getWallBrushByName(selection.brushName)
        if (brush) return { type: 'wall', brush }
        break
      }
      case 'carpet': {
        const brush = registry.getCarpetBrushByName(selection.brushName)
        if (brush) return { type: 'carpet', brush }
        break
      }
      case 'table': {
        const brush = registry.getTableBrushByName(selection.brushName)
        if (brush) return { type: 'table', brush }
        break
      }
      case 'doodad': {
        const brush = registry.getDoodadBrushByName(selection.brushName)
        if (brush) return { type: 'doodad', brush }
        break
      }
    }
  }

  // Fallback: brush not found in registry
  return { type: 'raw', itemId: 0 }
}

const BRUSH_LABELS: Record<ResolvedBrush['type'], [string, string]> = {
  ground: ['Paint ground', 'Erase ground'],
  door:   ['Place door', 'Erase door'],
  wall:   ['Paint wall', 'Erase wall'],
  carpet: ['Paint carpet', 'Erase carpet'],
  table:  ['Paint table', 'Erase table'],
  doodad: ['Paint doodad', 'Erase doodad'],
  raw:    ['Draw items', 'Erase items'],
}

export function brushBatchName(brush: ResolvedBrush): string {
  return BRUSH_LABELS[brush.type][0]
}

export function applyBrushToTile(
  mutator: MapMutator, x: number, y: number, z: number,
  brush: ResolvedBrush, brushSize: number,
): void {
  switch (brush.type) {
    case 'ground': mutator.paintGround(x, y, z, brush.brush); break
    case 'door': mutator.paintDoor(x, y, z, brush.doorType); break
    case 'wall': mutator.paintWall(x, y, z, brush.brush); break
    case 'carpet': mutator.paintCarpet(x, y, z, brush.brush); break
    case 'table': mutator.paintTable(x, y, z, brush.brush); break
    case 'doodad':
      if (brushSize > 0 && Math.random() * brush.brush.thicknessCeiling >= brush.brush.thickness) return
      mutator.paintDoodad(x, y, z, brush.brush)
      break
    case 'raw': mutator.addItem(x, y, z, { id: brush.itemId }); break
  }
}

export function eraseBrushFromTile(
  mutator: MapMutator, x: number, y: number, z: number,
  brush: ResolvedBrush, registry: BrushRegistry | null,
): void {
  if (!registry) return
  switch (brush.type) {
    case 'ground': mutator.eraseGround(x, y, z, brush.brush); break
    case 'wall': mutator.eraseWall(x, y, z, brush.brush); break
    case 'carpet': mutator.eraseCarpet(x, y, z, brush.brush); break
    case 'table': mutator.eraseTable(x, y, z, brush.brush); break
    case 'doodad': {
      const b = brush.brush
      mutator.removeBrushItems(x, y, z, 'Erase doodad', id => registry.getDoodadBrushForItem(id)?.id === b.id)
      break
    }
    case 'raw': {
      const targetId = brush.itemId
      mutator.removeBrushItems(x, y, z, 'Erase item', id => id === targetId)
      break
    }
    case 'door': break // doors are removed via wall brush erase
  }
}

export function eraseBatchName(brush: ResolvedBrush): string {
  return BRUSH_LABELS[brush.type][1]
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

/** Get a preview item ID directly from a BrushSelection without full resolution. */
export function getSelectionPreviewId(selection: BrushSelection, registry: BrushRegistry | null): number {
  if (selection.mode === 'raw') return selection.itemId
  if (!registry) return 0
  switch (selection.brushType) {
    case 'ground': return registry.getBrushByName(selection.brushName)?.lookId ?? 0
    case 'wall': return registry.getWallBrushByName(selection.brushName)?.lookId ?? 0
    case 'carpet': return registry.getCarpetBrushByName(selection.brushName)?.lookId ?? 0
    case 'table': return registry.getTableBrushByName(selection.brushName)?.lookId ?? 0
    case 'doodad': return registry.getDoodadBrushByName(selection.brushName)?.lookId ?? 0
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

export function getCopyBufferFootprint(buffer: CopyBuffer, targetX: number, targetY: number, targetZ: number): TilePos[] {
  const result: TilePos[] = []
  for (const t of buffer.getTiles()) {
    const z = targetZ + t.dz
    if (z === targetZ) {
      result.push({ x: targetX + t.dx, y: targetY + t.dy, z })
    }
  }
  return result
}
