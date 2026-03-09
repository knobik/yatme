import { useState } from 'react'
import clsx from 'clsx'
import type { MapSidecars, SpawnPoint } from '../lib/sidecars'
import type { MonsterSelection } from '../hooks/tools/types'
import { spawnColorCSS } from '../lib/spawnColors'
import {
  XIcon, PlusIcon, DownloadSimpleIcon, UploadSimpleIcon,
  NavigationArrowIcon, TrashIcon, CaretDownIcon, CaretRightIcon,
} from '@phosphor-icons/react'

const DIRECTIONS = [
  { value: 0, label: 'N' },
  { value: 1, label: 'E' },
  { value: 2, label: 'S' },
  { value: 3, label: 'W' },
] as const

interface MonsterPaletteProps {
  sidecars: MapSidecars
  selectedMonster: MonsterSelection | null
  onMonsterSelect: (monster: MonsterSelection) => void
  activeSpawnIdx: number | null
  onActiveSpawnChange: (idx: number | null) => void
  onDeleteSpawn?: (spawnIdx: number) => void
  onDeleteCreature?: (spawnIdx: number, creatureIdx: number) => void
  onModifySpawnRadius?: (spawnIdx: number, radius: number) => void
  onNavigateToSpawn?: (spawn: SpawnPoint) => void
  onExportSpawns?: () => void
  onImportSpawns?: () => void
  onClose: () => void
  className?: string
}

