import type React from 'react'
import clsx from 'clsx'
import type { EditorTool, BrushShape, BrushSelection, ZoneSelection } from '../hooks/useEditorTools'
import type { AppearanceData } from '../lib/appearances'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import type { ItemRegistry } from '../lib/items'
import { getItemDisplayName } from '../lib/items'
import { getSelectionPreviewId, BRUSH_SIZE_TOOLS } from '../hooks/tools/types'
import { ItemSprite } from './ItemSprite'
import { MenuBar, type MenuSection } from './MenuBar'
import {
  DOOR_NORMAL, DOOR_LOCKED, DOOR_QUEST, DOOR_MAGIC,
  DOOR_WINDOW, DOOR_HATCH_WINDOW,
} from '../lib/brushes/WallTypes'
import { ZONE_FLAG_DEFS } from '../hooks/tools/types'
import {
  CursorIcon, PencilSimpleIcon, EraserIcon, DoorIcon, PaintBucketIcon, FlagIcon,
  ArrowCounterClockwiseIcon, ArrowClockwiseIcon, SquareIcon, CircleIcon,
  HouseIcon,
  PawPrintIcon,
  MapPinIcon,
} from '@phosphor-icons/react'
import type { EditorSettings, BooleanSettingKey } from '../lib/EditorSettings'

