import { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import clsx from 'clsx'
import type { AppearanceData } from '../lib/appearances'
import type { ResolvedTileset, ResolvedPaletteEntry, ResolvedItemEntry, CategoryType } from '../lib/tilesets/TilesetTypes'
import type { BrushSelection } from '../hooks/tools/types'
import { getItemDisplayName } from '../lib/items'
import type { ItemRegistry } from '../lib/items'
import { ItemSprite } from './ItemSprite'
import { X, CaretDown, PencilSimple } from '@phosphor-icons/react'

interface BrushPaletteProps {
  tilesets: ResolvedTileset[]
  registry: ItemRegistry
  appearances: AppearanceData
  onClose: () => void
  selectedBrush?: BrushSelection | null
  onBrushSelect?: (selection: BrushSelection) => void
}

const COLS = 4
const CELL_HEIGHT = 64
const BUFFER_ROWS = 2

const CATEGORIES: { id: CategoryType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'doodad', label: 'Doodad' },
  { id: 'items', label: 'Items' },
  { id: 'raw', label: 'Raw' },
]

/** Unique key for a palette entry. */
function entryKey(entry: ResolvedPaletteEntry): string {
  return entry.type === 'brush' ? `b:${entry.brushName}` : `i:${entry.itemId}`
}

/** Check if an entry matches the current selection. */
function isEntrySelected(entry: ResolvedPaletteEntry, sel: BrushSelection | null | undefined): boolean {
  if (!sel) return false
  if (entry.type === 'brush' && sel.mode === 'brush') {
    return entry.brushName === sel.brushName && entry.brushType === sel.brushType
  }
  if (entry.type === 'item' && sel.mode === 'raw') {
    return entry.itemId === sel.itemId
  }
  return false
}

/** Convert a palette entry to a BrushSelection. */
function entryToSelection(entry: ResolvedPaletteEntry): BrushSelection {
  if (entry.type === 'brush') {
    return { mode: 'brush', brushType: entry.brushType, brushName: entry.brushName }
  }
  return { mode: 'raw', itemId: entry.itemId }
}

/** Get sprite ID for rendering an entry's preview. */
function entrySpriteId(entry: ResolvedPaletteEntry): number {
  return entry.type === 'brush' ? entry.lookId : entry.itemId
}

export interface BrushPaletteHandle {
  navigateTo(category: CategoryType, tilesetName: string): void
}