export function MonsterPalette({
  sidecars,
  selectedMonster,
  onMonsterSelect,
  activeSpawnIdx,
  onActiveSpawnChange,
  onDeleteSpawn,
  onDeleteCreature,
  onModifySpawnRadius,
  onNavigateToSpawn,
  onExportSpawns,
  onImportSpawns,
  onClose,
  className,
}: MonsterPaletteProps) {
  const [monsterName, setMonsterName] = useState(selectedMonster?.name ?? '')
  const [spawnTime, setSpawnTime] = useState(selectedMonster?.spawnTime ?? 60)
  const [direction, setDirection] = useState(selectedMonster?.direction ?? 2)
  const [expandedSpawns, setExpandedSpawns] = useState<Set<number>>(new Set())

  const spawns = sidecars.monsterSpawns

  const handleApplyMonster = () => {
    const name = monsterName.trim()
    if (!name) return
    onMonsterSelect({ name, spawnTime, direction })
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleApplyMonster()
  }

  const toggleExpanded = (idx: number) => {
    setExpandedSpawns(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleDeleteCreature = (spawnIdx: number, creatureIdx: number) => {
    onDeleteCreature?.(spawnIdx, creatureIdx)
  }

  return (
    <div className={clsx(
      "panel absolute top-4 right-[68px] bottom-4 z-10 flex w-[300px] flex-col pointer-events-auto select-none",
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="label text-lg tracking-wide">MONSTER SPAWNS</span>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={onImportSpawns}
            title="Import Spawns"
          >
            <UploadSimpleIcon size={14} weight="bold" />
          </button>
          <button
            className="btn btn-icon border-none bg-transparent"
            onClick={onExportSpawns}
            disabled={spawns.length === 0}
            title="Export Spawns"
          >
            <DownloadSimpleIcon size={14} weight="bold" />
          </button>
          <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close">
            <XIcon size={14} weight="bold" />
          </button>
        </div>
      </div>

      <div className="mx-6 h-px bg-border-subtle" />

      {/* Monster config */}
      <div className="shrink-0 px-5 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-sm bg-bg-raised px-3 py-[5px] font-ui text-sm text-fg outline-none placeholder:text-fg-faint border border-border-subtle focus:border-accent"
            placeholder="Monster name..."
            value={monsterName}
            onChange={e => setMonsterName(e.target.value)}
            onKeyDown={handleNameKeyDown}
          />
          <button
            className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover shrink-0"
            onClick={handleApplyMonster}
            disabled={!monsterName.trim()}
          >
            Set
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="label text-xs">TIME</span>
            <input
              type="number"
              className="w-[60px] rounded-sm bg-bg-raised px-2 py-[3px] font-mono text-xs text-fg outline-none border border-border-subtle focus:border-accent"
              value={spawnTime}
              min={1}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v > 0) setSpawnTime(v)
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="label text-xs">DIR</span>
            {DIRECTIONS.map(d => (
              <button
                key={d.value}
                className={clsx(
                  'btn btn-icon min-w-[22px] border-none bg-transparent px-[3px] py-[2px] font-mono text-xs',
                  direction === d.value && 'tool-active',
                )}
                onClick={() => setDirection(d.value)}
                title={d.label}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {selectedMonster && (
          <div className="flex items-center gap-2 rounded-sm bg-bg-raised px-3 py-[5px]">
            <span className="font-ui text-xs text-fg-faint">Active:</span>
            <span className="font-mono text-sm text-accent">{selectedMonster.name}</span>
            <span className="font-mono text-xs text-fg-faint">
              ({selectedMonster.spawnTime}s, {DIRECTIONS.find(d => d.value === selectedMonster.direction)?.label ?? '?'})
            </span>
          </div>
        )}
      </div>

      <div className="mx-5 h-px bg-border-subtle" />

      {/* Spawn list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {spawns.length === 0 ? (
          <div className="find-empty-state">
            <PlusIcon size={24} className="text-fg-disabled" />
            <span>No spawn areas yet. Start painting to auto-create.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-px pt-1">
            {spawns.map((spawn, idx) => {
              const isActive = activeSpawnIdx === idx
              const isExpanded = expandedSpawns.has(idx)

              return (
                <div
                  key={`${spawn.centerX},${spawn.centerY},${spawn.centerZ}-${idx}`}
                  className={clsx(
                    'group rounded-sm cursor-pointer transition-colors duration-100 hover:bg-panel-hover',
                    isActive && 'bg-accent-subtle outline outline-1 -outline-offset-1 outline-accent',
                  )}
                  onClick={() => onActiveSpawnChange(isActive ? null : idx)}
                >
                  {/* Spawn header */}
                  <div className="flex items-center gap-2 px-3 py-[7px]">
                    <div
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: spawnColorCSS(idx) }}
                    />
                    <button
                      className="flex items-center p-0 bg-transparent border-none text-fg-faint"
                      onClick={(e) => { e.stopPropagation(); toggleExpanded(idx) }}
                    >
                      {isExpanded
                        ? <CaretDownIcon size={10} weight="bold" />
                        : <CaretRightIcon size={10} weight="bold" />
                      }
                    </button>
                    <span className="font-mono text-xs text-fg">
                      ({spawn.centerX}, {spawn.centerY}, {spawn.centerZ})
                    </span>
                    <span className="font-mono text-xs text-fg-faint">
                      r={spawn.radius}
                    </span>
                    <span className="font-mono text-xs text-fg-faint">
                      {spawn.creatures.length}cr
                    </span>
                    <div className="flex-1" />
                    <button
                      className="item-action-btn !w-[20px] !h-[20px] opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); onNavigateToSpawn?.(spawn) }}
                      title="Navigate to spawn"
                    >
                      <NavigationArrowIcon size={12} weight="bold" />
                    </button>
                    <button
                      className="item-action-btn danger !w-[20px] !h-[20px] opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); onDeleteSpawn?.(idx) }}
                      title="Delete spawn"
                    >
                      <TrashIcon size={12} weight="bold" />
                    </button>
                  </div>

                  {/* Radius edit (inline when active) */}
                  {isActive && (
                    <div className="flex items-center gap-2 px-3 pb-[6px] pl-[42px]">
                      <span className="label text-xs">RADIUS</span>
                      <input
                        type="number"
                        className="w-[50px] rounded-sm bg-bg-raised px-2 py-[2px] font-mono text-xs text-fg outline-none border border-border-subtle focus:border-accent"
                        value={spawn.radius}
                        min={0}
                        max={30}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10)
                          if (!isNaN(v) && v >= 0) onModifySpawnRadius?.(idx, v)
                        }}
                      />
                    </div>
                  )}

                  {/* Creature list (expanded) */}
                  {isExpanded && spawn.creatures.length > 0 && (
                    <div className="flex flex-col gap-px pb-1 pl-[42px] pr-3">
                      {spawn.creatures.map((creature, ci) => (
                        <div
                          key={`${creature.name}-${creature.x}-${creature.y}-${ci}`}
                          className="group/creature flex items-center gap-2 rounded-sm px-2 py-[3px] hover:bg-bg-raised"
                        >
                          <span className="font-ui text-xs text-fg truncate flex-1">{creature.name}</span>
                          <span className="font-mono text-xs text-fg-faint">
                            ({creature.x - spawn.centerX},{creature.y - spawn.centerY})
                          </span>
                          <span className="font-mono text-xs text-fg-faint">{creature.spawnTime}s</span>
                          <button
                            className="item-action-btn danger !w-[16px] !h-[16px] opacity-0 group-hover/creature:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCreature(idx, ci) }}
                            title="Remove creature"
                          >
                            <XIcon size={8} weight="bold" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