interface ToolbarProps {
  activeTool: EditorTool
  onToolChange: (tool: EditorTool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  selectedBrush: BrushSelection | null
  brushRegistry: BrushRegistry | null
  appearances: AppearanceData | null
  registry: ItemRegistry | null
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onDelete: () => void
  canPaste: boolean
  hasSelection: boolean
  onGoToPosition: () => void
  onFindItem: () => void
  onReplaceItems: () => void
  onOpenSettings: () => void
  onOpenMapProperties: () => void
  hasMap: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onBorderizeSelection: () => void
  onRandomizeSelection: () => void
  brushSize: number
  onBrushSizeChange: (size: number) => void
  brushShape: BrushShape
  onBrushShapeChange: (shape: BrushShape) => void
  activeDoorType: number
  onDoorTypeChange: (type: number) => void
  onSave: () => void
  canSave: boolean
  selectedZone: ZoneSelection | null
  onZoneSelect: (zone: ZoneSelection) => void
  onExportZones: () => void
  onImportZones: () => void
  onExportHouses: () => void
  onImportHouses: () => void
  onExportMonsterSpawns: () => void
  onImportMonsterSpawns: () => void
  onExportNpcSpawns: () => void
  onImportNpcSpawns: () => void
  onOpenEditTowns: () => void
  editorSettings: EditorSettings
  onToggleSetting: (key: BooleanSettingKey) => void
}

const BRUSH_SIZES = [
  { value: 0, label: '1' },
  { value: 1, label: '3' },
  { value: 2, label: '5' },
  { value: 3, label: '7' },
  { value: 4, label: '9' },
  { value: 5, label: '11' },
  { value: 6, label: '13' },
]

const ICON_SIZE = 18
const ICON_WEIGHT = 'bold' as const

const TOOLS: { id: EditorTool; label: string; shortcut: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select', shortcut: 'S', icon: <CursorIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'draw', label: 'Draw', shortcut: 'D', icon: <PencilSimpleIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'erase', label: 'Erase', shortcut: 'E', icon: <EraserIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'door', label: 'Door', shortcut: 'R', icon: <DoorIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'fill', label: 'Fill', shortcut: 'F', icon: <PaintBucketIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'zone', label: 'Zone', shortcut: 'Z', icon: <FlagIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'house', label: 'House', shortcut: 'H', icon: <HouseIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'creature', label: 'Creature', shortcut: 'C', icon: <PawPrintIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
  { id: 'waypoint', label: 'Waypoint', shortcut: 'W', icon: <MapPinIcon size={ICON_SIZE} weight={ICON_WEIGHT} /> },
]

const DOOR_TYPES = [
  { value: DOOR_NORMAL, label: 'Normal' },
  { value: DOOR_LOCKED, label: 'Locked' },
  { value: DOOR_QUEST, label: 'Quest' },
  { value: DOOR_MAGIC, label: 'Magic' },
  { value: DOOR_WINDOW, label: 'Window' },
  { value: DOOR_HATCH_WINDOW, label: 'Hatch' },
]

function getBrushLabel(sel: BrushSelection, registry: ItemRegistry | null, appearances: AppearanceData | null): string | null {
  switch (sel.mode) {
    case 'brush': return sel.brushName.replace(/\b\w/g, c => c.toUpperCase())
    case 'raw': return registry && appearances ? getItemDisplayName(sel.itemId, registry, appearances) : null
    case 'creature': return sel.creatureName
    case 'spawn': return `Spawn ${sel.spawnType}`
  }
}

function getBrushSubLabel(sel: BrushSelection): string {
  switch (sel.mode) {
    case 'brush': return sel.brushType
    case 'raw': return `#${sel.itemId}`
    case 'creature': return sel.isNpc ? 'npc' : 'monster'
    case 'spawn': return sel.spawnType
  }
}

export function Toolbar({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedBrush,
  brushRegistry,
  appearances,
  registry,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  canPaste,
  hasSelection,
  onGoToPosition,
  onFindItem,
  onReplaceItems,
  onOpenSettings,
  onOpenMapProperties,
  hasMap,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onBorderizeSelection,
  onRandomizeSelection,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
  activeDoorType,
  onDoorTypeChange,
  onSave,
  canSave,
  selectedZone,
  onZoneSelect,
  onExportZones,
  onImportZones,
  onExportHouses,
  onImportHouses,
  onExportMonsterSpawns,
  onImportMonsterSpawns,
  onExportNpcSpawns,
  onImportNpcSpawns,
  onOpenEditTowns,
  editorSettings,
  onToggleSetting,
}: ToolbarProps) {
  const previewId = selectedBrush ? getSelectionPreviewId(selectedBrush, brushRegistry) : 0
  const brushLabel = selectedBrush ? getBrushLabel(selectedBrush, registry, appearances) : null

  const menuSections: MenuSection[] = [
    {
      title: 'File',
      items: [
        { label: 'Save Map', shortcut: 'Ctrl+S', disabled: !canSave, onClick: onSave },
        'separator',
        {
          label: 'Import/Export',
          items: [
            { label: 'Import Zones...', onClick: onImportZones },
            { label: 'Export Zones', onClick: onExportZones },
            'separator',
            { label: 'Import Houses...', onClick: onImportHouses },
            { label: 'Export Houses', onClick: onExportHouses },
            'separator',
            { label: 'Import Monster Spawns...', onClick: onImportMonsterSpawns },
            { label: 'Export Monster Spawns', onClick: onExportMonsterSpawns },
            'separator',
            { label: 'Import NPC Spawns...', onClick: onImportNpcSpawns },
            { label: 'Export NPC Spawns', onClick: onExportNpcSpawns },
          ],
        },
      ],
    },
    {
      title: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !canUndo, onClick: onUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', disabled: !canRedo, onClick: onRedo },
        'separator',
        { label: 'Cut', shortcut: 'Ctrl+X', disabled: !hasSelection, onClick: onCut },
        { label: 'Copy', shortcut: 'Ctrl+C', disabled: !hasSelection, onClick: onCopy },
        { label: 'Paste', shortcut: 'Ctrl+V', disabled: !canPaste, onClick: onPaste },
        { label: 'Delete', shortcut: 'Del', disabled: !hasSelection, onClick: onDelete },
      ],
    },
    {
      title: 'Map',
      items: [
        { label: 'Go to Position...', shortcut: 'Ctrl+G', onClick: onGoToPosition },
        { label: 'Find Item...', shortcut: 'Ctrl+F', onClick: onFindItem },
        { label: 'Replace Items...', shortcut: 'Ctrl+H', onClick: onReplaceItems },
        'separator',
        { label: 'Borderize Selection', shortcut: 'Ctrl+B', disabled: !hasSelection, onClick: onBorderizeSelection },
        { label: 'Randomize Selection', shortcut: 'Ctrl+Shift+R', disabled: !hasSelection, onClick: onRandomizeSelection },
        'separator',
        { label: 'Map Properties...', disabled: !hasMap, onClick: onOpenMapProperties },
        { label: 'Edit Towns...', disabled: !hasMap, onClick: onOpenEditTowns },
      ],
    },
    {
      title: 'View',
      items: [
        { heading: 'Palettes' },
        { label: 'Brush Palette', shortcut: 'P', checked: editorSettings.showPalette, onClick: () => onToggleSetting('showPalette') },
        { label: 'Zone Palette', shortcut: 'Z', checked: editorSettings.showZonePalette, onClick: () => onToggleSetting('showZonePalette') },
        { label: 'House Palette', shortcut: 'H', checked: editorSettings.showHousePalette, onClick: () => onToggleSetting('showHousePalette') },
        { label: 'Creature Palette', checked: editorSettings.showCreaturePalette, onClick: () => onToggleSetting('showCreaturePalette') },
        { label: 'Waypoint Palette', checked: editorSettings.showWaypointPalette, onClick: () => onToggleSetting('showWaypointPalette') },
        { heading: 'Rendering' },
        { label: 'Show Animations', checked: editorSettings.showAnimations, onClick: () => onToggleSetting('showAnimations') },
        { heading: 'Overlays' },
        { label: 'Show Zones', checked: editorSettings.showZoneOverlay, onClick: () => onToggleSetting('showZoneOverlay') },
        { label: 'Show Houses', checked: editorSettings.showHouseOverlay, onClick: () => onToggleSetting('showHouseOverlay') },
        { label: 'Show Waypoints', checked: editorSettings.showWaypointOverlay, onClick: () => onToggleSetting('showWaypointOverlay') },
        { label: 'Show Lights', shortcut: 'L', checked: editorSettings.showLights, onClick: () => onToggleSetting('showLights') },
        { label: 'Show Minimap', shortcut: 'Shift+M', checked: editorSettings.showMinimap, onClick: () => onToggleSetting('showMinimap') },
        { label: 'Show Grid', shortcut: 'Shift+G', checked: editorSettings.showGrid, onClick: () => onToggleSetting('showGrid') },
        { label: 'Client Box', checked: editorSettings.showClientBox, onClick: () => onToggleSetting('showClientBox') },
        { heading: 'Creatures' },
        { label: 'Show Monsters', shortcut: 'm', checked: editorSettings.showMonsters, onClick: () => onToggleSetting('showMonsters') },
        { label: 'Show Monster Spawns', shortcut: 'Ctrl+M', checked: editorSettings.showMonsterSpawns, onClick: () => onToggleSetting('showMonsterSpawns') },
        { label: 'Show NPCs', shortcut: 'N', checked: editorSettings.showNpcs, onClick: () => onToggleSetting('showNpcs') },
        { label: 'Show NPC Spawns', shortcut: 'Ctrl+N', checked: editorSettings.showNpcSpawns, onClick: () => onToggleSetting('showNpcSpawns') },
        { heading: 'Debug' },
        { label: 'Performance Stats', checked: editorSettings.showStats, onClick: () => onToggleSetting('showStats') },
        { heading: 'Zoom' },
        { label: 'Zoom In', shortcut: 'Ctrl+=', onClick: onZoomIn },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', onClick: onZoomOut },
        { label: 'Reset Zoom', shortcut: 'Ctrl+0', onClick: onResetZoom },
        'separator',
        { label: 'Settings...', onClick: onOpenSettings },
      ],
    },
  ]

