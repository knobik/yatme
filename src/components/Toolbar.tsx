import type { EditorTool, BrushShape } from '../hooks/useEditorTools'
import type { AppearanceData } from '../lib/appearances'
import type { ItemRegistry } from '../lib/items'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'
import { HamburgerMenu, type MenuSection } from './HamburgerMenu'

interface ToolbarProps {
  activeTool: EditorTool
  onToolChange: (tool: EditorTool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  selectedItemId: number | null
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
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  brushSize: number
  onBrushSizeChange: (size: number) => void
  brushShape: BrushShape
  onBrushShapeChange: (shape: BrushShape) => void
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

const TOOLS: { id: EditorTool; label: string; shortcut: string; icon: JSX.Element }[] = [
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
]

export function Toolbar({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedItemId,
  appearances,
  registry,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  canPaste,
  hasSelection,
  onGoToPosition,
  showPalette,
  onTogglePalette,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
}: ToolbarProps) {
  const itemName = selectedItemId != null && registry && appearances
    ? getItemDisplayName(selectedItemId, registry, appearances)
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
        { label: 'Item Palette', shortcut: 'P', checked: showPalette, onClick: onTogglePalette },
        'separator',
        { label: 'Zoom In', shortcut: 'Ctrl+=', onClick: onZoomIn },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', onClick: onZoomOut },
        { label: 'Reset Zoom', shortcut: 'Ctrl+0', onClick: onResetZoom },
      ],
    },
  ]

  return (
    <div className="panel toolbar">
      {/* Hamburger menu */}
      <HamburgerMenu sections={menuSections} />

      <div className="separator-v" style={{ height: 22, flexShrink: 0 }} />

      {/* Tool buttons */}
      <div className="tool-group">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`btn btn-icon${activeTool === tool.id ? ' tool-active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            style={{ border: 'none', background: 'transparent' }}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="separator-v" style={{ height: 22, flexShrink: 0 }} />

      {/* Undo / Redo */}
      <div className="tool-group">
        <button
          className="btn btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ border: 'none', background: 'transparent', opacity: canUndo ? 1 : 0.3 }}
        >
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
            <path d="M3 5H9C10.66 5 12 6.34 12 8C12 9.66 10.66 11 9 11H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 2.5L3 5L5.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className="btn btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ border: 'none', background: 'transparent', opacity: canRedo ? 1 : 0.3 }}
        >
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
            <path d="M11 5H5C3.34 5 2 6.34 2 8C2 9.66 3.34 11 5 11H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8.5 2.5L11 5L8.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Brush size — only for draw/erase */}
      {(activeTool === 'draw' || activeTool === 'erase') && (
        <>
          <div className="separator-v" style={{ height: 22, flexShrink: 0 }} />
          <div className="tool-group">
            <span className="label" style={{ fontSize: 'var(--text-xs)', alignSelf: 'center', marginRight: 'var(--space-1)' }}>SIZE</span>
            {BRUSH_SIZES.map(({ value, label }) => (
              <button
                key={value}
                className={`btn btn-icon${brushSize === value ? ' tool-active' : ''}`}
                onClick={() => onBrushSizeChange(value)}
                title={`Brush size ${label}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  minWidth: 24,
                  padding: '2px 4px',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="tool-group" style={{ marginLeft: 'var(--space-1)' }}>
            <button
              className={`btn btn-icon${brushShape === 'square' ? ' tool-active' : ''}`}
              onClick={() => onBrushShapeChange('square')}
              title="Square brush"
              style={{ border: 'none', background: 'transparent' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
            <button
              className={`btn btn-icon${brushShape === 'circle' ? ' tool-active' : ''}`}
              onClick={() => onBrushShapeChange('circle')}
              title="Circle brush"
              style={{ border: 'none', background: 'transparent' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Selected item indicator */}
      {selectedItemId != null && appearances && (
        <>
          <div className="separator-v" style={{ height: 22, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ItemSprite itemId={selectedItemId} appearances={appearances} size={24} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {itemName}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
              }}>
                #{selectedItemId}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