export const BrushPalette = forwardRef<BrushPaletteHandle, BrushPaletteProps>(function BrushPalette({ tilesets, registry, appearances, onClose, selectedBrush, onBrushSelect }, ref) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all')
  const [selectedTileset, setSelectedTileset] = useState<string>('ALL')
  const [tilesetSearch, setTilesetSearch] = useState('')
  const [tilesetOpen, setTilesetOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<number>(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Expose navigation API to parent
  useImperativeHandle(ref, () => ({
    navigateTo(category: CategoryType, tilesetName: string) {
      setActiveCategory(category)
      setSelectedTileset(tilesetName)
      setSearch('')
      setDebouncedSearch('')
      setTilesetSearch('')
      setTilesetOpen(false)
    },
  }), [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!tilesetOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTilesetOpen(false)
        setTilesetSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tilesetOpen])

  // Debounce search input
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => {
      setDebouncedSearch(value)
    }, 150)
  }, [])

  // Build the "ALL" entry list (all items as raw entries, for when no category filter)
  const allEntries = useMemo((): ResolvedPaletteEntry[] => {
    const entries: ResolvedItemEntry[] = []
    for (const [id] of appearances.objects) {
      const appearance = appearances.objects.get(id)
      const info = appearance?.frameGroup?.[0]?.spriteInfo
      if (!info || info.spriteId.length === 0 || info.spriteId[0] === 0) continue
      entries.push({
        type: 'item',
        itemId: id,
        displayName: getItemDisplayName(id, registry, appearances),
      })
    }
    entries.sort((a, b) => a.itemId - b.itemId)
    return entries
  }, [appearances, registry])

  // Filter tilesets that have content in the active category
  const categoryTilesets = useMemo(() => {
    if (activeCategory === 'all') return tilesets
    return tilesets.filter(t => t.sections.some(s => s.type === activeCategory))
  }, [tilesets, activeCategory])

  // Reset tileset selection when category changes
  useEffect(() => {
    if (selectedTileset === 'ALL') return
    const stillValid = categoryTilesets.some(t => t.name === selectedTileset)
    if (!stillValid) setSelectedTileset('ALL')
  }, [categoryTilesets, selectedTileset])

  // Build entry list based on category + tileset selection
  const currentEntries = useMemo((): ResolvedPaletteEntry[] => {
    if (selectedTileset === 'ALL' && activeCategory === 'all') return allEntries

    if (selectedTileset === 'ALL') {
      // Collect entries from all tilesets for the active category
      const seenKeys = new Set<string>()
      const entries: ResolvedPaletteEntry[] = []
      for (const t of categoryTilesets) {
        for (const s of t.sections) {
          if (s.type !== activeCategory) continue
          for (const entry of s.entries) {
            const key = entryKey(entry)
            if (seenKeys.has(key)) continue
            seenKeys.add(key)
            entries.push(entry)
          }
        }
      }
      return entries
    }

    const tileset = tilesets.find(t => t.name === selectedTileset)
    if (!tileset) return []

    if (activeCategory === 'all') {
      // All entries from all sections of this tileset
      const entries: ResolvedPaletteEntry[] = []
      for (const s of tileset.sections) entries.push(...s.entries)
      return entries
    }

    const section = tileset.sections.find(s => s.type === activeCategory)
    return section?.entries ?? []
  }, [selectedTileset, activeCategory, tilesets, categoryTilesets, allEntries])

  // Filter by search
  const filteredEntries = useMemo(() => {
    if (debouncedSearch.length < 2) return currentEntries
    const isNumeric = /^\d+$/.test(debouncedSearch)
    if (isNumeric) {
      const searchStr = debouncedSearch
      const searchId = parseInt(debouncedSearch, 10)
      return currentEntries.filter(e => {
        if (e.type === 'item') return e.itemId === searchId || e.itemId.toString().includes(searchStr)
        return e.lookId === searchId || e.lookId.toString().includes(searchStr)
      })
    }
    const lower = debouncedSearch.toLowerCase()
    return currentEntries.filter(e => e.displayName.toLowerCase().includes(lower))
  }, [currentEntries, debouncedSearch])

  // Filter tileset dropdown list by search
  const filteredDropdownTilesets = useMemo(() => {
    if (!tilesetSearch) return categoryTilesets
    const lower = tilesetSearch.toLowerCase()
    return categoryTilesets.filter(t => t.name.toLowerCase().includes(lower))
  }, [categoryTilesets, tilesetSearch])

  // Get entry count for a tileset within the active category
  const getTilesetCount = useCallback((tileset: ResolvedTileset) => {
    if (activeCategory === 'all') return tileset.entryCount
    const section = tileset.sections.find(s => s.type === activeCategory)
    return section?.entries.length ?? 0
  }, [activeCategory])

  // Reset scroll when filter changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [selectedTileset, activeCategory, debouncedSearch])

  // Virtual scrolling calculations
  const totalRows = Math.ceil(filteredEntries.length / COLS)
  const totalHeight = totalRows * CELL_HEIGHT

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  const viewportHeight = scrollRef.current?.clientHeight ?? 400
  const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - BUFFER_ROWS)
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / CELL_HEIGHT) + BUFFER_ROWS)
  const visibleEntries = filteredEntries.slice(startRow * COLS, endRow * COLS)

  const selectedLabel = selectedTileset === 'ALL' ? 'All Tilesets' : selectedTileset

  return (
    <div className="panel absolute left-4 top-4 bottom-4 z-10 flex w-[320px] flex-col pointer-events-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="label text-md tracking-wide">
          BRUSHES
        </span>
        <span className="font-mono text-sm text-fg-faint">
          {filteredEntries.length.toLocaleString()}
        </span>
        <div className="flex-1" />
        <button className="btn btn-icon h-[22px] w-[22px] border-none bg-transparent" onClick={onClose} title="Close (Esc)">
          <X size={10} weight="bold" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="section-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={clsx('section-tab', activeCategory === cat.id && 'active')}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Tileset dropdown */}
      <div className="px-3 pb-2" ref={dropdownRef}>
        <div className="tileset-select-wrapper">
          <button
            className="tileset-select-trigger"
            onClick={() => { setTilesetOpen(!tilesetOpen); setTilesetSearch('') }}
          >
            <span className="tileset-select-label">{selectedLabel}</span>
            <CaretDown size={10} weight="bold" className="shrink-0" />
          </button>
          {tilesetOpen && (
            <div className="tileset-dropdown">
              <input
                className="tileset-dropdown-search"
                type="text"
                placeholder="Filter tilesets..."
                value={tilesetSearch}
                onChange={(e) => setTilesetSearch(e.target.value)}
                autoFocus
              />
              <div className="tileset-dropdown-list">
                <button
                  className={clsx('tileset-option', selectedTileset === 'ALL' && 'active')}
                  onClick={() => { setSelectedTileset('ALL'); setTilesetOpen(false); setTilesetSearch('') }}
                >
                  All Tilesets
                </button>
                {filteredDropdownTilesets.map(t => (
                  <button
                    key={t.name}
                    className={clsx('tileset-option', selectedTileset === t.name && 'active')}
                    onClick={() => { setSelectedTileset(t.name); setTilesetOpen(false); setTilesetSearch('') }}
                  >
                    {t.name}
                    <span className="tileset-option-count">{getTilesetCount(t)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <input
          className="search-input"
          type="text"
          placeholder="Search brushes..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="h-px w-full bg-border-subtle" />

      {/* Virtual scrolling grid */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            className="item-grid"
            style={{
              position: 'absolute',
              top: startRow * CELL_HEIGHT,
              left: 0,
              right: 0,
            }}
          >
            {visibleEntries.map((entry) => {
              const spriteId = entrySpriteId(entry)
              const isBrush = entry.type === 'brush'
              const title = isBrush
                ? `${entry.displayName} (${entry.brushType})`
                : `${entry.displayName} (ID: ${entry.itemId})`

              return (
                <div
                  key={entryKey(entry)}
                  className={clsx('item-cell', isEntrySelected(entry, selectedBrush) && 'selected')}
                  onClick={() => onBrushSelect?.(entryToSelection(entry))}
                  draggable
                  onDragStart={(e) => {
                    const itemId = isBrush ? entry.lookId : entry.itemId
                    e.dataTransfer.setData('application/x-tibia-item', String(itemId))
                    e.dataTransfer.effectAllowed = 'copy'
                    const canvas = e.currentTarget.querySelector('canvas')
                    if (canvas) {
                      const ghost = canvas.cloneNode(true) as HTMLCanvasElement
                      const ctx = ghost.getContext('2d')
                      if (ctx) ctx.drawImage(canvas, 0, 0)
                      ghost.style.position = 'fixed'
                      ghost.style.left = '-9999px'
                      document.body.appendChild(ghost)
                      e.dataTransfer.setDragImage(ghost, 18, 18)
                      requestAnimationFrame(() => document.body.removeChild(ghost))
                    }
                  }}
                  title={title}
                >
                  <div className="relative">
                    <ItemSprite itemId={spriteId} appearances={appearances} size={36} />
                    {isBrush && (
                      <span className={`brush-badge brush-badge-${entry.brushType}`} title={`Brush: ${entry.brushType}`}>
                        <PencilSimple size={8} weight="fill" />
                      </span>
                    )}
                  </div>
                  <span className="item-name">{entry.displayName}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
})