  return (
    <div className="panel absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 px-5 py-3 pointer-events-auto select-none">
      {/* Menu bar */}
      <MenuBar sections={menuSections} />

      <div className="h-[22px] w-px shrink-0 bg-border-subtle" />

      {/* Tool buttons */}
      <div className="flex gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={clsx('btn btn-icon border-none bg-transparent', activeTool === tool.id && 'tool-active')}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="h-[22px] w-px shrink-0 bg-border-subtle" />

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          className="btn btn-icon border-none bg-transparent"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.45 }}
        >
          <ArrowCounterClockwiseIcon size={ICON_SIZE} weight={ICON_WEIGHT} />
        </button>
        <button
          className="btn btn-icon border-none bg-transparent"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ opacity: canRedo ? 1 : 0.45 }}
        >
          <ArrowClockwiseIcon size={ICON_SIZE} weight={ICON_WEIGHT} />
        </button>
      </div>

      {/* Brush size — for draw/erase */}
      {BRUSH_SIZE_TOOLS.has(activeTool) && (
        <>
          <div className="h-[22px] w-px shrink-0 bg-border-subtle" />
          <div className="flex gap-1">
            <span className="label self-center mr-1 text-xs">SIZE</span>
            {BRUSH_SIZES.map(({ value, label }) => (
              <button
                key={value}
                className={clsx(
                  'btn btn-icon min-w-[24px] border-none bg-transparent px-[4px] py-[2px] font-mono text-xs',
                  brushSize === value && 'tool-active',
                )}
                onClick={() => onBrushSizeChange(value)}
                title={`Brush size ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-1">
            <button
              className={clsx('btn btn-icon border-none bg-transparent', brushShape === 'square' && 'tool-active')}
              onClick={() => onBrushShapeChange('square')}
              title="Square brush"
            >
              <SquareIcon size={16} weight="bold" />
            </button>
            <button
              className={clsx('btn btn-icon border-none bg-transparent', brushShape === 'circle' && 'tool-active')}
              onClick={() => onBrushShapeChange('circle')}
              title="Circle brush"
            >
              <CircleIcon size={16} weight="bold" />
            </button>
          </div>
        </>
      )}

      {/* Flag selector — only for zone tool */}
      {activeTool === 'zone' && (
        <>
          <div className="h-[22px] w-px shrink-0 bg-border-subtle" />
          <div className="flex gap-1">
            <span className="label self-center mr-1 text-xs">FLAG</span>
            {ZONE_FLAG_DEFS.map(def => (
              <button
                key={def.flag}
                className={clsx(
                  'btn border-none bg-transparent px-[6px] py-[4px] font-display text-xs uppercase tracking-[0.04em] flex items-center gap-[5px]',
                  selectedZone?.type === 'flag' && selectedZone.flag === def.flag && 'tool-active',
                )}
                onClick={() => onZoneSelect({ type: 'flag', flag: def.flag, label: def.label })}
                title={def.label}
              >
                <span
                  className="inline-block h-[8px] w-[8px] rounded-full"
                  style={{ backgroundColor: `#${def.color.toString(16).padStart(6, '0')}` }}
                />
                {def.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Door type selector — only for door tool */}
      {activeTool === 'door' && (
        <>
          <div className="h-[22px] w-px shrink-0 bg-border-subtle" />
          <div className="flex gap-1">
            <span className="label self-center mr-1 text-xs">DOOR</span>
            {DOOR_TYPES.map(({ value, label }) => (
              <button
                key={value}
                className={clsx(
                  'btn border-none bg-transparent px-[6px] py-[4px] font-display text-xs uppercase tracking-[0.04em]',
                  activeDoorType === value && 'tool-active',
                )}
                onClick={() => onDoorTypeChange(value)}
                title={`${label} door`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Selected brush indicator */}
      {selectedBrush && previewId > 0 && appearances && (
        <>
          <div className="h-[22px] w-px shrink-0 bg-border-subtle" />
          <div className="flex items-center gap-2">
            <ItemSprite itemId={previewId} appearances={appearances} size={24} />
            <div className="flex flex-col gap-[1px]">
              <span className="max-w-[120px] truncate font-ui text-sm text-fg">
                {brushLabel}
              </span>
              <span className="font-mono text-xs text-fg-faint">
                {getBrushSubLabel(selectedBrush)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
