import type React from 'react'
import clsx from 'clsx'
import type { EditorTool, BrushShape, BrushSelection } from '../hooks/useEditorTools'
import type { AppearanceData } from '../lib/appearances'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import type { ItemRegistry } from '../lib/items'
import { getItemDisplayName } from '../lib/items'
import { getSelectionPreviewId } from '../hooks/tools/types'
import { ItemSprite } from './ItemSprite'
import { HamburgerMenu, type MenuSection } from './HamburgerMenu'
import {
  DOOR_NORMAL, DOOR_LOCKED, DOOR_QUEST, DOOR_MAGIC,
  DOOR_WINDOW, DOOR_HATCH_WINDOW,
} from '../lib/brushes/WallTypes'

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
  showPalette: boolean
  onTogglePalette: () => void
  showLights: boolean
  onToggleLights: () => void
  onOpenSettings: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  brushSize: number
  onBrushSizeChange: (size: number) => void
  brushShape: BrushShape
  onBrushShapeChange: (shape: BrushShape) => void
  activeDoorType: number
  onDoorTypeChange: (type: number) => void
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

const TOOLS: { id: EditorTool; label: string; shortcut: string; icon: React.ReactElement }[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'S',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <path d="M2 1L2 11L5.5 7.5L8.5 13L10.5 12L7.5 6L12 5L2 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'draw',
    label: 'Draw',
    shortcut: 'D',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <path d="M8.5 2.5L11.5 5.5M2 12L2.5 9.5L10 2C10.8-0.8 13.2 1.2 11.5 2.5L4 10L2 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'erase',
    label: 'Erase',
    shortcut: 'E',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <path d="M5 12H12M3 9.5L7.5 2.5L11.5 5.5L7 12.5L3 9.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M7 12.5L3 9.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: 'door',
    label: 'Door',
    shortcut: 'R',
    icon: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <rect x="3" y="1.5" width="8" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="9" cy="7" r="0.8" fill="currentColor" />
        <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1" />
      </svg>
    ),
  },
]

const DOOR_TYPES = [
  { value: DOOR_NORMAL, label: 'Normal' },
  { value: DOOR_LOCKED, label: 'Locked' },
  { value: DOOR_QUEST, label: 'Quest' },
  { value: DOOR_MAGIC, label: 'Magic' },
  { value: DOOR_WINDOW, label: 'Window' },
  { value: DOOR_HATCH_WINDOW, label: 'Hatch' },
]

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
  onOpenSettings,
  showPalette,
  onTogglePalette,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
  activeDoorType,
  onDoorTypeChange,
  showLights,
  onToggleLights,
}: ToolbarProps) {
  const previewId = selectedBrush ? getSelectionPreviewId(selectedBrush, brushRegistry) : 0
  const brushLabel = selectedBrush
    ? selectedBrush.mode === 'brush'
      ? selectedBrush.brushName.replace(/\b\w/g, c => c.toUpperCase())
      : (registry && appearances ? getItemDisplayName(selectedBrush.itemId, registry, appearances) : null)
    : null

  const menuSections: MenuSection[] = [
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
      ],
    },
    {
      title: 'View',
      items: [
        { label: 'Brush Palette', shortcut: 'P', checked: showPalette, onClick: onTogglePalette },
        { label: 'Show Lights', shortcut: 'L', checked: showLights, onClick: onToggleLights },
        'separator',
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
      {/* Hamburger menu */}
      <HamburgerMenu sections={menuSections} />

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
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
            <path d="M3 5H9C10.66 5 12 6.34 12 8C12 9.66 10.66 11 9 11H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 2.5L3 5L5.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className="btn btn-icon border-none bg-transparent"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ opacity: canRedo ? 1 : 0.45 }}
        >
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
            <path d="M11 5H5C3.34 5 2 6.34 2 8C2 9.66 3.34 11 5 11H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8.5 2.5L11 5L8.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Brush size — for draw/erase */}
      {(activeTool === 'draw' || activeTool === 'erase') && (
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
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
            <button
              className={clsx('btn btn-icon border-none bg-transparent', brushShape === 'circle' && 'tool-active')}
              onClick={() => onBrushShapeChange('circle')}
              title="Circle brush"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
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
                {selectedBrush.mode === 'brush' ? selectedBrush.brushType : `#${selectedBrush.itemId}`}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
