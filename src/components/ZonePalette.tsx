import { useState } from 'react'
import clsx from 'clsx'
import type { MapSidecars, ZoneData } from '../lib/sidecars'
import type { ZoneSelection } from '../hooks/tools/types'
import { zoneColorCSS } from '../lib/zoneColors'
import { XIcon, PlusIcon, DownloadSimpleIcon, UploadSimpleIcon } from '@phosphor-icons/react'

interface ZonePaletteProps {
  sidecars: MapSidecars
  onSidecarsChange: (sidecars: MapSidecars) => void
  selectedZone: ZoneSelection | null
  onZoneSelect: (zone: ZoneSelection) => void
  onZoneDelete?: (zoneId: number) => void
  onNavigateToZone?: (zoneId: number) => void
  onExportZones?: () => void
  onImportZones?: () => void
  onClose: () => void
}

export function ZonePalette({
  sidecars,
  onSidecarsChange,
  selectedZone,
  onZoneSelect,
  onZoneDelete,
  onNavigateToZone,
  onExportZones,
  onImportZones,
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
    onZoneDelete?.(id)
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

  const isZoneSelected = (zoneId: number) =>
    selectedZone?.type === 'zone' && selectedZone.zoneId === zoneId

  return (
    <div className="panel absolute top-4 right-[68px] bottom-4 z-10 flex w-[260px] flex-col pointer-events-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="label text-lg tracking-wide">ZONES</span>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={onImportZones}
            title="Import Zones"
          >
            <UploadSimpleIcon size={14} weight="bold" />
          </button>
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={onExportZones}
            disabled={sidecars.zones.length === 0}
            title="Export Zones"
          >
            <DownloadSimpleIcon size={14} weight="bold" />
          </button>
          <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close (Esc)">
            <XIcon size={14} weight="bold" />
          </button>
        </div>
      </div>

      <div className="mx-6 h-px bg-border-subtle" />

      {/* Add zone */}
      <div className="shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-sm bg-bg-raised px-3 py-[5px] font-ui text-sm text-fg outline-none placeholder:text-fg-faint border border-border-subtle focus:border-accent"
            placeholder="Zone name..."
            value={newZoneName}
            onChange={e => setNewZoneName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddZone() }}
          />
          <button
            className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover shrink-0"
            onClick={handleAddZone}
            disabled={!newZoneName.trim()}
          >
            + Add
          </button>
        </div>
      </div>

      <div className="mx-5 h-px bg-border-subtle" />

      {/* Zone list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {sidecars.zones.length === 0 ? (
          <div className="find-empty-state">
            <PlusIcon size={24} className="text-fg-disabled" />
            <span>Add a zone to get started</span>
          </div>
        ) : (
          <div className="flex flex-col gap-px pt-1">
            {sidecars.zones.map(zone => (
              <div
                key={zone.id}
                className={clsx(
                  'group flex items-center gap-3 rounded-sm px-3 py-[7px] cursor-pointer transition-colors duration-100 hover:bg-panel-hover',
                  isZoneSelected(zone.id) && 'bg-accent-subtle',
                )}
                onClick={() => onZoneSelect({ type: 'zone', zoneId: zone.id, name: zone.name })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onNavigateToZone?.(zone.id)
                }}
                title="Right-click to navigate to zone"
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
                  className="item-action-btn danger !w-[22px] !h-[22px] opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id) }}
                  title="Delete zone"
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
