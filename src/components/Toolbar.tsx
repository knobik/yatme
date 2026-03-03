import type { EditorTool } from '../hooks/useEditorTools'
import type { AppearanceData } from '../lib/appearances'
import type { ItemRegistry } from '../lib/items'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'

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
}

const TOOLS: { id: EditorTool; label: string; shortcut: string; icon: JSX.Element }[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'S',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 1L2 11L5.5 7.5L8.5 13L10.5 12L7.5 6L12 5L2 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'draw',
    label: 'Draw',
    shortcut: 'D',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M8.5 2.5L11.5 5.5M2 12L2.5 9.5L10 2C10.8-0.8 13.2 1.2 11.5 2.5L4 10L2 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'erase',
    label: 'Erase',
    shortcut: 'E',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
}: ToolbarProps) {
  const itemName = selectedItemId != null && registry && appearances
    ? getItemDisplayName(selectedItemId, registry, appearances)
    : null

  return (
    <div className="panel toolbar">
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

      <div className="separator-v" style={{ height: 18, flexShrink: 0 }} />

      {/* Undo / Redo */}
      <div className="tool-group">
        <button
          className="btn btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ border: 'none', background: 'transparent', opacity: canUndo ? 1 : 0.3 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 5H5C3.34 5 2 6.34 2 8C2 9.66 3.34 11 5 11H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8.5 2.5L11 5L8.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Selected item indicator */}
      {selectedItemId != null && appearances && (
        <>
          <div className="separator-v" style={{ height: 18, flexShrink: 0 }} />
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
