import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import type { MapSidecars, SpawnPoint } from '../lib/sidecars'
import type { MonsterSelection } from '../hooks/tools/types'
import type { CreatureDatabase, CreatureInfo } from '../lib/creatures'
import type { AppearanceData } from '../lib/appearances'
import { getCreatureList, isValidCreature } from '../lib/creatures'
import { useDebounce } from '../hooks/useDebounce'
import { CreatureSprite } from './CreatureSprite'
import { spawnColorCSS } from '../lib/spawnColors'
import {
  XIcon, DownloadSimpleIcon, UploadSimpleIcon,
  NavigationArrowIcon, TrashIcon, CaretDownIcon, CaretRightIcon,
  MagnifyingGlassIcon, WarningIcon, PlusIcon,
} from '@phosphor-icons/react'

const DIRECTIONS = [
  { value: 0, label: 'N' },
  { value: 1, label: 'E' },
  { value: 2, label: 'S' },
  { value: 3, label: 'W' },
] as const

const CREATURE_ROW_HEIGHT = 36
const OVERSCAN = 10

interface MonsterPaletteProps {
  sidecars: MapSidecars
  creatureDb: CreatureDatabase | null
  appearances: AppearanceData
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
  creatureDb,
  appearances,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [spawnTime, setSpawnTime] = useState(selectedMonster?.spawnTime ?? 60)
  const [direction, setDirection] = useState(selectedMonster?.direction ?? 2)
  const [expandedSpawns, setExpandedSpawns] = useState<Set<number>>(new Set())
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(300)
  const listContainerRef = useRef<HTMLDivElement>(null)

  const spawns = sidecars.monsterSpawns

  const debouncedQuery = useDebounce(searchQuery, 150)

  // Track container height via ResizeObserver (not during render)
  useEffect(() => {
    const el = listContainerRef.current
    if (!el) return
    setViewportHeight(el.clientHeight)
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filteredCreatures = useMemo(() => {
    if (!creatureDb) return []
    const all = getCreatureList(creatureDb)
    if (!debouncedQuery.trim()) return all
    const q = debouncedQuery.toLowerCase()
    return all.filter(c => c.name.toLowerCase().includes(q))
  }, [creatureDb, debouncedQuery])

  const handleCreatureClick = useCallback((creature: CreatureInfo) => {
    onMonsterSelect({ name: creature.name, spawnTime, direction })
  }, [onMonsterSelect, spawnTime, direction])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Virtual scroll calculations
  const totalHeight = filteredCreatures.length * CREATURE_ROW_HEIGHT
  const startIdx = Math.max(0, Math.floor(scrollTop / CREATURE_ROW_HEIGHT) - OVERSCAN)
  const endIdx = Math.min(filteredCreatures.length, Math.ceil((scrollTop + viewportHeight) / CREATURE_ROW_HEIGHT) + OVERSCAN)
  const visibleCreatures = filteredCreatures.slice(startIdx, endIdx)

  const toggleExpanded = (idx: number) => {
    setExpandedSpawns(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // Check if selected monster is valid
  const selectedValid = selectedMonster && creatureDb ? isValidCreature(creatureDb, selectedMonster.name) : true

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

      {/* Search + spawn config */}
      <div className="shrink-0 px-5 pt-4 pb-3 flex flex-col gap-3">
        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" />
          <input
            className="w-full rounded-sm bg-bg-raised pl-8 pr-3 py-[5px] font-ui text-sm text-fg outline-none placeholder:text-fg-faint border border-border-subtle focus:border-accent"
            placeholder="Search creatures..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Spawn config: time + direction */}
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

        {/* Active selection indicator */}
        {selectedMonster && (
          <div className="flex items-center gap-2 rounded-sm bg-bg-raised px-3 py-[5px]">
            {!selectedValid && (
              <WarningIcon size={14} className="text-danger shrink-0" />
            )}
            <span className="font-ui text-xs text-fg-faint">Active:</span>
            <span className={clsx('font-mono text-sm truncate', selectedValid ? 'text-accent' : 'text-danger')}>
              {selectedMonster.name}
            </span>
            <span className="font-mono text-xs text-fg-faint">
              ({selectedMonster.spawnTime}s, {DIRECTIONS.find(d => d.value === selectedMonster.direction)?.label ?? '?'})
            </span>
          </div>
        )}
      </div>

      <div className="mx-5 h-px bg-border-subtle" />

      {/* Creature list (virtual scrolled) */}
      <div
        ref={listContainerRef}
        className="flex-1 min-h-0 overflow-y-auto"
        onScroll={handleScroll}
      >
        {filteredCreatures.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-fg-faint font-ui text-xs">
            <MagnifyingGlassIcon size={20} />
            <span>{creatureDb ? 'No creatures found' : 'Loading creatures...'}</span>
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            {visibleCreatures.map((creature, i) => {
              const idx = startIdx + i
              const isSelected = selectedMonster?.name.toLowerCase() === creature.name.toLowerCase()
              return (
                <div
                  key={creature.name}
                  className={clsx(
                    'flex items-center gap-2 px-3 cursor-pointer transition-colors duration-75 hover:bg-panel-hover',
                    isSelected && 'bg-accent-subtle',
                  )}
                  style={{
                    position: 'absolute',
                    top: idx * CREATURE_ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: CREATURE_ROW_HEIGHT,
                  }}
                  onClick={() => handleCreatureClick(creature)}
                >
                  <CreatureSprite outfit={creature.outfit} appearances={appearances} size={28} />
                  <span className="font-ui text-xs text-fg truncate flex-1">{creature.name}</span>
                  <span className={clsx(
                    'font-mono text-[10px] px-1 rounded-sm',
                    creature.type === 'npc' ? 'text-info bg-info/10' : 'text-fg-faint bg-bg-raised',
                  )}>
                    {creature.type === 'npc' ? 'NPC' : 'MON'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mx-5 h-px bg-border-subtle" />

      {/* Spawn list */}
      <div className="min-h-[120px] max-h-[40%] overflow-y-auto px-3 pb-3">
        <div className="flex items-center px-3 py-2">
          <span className="label text-xs tracking-wide">SPAWN AREAS</span>
          <span className="ml-auto font-mono text-xs text-fg-faint">{spawns.length}</span>
        </div>
        {spawns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-fg-faint font-ui text-xs">
            <PlusIcon size={18} />
            <span>No spawn areas yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-px">
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
                      {spawn.creatures.map((creature, ci) => {
                        const notInDb = creatureDb ? !isValidCreature(creatureDb, creature.name) : false
                        return (
                          <div
                            key={`${creature.name}-${creature.x}-${creature.y}-${ci}`}
                            className="group/creature flex items-center gap-2 rounded-sm px-2 py-[3px] hover:bg-bg-raised"
                          >
                            {notInDb && <WarningIcon size={10} className="text-danger shrink-0" />}
                            <span className="font-ui text-xs text-fg truncate flex-1">{creature.name}</span>
                            <span className="font-mono text-xs text-fg-faint">
                              ({creature.x - spawn.centerX},{creature.y - spawn.centerY})
                            </span>
                            <span className="font-mono text-xs text-fg-faint">{creature.spawnTime}s</span>
                            <button
                              className="item-action-btn danger !w-[16px] !h-[16px] opacity-0 group-hover/creature:opacity-100"
                              onClick={(e) => { e.stopPropagation(); onDeleteCreature?.(idx, ci) }}
                              title="Remove creature"
                            >
                              <XIcon size={8} weight="bold" />
                            </button>
                          </div>
                        )
                      })}
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
