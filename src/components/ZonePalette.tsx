import { useState } from 'react'
import clsx from 'clsx'
import type { MapSidecars, ZoneData } from '../lib/sidecars'
import type { ZoneSelection } from '../hooks/tools/types'
import { ZONE_FLAG_DEFS } from '../hooks/tools/types'
import { zoneColorCSS } from '../lib/zoneColors'
import { XIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'

interface ZonePaletteProps {
  sidecars: MapSidecars
  onSidecarsChange: (sidecars: MapSidecars) => void
  selectedZone: ZoneSelection | null
  onZoneSelect: (zone: ZoneSelection) => void
  onClose: () => void
}

export function ZonePalette({
  sidecars,
  onSidecarsChange,
  selectedZone,
  onZoneSelect,
  onClose,
}: ZonePaletteProps) {
  const [newZoneName, setNewZoneName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const handleAddZone = () => {
    const name = newZoneName.trim()
    if (!name) return
    const maxId = sidecars.zones.reduce((max, z) => Math.max(max, z.id), 0)
    const newZone: ZoneData = { id: maxId + 1, name }
    onSidecarsChange({ ...sidecars, zones: [...sidecars.zones, newZone] })
    setNewZoneName('')
  }

  const handleDeleteZone = (id: number) => {
    onSidecarsChange({ ...sidecars, zones: sidecars.zones.filter(z => z.id !== id) })
  }

  const handleStartRename = (zone: ZoneData) => {
    setEditingId(zone.id)
    setEditName(zone.name)
  }

  const handleFinishRename = () => {
    if (editingId == null) return
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    onSidecarsChange({
      ...sidecars,
      zones: sidecars.zones.map(z => z.id === editingId ? { ...z, name } : z),
    })
    setEditingId(null)
  }

  const isFlagSelected = (flag: number) =>
    selectedZone?.type === 'flag' && selectedZone.flag === flag

  const isZoneSelected = (zoneId: number) =>
    selectedZone?.type === 'zone' && selectedZone.zoneId === zoneId

  return (
    <div className="panel absolute top-4 right-4 bottom-4 z-10 flex w-[260px] flex-col pointer-events-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="label text-base tracking-wide">ZONES</span>
        <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close">
          <XIcon size={14} weight="bold" />
        </button>
      </div>

      <div className="h-px w-full bg-border-subtle" />

      {/* Flags section */}
      <div className="px-5 py-3">
        <span className="label text-sm">FLAGS</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {ZONE_FLAG_DEFS.map(def => {
            const color = `#${def.color.toString(16).padStart(6, '0')}`
            return (
              <button
                key={def.flag}
                className={clsx(
                  'rounded-sm px-3 py-[3px] font-display text-xs font-semibold tracking-wide uppercase transition-all duration-100',
                  isFlagSelected(def.flag)
                    ? 'ring-2 ring-accent text-fg'
                    : 'text-fg-faint hover:text-fg',
                )}
                style={{
                  backgroundColor: isFlagSelected(def.flag) ? color + '60' : color + '30',
                  borderLeft: `3px solid ${color}`,
                }}
                onClick={() => onZoneSelect({ type: 'flag', flag: def.flag, label: def.label })}
              >
                {def.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-px w-full bg-border-subtle" />

      {/* Zones section */}
      <div className="flex items-center justify-between px-5 py-3">
        <span className="label text-sm">CUSTOM ZONES</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {sidecars.zones.length === 0 && (
          <div className="px-5 py-3 font-mono text-sm text-fg-faint">No zones defined</div>
        )}
        {sidecars.zones.map(zone => (
          <div
            key={zone.id}
            className={clsx(
              'group flex items-center gap-3 border-b border-border-subtle px-5 py-3 cursor-pointer transition-colors duration-100 hover:bg-panel-hover',
              isZoneSelected(zone.id) && 'bg-accent-subtle',
            )}
            onClick={() => onZoneSelect({ type: 'zone', zoneId: zone.id, name: zone.name })}
          >
            <div
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: zoneColorCSS(zone.id) }}
            />
            {editingId === zone.id ? (
              <input
                className="flex-1 bg-transparent font-ui text-sm text-fg outline-none border-b border-accent"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingId(null) }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 truncate font-ui text-sm text-fg"
                onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(zone) }}
              >
                {zone.name}
              </span>
            )}
            <span className="font-mono text-xs text-fg-faint">#{zone.id}</span>
            <button
              className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-danger transition-opacity duration-100"
              onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id) }}
              title="Delete zone"
            >
              <TrashIcon size={14} weight="bold" />
            </button>
          </div>
        ))}
      </div>

      <div className="h-px w-full bg-border-subtle" />

      {/* Add zone */}
      <div className="flex items-center gap-2 px-5 py-3">
        <input
          className="flex-1 rounded-sm bg-bg-raised px-3 py-[5px] font-ui text-sm text-fg outline-none placeholder:text-fg-faint border border-border-subtle focus:border-accent"
          placeholder="Zone name..."
          value={newZoneName}
          onChange={e => setNewZoneName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddZone() }}
        />
        <button
          className="btn btn-icon border-none bg-transparent"
          onClick={handleAddZone}
          disabled={!newZoneName.trim()}
          title="Add zone"
        >
          <PlusIcon size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}
