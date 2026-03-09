import { useState } from 'react'
import clsx from 'clsx'
import type { MapSidecars, HouseData } from '../lib/sidecars'
import type { OtbmMap } from '../lib/otbm'
import { useTileCounts } from '../hooks/useTileCounts'
import { houseColorCSS } from '../lib/houseColors'
import { XIcon, PlusIcon, DownloadSimpleIcon, UploadSimpleIcon, NavigationArrowIcon, DoorIcon } from '@phosphor-icons/react'

interface HousePaletteProps {
  sidecars: MapSidecars
  onSidecarsChange: (sidecars: MapSidecars) => void
  mapData: OtbmMap | null
  selectedHouse: HouseData | null
  onHouseSelect: (house: HouseData) => void
  onHouseDelete?: (houseId: number) => void
  onNavigateToHouse?: (houseId: number) => void
  onSetHouseExit?: (houseId: number) => void
  onExportHouses?: () => void
  onImportHouses?: () => void
  onClose: () => void
  className?: string
}

export function HousePalette({
  sidecars,
  onSidecarsChange,
  mapData,
  selectedHouse,
  onHouseSelect,
  onHouseDelete,
  onNavigateToHouse,
  onSetHouseExit,
  onExportHouses,
  onImportHouses,
  onClose,
  className,
}: HousePaletteProps) {
  const [newHouseName, setNewHouseName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editTownId, setEditTownId] = useState<number | null>(null)
  const [editTown, setEditTown] = useState('')

  const handleAddHouse = () => {
    const name = newHouseName.trim()
    if (!name) return
    const maxId = sidecars.houses.reduce((max, h) => Math.max(max, h.id), 0)
    const newHouse: HouseData = {
      id: maxId + 1,
      name,
      entryX: 0,
      entryY: 0,
      entryZ: 7,
      rent: 0,
      townId: 0,
      size: 0,
      clientId: 0,
      guildhall: false,
      beds: 0,
    }
    onSidecarsChange({ ...sidecars, houses: [...sidecars.houses, newHouse] })
    onHouseSelect(newHouse)
    setNewHouseName('')
  }

  const handleDeleteHouse = (id: number) => {
    onSidecarsChange({ ...sidecars, houses: sidecars.houses.filter(h => h.id !== id) })
    onHouseDelete?.(id)
  }

  const handleStartRename = (house: HouseData) => {
    setEditingId(house.id)
    setEditName(house.name)
  }

  const handleFinishRename = () => {
    if (editingId == null) return
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    onSidecarsChange({
      ...sidecars,
      houses: sidecars.houses.map(h => h.id === editingId ? { ...h, name } : h),
    })
    setEditingId(null)
  }

  const handleStartEditTown = (house: HouseData) => {
    setEditTownId(house.id)
    setEditTown(String(house.townId))
  }


  const houseTileCounts = useTileCounts(
    mapData,
    tile => tile.houseId != null ? [tile.houseId] : [],
    [sidecars],
  )

  const isHouseSelected = (houseId: number) =>
    selectedHouse?.id === houseId

  const towns = mapData?.towns ?? []

  return (
    <div className={clsx("panel absolute top-4 right-[68px] bottom-4 z-10 flex w-[280px] flex-col pointer-events-auto select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="label text-lg tracking-wide">HOUSES</span>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={onImportHouses}
            title="Import Houses"
          >
            <UploadSimpleIcon size={14} weight="bold" />
          </button>
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={onExportHouses}
            disabled={sidecars.houses.length === 0}
            title="Export Houses"
          >
            <DownloadSimpleIcon size={14} weight="bold" />
          </button>
          <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close (Esc)">
            <XIcon size={14} weight="bold" />
          </button>
        </div>
      </div>

      <div className="mx-6 h-px bg-border-subtle" />

      {/* Add house */}
      <div className="shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-sm bg-bg-raised px-3 py-[5px] font-ui text-sm text-fg outline-none placeholder:text-fg-faint border border-border-subtle focus:border-accent"
            placeholder="House name..."
            value={newHouseName}
            onChange={e => setNewHouseName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddHouse() }}
          />
          <button
            className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover shrink-0"
            onClick={handleAddHouse}
            disabled={!newHouseName.trim()}
          >
            + Add
          </button>
        </div>
      </div>

      <div className="mx-5 h-px bg-border-subtle" />

      {/* House list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {sidecars.houses.length === 0 ? (
          <div className="find-empty-state">
            <PlusIcon size={24} className="text-fg-disabled" />
            <span>Add a house to get started</span>
          </div>
        ) : (
          <div className="flex flex-col gap-px pt-1">
            {sidecars.houses.map(house => (
              <div
                key={house.id}
                className={clsx(
                  'group flex flex-col rounded-sm cursor-pointer transition-colors duration-100 hover:bg-panel-hover',
                  isHouseSelected(house.id) && 'bg-accent-subtle outline outline-1 -outline-offset-1 outline-accent',
                )}
                onClick={() => onHouseSelect(house)}
              >
                <div className="flex items-center gap-3 px-3 py-[7px]">
                  <div
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: houseColorCSS(house.id) }}
                  />
                  {editingId === house.id ? (
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
                      onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(house) }}
                    >
                      {house.name}
                    </span>
                  )}
                  <span className="font-mono text-xs text-fg-faint">#{house.id}</span>
                  <button
                    className="item-action-btn danger !w-[22px] !h-[22px] opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); handleDeleteHouse(house.id) }}
                    title="Delete house"
                  >
                    <XIcon size={10} weight="bold" />
                  </button>
                </div>
                {/* Details row — tiles, town, actions */}
                <div className="flex items-center gap-2 px-3 pb-[6px] pl-[30px]">
                  <span className="font-mono text-xs text-fg-faint">{houseTileCounts.get(house.id) ?? 0} tiles</span>
                  <span className="text-fg-faint text-xs">|</span>
                  {editTownId === house.id ? (
                    <select
                      className="cursor-pointer rounded-sm border border-border-subtle bg-bg-base px-1 font-mono text-xs text-fg outline-none focus:border-accent"
                      value={editTown}
                      onChange={e => {
                        const townId = parseInt(e.target.value, 10)
                        if (!isNaN(townId)) {
                          onSidecarsChange({
                            ...sidecars,
                            houses: sidecars.houses.map(h => h.id === editTownId ? { ...h, townId } : h),
                          })
                        }
                        setEditTownId(null)
                      }}
                      onBlur={() => setEditTownId(null)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    >
                      <option value="0">No town</option>
                      {towns.map(t => (
                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="font-mono text-xs text-fg-faint cursor-pointer hover:text-fg"
                      onClick={(e) => { e.stopPropagation(); handleStartEditTown(house) }}
                      title="Click to change town"
                    >
                      {towns.find(t => t.id === house.townId)?.name ?? `Town ${house.townId}`}
                    </span>
                  )}
                  <div className="flex-1" />
                  <button
                    className="item-action-btn !w-[20px] !h-[20px] opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onSetHouseExit?.(house.id) }}
                    title="Set house exit"
                  >
                    <DoorIcon size={12} weight="bold" />
                  </button>
                  <button
                    className="item-action-btn !w-[20px] !h-[20px] opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onNavigateToHouse?.(house.id) }}
                    title="Navigate to house"
                  >
                    <NavigationArrowIcon size={12} weight="bold" />
                  </button>
                </div>
                {/* Exit info */}
                {house.entryX > 0 && house.entryY > 0 && (
                  <div className="flex items-center gap-2 px-3 pb-[6px] pl-[30px]">
                    <span className="font-mono text-xs text-fg-faint">
                      Exit: {house.entryX}, {house.entryY}, {house.entryZ}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
