import { useState, useMemo, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import type { CreatureDatabase } from '../lib/creatures/CreatureDatabase'
import type { AppearanceData } from '../lib/appearances'
import type { CreatureType } from '../lib/creatures/types'
import { CreatureSpriteResolver } from '../lib/creatures/CreatureSpriteResolver'
import type { BrushSelection } from '../hooks/tools/types'
import { ItemSprite } from './ItemSprite'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useVirtualScroll } from '../hooks/useVirtualScroll'
import { XIcon } from '@phosphor-icons/react'

interface CreaturePaletteProps {
  creatureDb: CreatureDatabase
  appearances: AppearanceData
  selectedBrush: BrushSelection | null
  onCreatureSelect: (sel: BrushSelection) => void
  creatureSpawnTime: number
  onCreatureSpawnTimeChange: (t: number) => void
  creatureWeight: number
  onCreatureWeightChange: (w: number) => void
  brushSize: number
  onBrushSizeChange: (s: number) => void
  onClose: () => void
  className?: string
  style?: React.CSSProperties
}

type Tab = 'monsters' | 'npcs'

const ROW_HEIGHT = 36
const BUFFER_ROWS = 4

export function CreaturePalette({
  creatureDb,
  appearances,
  selectedBrush,
  onCreatureSelect,
  creatureSpawnTime,
  onCreatureSpawnTimeChange,
  creatureWeight,
  onCreatureWeightChange,
  brushSize,
  onBrushSizeChange,
  onClose,
  className,
  style,
}: CreaturePaletteProps) {
  const [tab, setTab] = useState<Tab>('monsters')
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebouncedValue(search, 150)

  const spriteResolver = useMemo(() => new CreatureSpriteResolver(appearances), [appearances])

  const isNpc = tab === 'npcs'
  const placeMode = selectedBrush?.mode === 'spawn' ? 'spawn' as const : 'creature' as const

  const creatures = useMemo(() => {
    if (debouncedSearch) {
      return creatureDb.search(debouncedSearch, isNpc)
    }
    return isNpc ? creatureDb.getAllNpcs() : creatureDb.getAllMonsters()
  }, [creatureDb, debouncedSearch, isNpc])

  const { scrollRef, totalHeight, startIndex, endIndex, handleScroll, resetScroll } = useVirtualScroll({
    totalItems: creatures.length,
    itemHeight: ROW_HEIGHT,
    bufferItems: BUFFER_ROWS,
  })

  // Reset scroll on tab/search change
  useEffect(() => {
    resetScroll()
  }, [tab, debouncedSearch, resetScroll])

  // Switch to spawn mode updates the spawn type
  const handleModeChange = useCallback((mode: 'creature' | 'spawn') => {
    if (mode === 'spawn') {
      onCreatureSelect({ mode: 'spawn', spawnType: isNpc ? 'npc' : 'monster' })
    }
  }, [isNpc, onCreatureSelect])

  // Tab switch updates spawn type if in spawn mode
  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab)
    setSearch('')
    if (placeMode === 'spawn') {
      onCreatureSelect({ mode: 'spawn', spawnType: newTab === 'npcs' ? 'npc' : 'monster' })
    }
  }, [placeMode, onCreatureSelect])

  const handleCreatureClick = useCallback((creature: CreatureType) => {
    onCreatureSelect({ mode: 'creature', creatureName: creature.name, isNpc: creature.isNpc })
  }, [onCreatureSelect])

  const isCreatureSelected = useCallback((creature: CreatureType) => {
    if (!selectedBrush || selectedBrush.mode !== 'creature') return false
    return selectedBrush.creatureName === creature.name && selectedBrush.isNpc === creature.isNpc
  }, [selectedBrush])

  const visibleCreatures = creatures.slice(startIndex, endIndex)

  return (
    <div className={clsx('panel absolute top-4 bottom-4 z-10 flex w-[280px] flex-col pointer-events-auto select-none', className)} style={{ right: 68, ...style }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="label text-lg tracking-wide">CREATURES</span>
        <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close">
          <XIcon size={14} weight="bold" />
        </button>
      </div>

      {/* Tabs */}
      <div className="section-tabs">
        <button
          className={clsx('section-tab', tab === 'monsters' && 'active')}
          onClick={() => handleTabChange('monsters')}
        >
          Monsters
        </button>
        <button
          className={clsx('section-tab', tab === 'npcs' && 'active')}
          onClick={() => handleTabChange('npcs')}
        >
          NPCs
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <input
          className="w-full rounded-sm bg-bg-raised px-3 py-[5px] font-ui text-sm text-fg outline-none placeholder:text-fg-faint border border-border-subtle focus:border-accent"
          placeholder="Search creatures..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 px-3 pb-2">
        <button
          className={clsx(
            'btn flex-1 border-none bg-transparent px-2 py-[4px] font-display text-xs uppercase tracking-[0.04em]',
            placeMode === 'creature' && 'tool-active',
          )}
          onClick={() => handleModeChange('creature')}
        >
          Place Creature
        </button>
        <button
          className={clsx(
            'btn flex-1 border-none bg-transparent px-2 py-[4px] font-display text-xs uppercase tracking-[0.04em]',
            placeMode === 'spawn' && 'tool-active',
          )}
          onClick={() => handleModeChange('spawn')}
        >
          Place Spawn
        </button>
      </div>

      {/* Config */}
      <div className="flex flex-col gap-2 px-4 pb-3">
        {placeMode === 'creature' && (
          <>
            <div className="flex items-center justify-between">
              <span className="label text-xs">SPAWN TIME</span>
              <input
                type="number"
                className="w-[64px] rounded-sm bg-bg-raised px-2 py-[3px] font-mono text-xs text-fg outline-none border border-border-subtle focus:border-accent text-right"
                value={creatureSpawnTime}
                min={1}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 1) onCreatureSpawnTimeChange(v)
                }}
              />
            </div>
            {!isNpc && (
              <div className="flex items-center justify-between">
                <span className="label text-xs">WEIGHT</span>
                <input
                  type="number"
                  className="w-[64px] rounded-sm bg-bg-raised px-2 py-[3px] font-mono text-xs text-fg outline-none border border-border-subtle focus:border-accent text-right"
                  value={creatureWeight}
                  min={0}
                  max={255}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 0 && v <= 255) onCreatureWeightChange(v)
                  }}
                />
              </div>
            )}
          </>
        )}
        {placeMode === 'spawn' && (
          <div className="flex items-center justify-between">
            <span className="label text-xs">SPAWN RADIUS</span>
            <input
              type="number"
              className="w-[64px] rounded-sm bg-bg-raised px-2 py-[3px] font-mono text-xs text-fg outline-none border border-border-subtle focus:border-accent text-right"
              value={brushSize + 1}
              min={1}
              max={15}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 1 && v <= 15) onBrushSizeChange(v - 1)
              }}
            />
          </div>
        )}
      </div>

      <div className="mx-3 h-px bg-border-subtle" />

      {/* Creature list */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-1 pb-1"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleCreatures.map((creature, i) => {
            const idx = startIndex + i
            const spriteId = spriteResolver.resolvePreview(creature)
            return (
              <div
                key={creature.name}
                className={clsx(
                  'absolute left-0 right-0 flex items-center gap-3 rounded-sm px-3 cursor-pointer transition-colors duration-100 hover:bg-panel-hover',
                  isCreatureSelected(creature) && 'bg-accent-subtle outline outline-1 -outline-offset-1 outline-accent',
                )}
                style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
                onClick={() => handleCreatureClick(creature)}
              >
                <ItemSprite spriteId={spriteId} size={28} anchor="bottom-center" />
                <span className="flex-1 truncate font-ui text-sm text-fg">{creature.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer count */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle">
        <span className="font-mono text-xs text-fg-faint">{creatures.length} {isNpc ? 'NPCs' : 'monsters'}</span>
      </div>
    </div>
  )
}
