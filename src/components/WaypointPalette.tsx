import { useState } from 'react'
import clsx from 'clsx'
import type { OtbmWaypoint } from '../lib/otbm'
import type { MapMutator } from '../lib/MapMutator'
import { XIcon, MapPinIcon } from '@phosphor-icons/react'
import { MARKER_COLOR_CSS } from '../lib/WaypointOverlay'

interface WaypointPaletteProps {
  waypoints: OtbmWaypoint[]
  mutator: MapMutator
  selectedWaypoint: string | null
  onWaypointSelect: (name: string) => void
  onNavigate: (x: number, y: number, z: number) => void
  onClose: () => void
  style?: React.CSSProperties
}

export function WaypointPalette({
  waypoints,
  mutator,
  selectedWaypoint,
  onWaypointSelect,
  onNavigate,
  onClose,
  style,
}: WaypointPaletteProps) {
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleDelete = (name: string) => {
    mutator.removeWaypoint(name)
    if (selectedWaypoint === name) {
      onWaypointSelect('')
    }
  }

  const handleStartRename = (wp: OtbmWaypoint) => {
    setEditingName(wp.name)
    setEditValue(wp.name)
  }

  const handleFinishRename = () => {
    if (editingName == null) return
    const newName = editValue.trim()
    if (!newName || newName === editingName) {
      setEditingName(null)
      return
    }
    try {
      mutator.renameWaypoint(editingName, newName)
      if (selectedWaypoint === editingName) {
        onWaypointSelect(newName)
      }
    } catch {
      // Name conflict — ignore
    }
    setEditingName(null)
  }

  const handleRowClick = (wp: OtbmWaypoint) => {
    onWaypointSelect(wp.name)
    onNavigate(wp.x, wp.y, wp.z)
  }

  return (
    <div
      className="panel absolute top-4 right-[68px] bottom-4 z-10 flex w-[260px] flex-col pointer-events-auto select-none"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="label text-lg tracking-wide">WAYPOINTS</span>
        <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close">
          <XIcon size={14} weight="bold" />
        </button>
      </div>

      <div className="mx-6 h-px bg-border-subtle" />

      {/* Hint */}
      <div className="shrink-0 px-5 py-3">
        <span className="font-ui text-xs text-fg-muted">Click on map to add a waypoint</span>
      </div>

      <div className="mx-5 h-px bg-border-subtle" />

      {/* Waypoint list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {waypoints.length === 0 ? (
          <div className="find-empty-state">
            <MapPinIcon size={24} className="text-fg-disabled" />
            <span>No waypoints yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-px pt-1">
            {waypoints.map(wp => (
              <div
                key={wp.name}
                className={clsx(
                  'group flex items-center gap-2 rounded-sm px-3 py-[7px] cursor-pointer transition-colors duration-100 hover:bg-panel-hover',
                  selectedWaypoint === wp.name && 'bg-accent-subtle outline outline-1 -outline-offset-1 outline-accent',
                )}
                onClick={() => handleRowClick(wp)}
              >
                <div
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: MARKER_COLOR_CSS }}
                />
                {editingName === wp.name ? (
                  <input
                    className="flex-1 min-w-0 bg-transparent font-ui text-sm text-fg outline-none border-b border-accent"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleFinishRename()
                      if (e.key === 'Escape') setEditingName(null)
                    }}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 truncate font-ui text-sm text-fg"
                    onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(wp) }}
                  >
                    {wp.name}
                  </span>
                )}
                <span className="font-mono text-xs text-fg-faint shrink-0">
                  {wp.x},{wp.y},{wp.z}
                </span>
                <button
                  className="item-action-btn danger !w-[22px] !h-[22px] opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleDelete(wp.name) }}
                  title="Delete waypoint"
                >
                  <XIcon size={10} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
