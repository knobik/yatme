import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import type { ResolvedTileset } from '../lib/tilesets/TilesetTypes'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'

type SmartBrushType = 'ground' | 'wall' | 'carpet' | 'table' | 'doodad' | null

interface BrushPaletteProps {
  tilesets: ResolvedTileset[]
  registry: ItemRegistry
  appearances: AppearanceData
  brushRegistry?: BrushRegistry | null
  onClose: () => void
  selectedItemId?: number | null
  onItemSelect?: (itemId: number) => void
}

const COLS = 4
const CELL_HEIGHT = 64
const BUFFER_ROWS = 2

type CategoryType = 'all' | 'terrain' | 'doodad' | 'items' | 'raw'

const CATEGORIES: { id: CategoryType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'doodad', label: 'Doodad' },
  { id: 'items', label: 'Items' },
  { id: 'raw', label: 'Raw' },
]

export function BrushPalette({ tilesets, registry, appearances, brushRegistry, onClose, selectedItemId, onItemSelect }: BrushPaletteProps) {
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

  // Build brush type cache for all items
  const brushTypeCache = useMemo(() => {
    const cache = new Map<number, SmartBrushType>()
    if (!brushRegistry) return cache
    for (const [id] of appearances.objects) {
      if (brushRegistry.getBrushForItem(id)) cache.set(id, 'ground')
      else if (brushRegistry.getWallBrushForItem(id)) cache.set(id, 'wall')
      else if (brushRegistry.getCarpetBrushForItem(id)) cache.set(id, 'carpet')
      else if (brushRegistry.getTableBrushForItem(id)) cache.set(id, 'table')
      else if (brushRegistry.getDoodadBrushForItem(id)) cache.set(id, 'doodad')
    }
    return cache
  }, [appearances, brushRegistry])

  // Build the "ALL" item list
  const allItems = useMemo(() => {
    const items: { id: number; name: string }[] = []
    for (const [id] of appearances.objects) {
      const appearance = appearances.objects.get(id)
      const info = appearance?.frameGroup?.[0]?.spriteInfo
      if (!info || info.spriteId.length === 0 || info.spriteId[0] === 0) continue
      const name = getItemDisplayName(id, registry, appearances)
      items.push({ id, name })
    }
    items.sort((a, b) => a.id - b.id)
    return items
  }, [appearances, registry])

  // Filter tilesets that have content in the active category
  const categoryTilesets = useMemo(() => {
    if (activeCategory === 'all') return tilesets
    return tilesets.filter(t => t.sections.some(s => s.type === activeCategory))
  }, [tilesets, activeCategory])

  // Reset tileset selection when category changes (if current tileset isn't in the new category)
  useEffect(() => {
    if (selectedTileset === 'ALL') return
    const stillValid = categoryTilesets.some(t => t.name === selectedTileset)
    if (!stillValid) setSelectedTileset('ALL')
  }, [categoryTilesets, selectedTileset])

  // Build item list based on category + tileset selection
  const tilesetItems = useMemo(() => {
    if (selectedTileset === 'ALL' && activeCategory === 'all') return allItems

    if (selectedTileset === 'ALL') {
      const seen = new Set<number>()
      const items: { id: number; name: string }[] = []
      for (const t of categoryTilesets) {
        for (const s of t.sections) {
          if (s.type !== activeCategory) continue
          for (const id of s.itemIds) {
            if (seen.has(id)) continue
            seen.add(id)
            items.push({ id, name: getItemDisplayName(id, registry, appearances) })
          }
        }
      }
      return items
    }

    const tileset = tilesets.find(t => t.name === selectedTileset)
    if (!tileset) return []

    if (activeCategory === 'all') {
      return tileset.itemIds.map(id => ({
        id,
        name: getItemDisplayName(id, registry, appearances),
      }))
    }

    const section = tileset.sections.find(s => s.type === activeCategory)
    if (!section) return []
    return section.itemIds.map(id => ({
      id,
      name: getItemDisplayName(id, registry, appearances),
    }))
  }, [selectedTileset, activeCategory, tilesets, categoryTilesets, allItems, registry, appearances])

  // Filter by search
  const filteredItems = useMemo(() => {
    let items = tilesetItems
    if (debouncedSearch.length >= 2) {
      const isNumeric = /^\d+$/.test(debouncedSearch)
      if (isNumeric) {
        const searchId = parseInt(debouncedSearch, 10)
        items = items.filter(item => item.id === searchId || item.id.toString().includes(debouncedSearch))
      } else {
        const lower = debouncedSearch.toLowerCase()
        items = items.filter(item => item.name.toLowerCase().includes(lower))
      }
    }
    return items
  }, [tilesetItems, debouncedSearch])

  // Filter tileset dropdown list by search
  const filteredDropdownTilesets = useMemo(() => {
    if (!tilesetSearch) return categoryTilesets
    const lower = tilesetSearch.toLowerCase()
    return categoryTilesets.filter(t => t.name.toLowerCase().includes(lower))
  }, [categoryTilesets, tilesetSearch])

  // Get item count for a tileset within the active category
  const getTilesetCount = useCallback((tileset: ResolvedTileset) => {
    if (activeCategory === 'all') return tileset.itemIds.length
    const section = tileset.sections.find(s => s.type === activeCategory)
    return section?.itemIds.length ?? 0
  }, [activeCategory])

  // Reset scroll when filter changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [selectedTileset, activeCategory, debouncedSearch])

  // Virtual scrolling calculations
  const totalRows = Math.ceil(filteredItems.length / COLS)
  const totalHeight = totalRows * CELL_HEIGHT

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  const viewportHeight = scrollRef.current?.clientHeight ?? 400
  const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - BUFFER_ROWS)
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / CELL_HEIGHT) + BUFFER_ROWS)
  const visibleItems = filteredItems.slice(startRow * COLS, endRow * COLS)

  const selectedLabel = selectedTileset === 'ALL' ? 'All Tilesets' : selectedTileset

  return (
    <div className="panel absolute left-4 top-4 bottom-4 z-10 flex w-[320px] flex-col pointer-events-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="label text-md tracking-wide">
          BRUSHES
        </span>
        <span className="font-mono text-sm text-fg-faint">
          {filteredItems.length.toLocaleString()}
        </span>
        <div className="flex-1" />
        <button className="btn btn-icon h-[22px] w-[22px] border-none bg-transparent" onClick={onClose} title="Close (Esc)">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
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
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
          placeholder="Search items..."
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
            {visibleItems.map((item) => {
              const brush = brushTypeCache.get(item.id) ?? null
              return (
                <div
                  key={item.id}
                  className={clsx('item-cell', item.id === selectedItemId && 'selected')}
                  onClick={() => onItemSelect?.(item.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-tibia-item', String(item.id))
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
                  title={`${item.name} (ID: ${item.id})`}
                >
                  <div className="relative">
                    <ItemSprite itemId={item.id} appearances={appearances} size={36} />
                    {brush && (
                      <span className={`brush-badge brush-badge-${brush}`} title={`Smart brush: ${brush}`}>
                        <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M15.2 0.8a2.7 2.7 0 0 0-3.8 0L4 8.2l-.2.6L2.4 13a.5.5 0 0 0 .6.6l4.2-1.4.6-.2L15.2 4.6a2.7 2.7 0 0 0 0-3.8zM5.4 9L11 3.4l1.6 1.6L7 11 5.4 9z"/>
                        </svg>
                      </span>
                    )}
                  </div>
                  <span className="item-name">{item.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
