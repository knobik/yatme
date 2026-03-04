import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
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
const HEADER_HEIGHT = 28
const BUFFER_ROWS = 2

// Row descriptor for mixed virtual list
type VirtualRow =
  | { kind: 'header'; label: string; count: number }
  | { kind: 'items'; items: { id: number; name: string }[] }

const SECTION_LABELS: Record<string, string> = {
  terrain: 'TERRAIN',
  doodad: 'DOODAD',
  items: 'ITEMS',
  raw: 'RAW',
}

export function BrushPalette({ tilesets, registry, appearances, brushRegistry, onClose, selectedItemId, onItemSelect }: BrushPaletteProps) {
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

  // Build the "ALL" item list (same as old ItemPalette)
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

  // Resolve names for a list of item IDs
  const resolveNames = useCallback((ids: number[]) => {
    return ids.map(id => ({ id, name: getItemDisplayName(id, registry, appearances) }))
  }, [registry, appearances])

  // Search filter function
  const filterBySearch = useCallback((items: { id: number; name: string }[], query: string) => {
    if (query.length < 2) return items
    const isNumeric = /^\d+$/.test(query)
    if (isNumeric) {
      const searchId = parseInt(query, 10)
      return items.filter(item => item.id === searchId || item.id.toString().includes(query))
    }
    const lower = query.toLowerCase()
    return items.filter(item => item.name.toLowerCase().includes(lower))
  }, [])

  // Build virtual rows — either flat (ALL/search) or sectioned (specific tileset, no search)
  const { rows, totalHeight, totalItemCount } = useMemo(() => {
    const isSearching = debouncedSearch.length >= 2
    const tileset = selectedTileset !== 'ALL' ? tilesets.find(t => t.name === selectedTileset) : null

    // Case 1: "ALL" mode or searching within a tileset — flat list
    if (!tileset || isSearching) {
      let items: { id: number; name: string }[]
      if (!tileset) {
        items = allItems
      } else {
        items = resolveNames(tileset.itemIds)
      }
      if (isSearching) items = filterBySearch(items, debouncedSearch)

      const rows: VirtualRow[] = []
      for (let i = 0; i < items.length; i += COLS) {
        rows.push({ kind: 'items', items: items.slice(i, i + COLS) })
      }
      return {
        rows,
        totalHeight: rows.length * CELL_HEIGHT,
        totalItemCount: items.length,
      }
    }

    // Case 2: Specific tileset, no search — sectioned list
    const rows: VirtualRow[] = []
    let height = 0
    let count = 0
    const hasSections = tileset.sections.length > 1

    for (const section of tileset.sections) {
      const items = resolveNames(section.itemIds)
      if (items.length === 0) continue
      count += items.length

      if (hasSections) {
        rows.push({ kind: 'header', label: SECTION_LABELS[section.type] ?? section.type.toUpperCase(), count: items.length })
        height += HEADER_HEIGHT
      }

      for (let i = 0; i < items.length; i += COLS) {
        rows.push({ kind: 'items', items: items.slice(i, i + COLS) })
        height += CELL_HEIGHT
      }
    }

    return { rows, totalHeight: height, totalItemCount: count }
  }, [selectedTileset, tilesets, allItems, debouncedSearch, resolveNames, filterBySearch])

  // Filter tileset list for dropdown
  const filteredTilesets = useMemo(() => {
    if (!tilesetSearch) return tilesets
    const lower = tilesetSearch.toLowerCase()
    return tilesets.filter(t => t.name.toLowerCase().includes(lower))
  }, [tilesets, tilesetSearch])

  // Reset scroll when filter changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [selectedTileset, debouncedSearch])

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  // Virtual scrolling with mixed heights
  const viewportHeight = scrollRef.current?.clientHeight ?? 400

  // Compute cumulative heights and find visible range
  const { visibleRows, offsetTop } = useMemo(() => {
    // Check if all rows are uniform height (no headers) for fast path
    const hasHeaders = rows.some(r => r.kind === 'header')

    if (!hasHeaders) {
      // Fast path: uniform CELL_HEIGHT rows
      const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - BUFFER_ROWS)
      const endRow = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / CELL_HEIGHT) + BUFFER_ROWS)
      return {
        visibleRows: rows.slice(startRow, endRow),
        offsetTop: startRow * CELL_HEIGHT,
      }
    }

    // Mixed heights: scan for visible range
    let cumHeight = 0
    let startIdx = -1
    let startOffset = 0
    let endIdx = rows.length

    for (let i = 0; i < rows.length; i++) {
      const rowHeight = rows[i].kind === 'header' ? HEADER_HEIGHT : CELL_HEIGHT
      if (startIdx === -1 && cumHeight + rowHeight > scrollTop - BUFFER_ROWS * CELL_HEIGHT) {
        startIdx = i
        startOffset = cumHeight
      }
      cumHeight += rowHeight
      if (cumHeight > scrollTop + viewportHeight + BUFFER_ROWS * CELL_HEIGHT) {
        endIdx = i + 1
        break
      }
    }

    if (startIdx === -1) startIdx = 0
    return {
      visibleRows: rows.slice(startIdx, endIdx),
      offsetTop: startOffset,
    }
  }, [rows, scrollTop, viewportHeight])

  const selectedLabel = selectedTileset === 'ALL' ? 'All Items' : selectedTileset

  return (
    <div className="panel palette">
      {/* Header */}
      <div className="palette-header">
        <span className="label" style={{ fontSize: 'var(--text-md)', letterSpacing: 'var(--tracking-wide)' }}>
          BRUSHES
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
          {totalItemCount.toLocaleString()}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-icon" onClick={onClose} title="Close (Esc)" style={{ border: 'none', background: 'transparent', width: 22, height: 22 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Tileset dropdown */}
      <div style={{ padding: '0 var(--space-3) var(--space-2)' }} ref={dropdownRef}>
        <div className="tileset-select-wrapper">
          <button
            className="tileset-select-trigger"
            onClick={() => { setTilesetOpen(!tilesetOpen); setTilesetSearch('') }}
          >
            <span className="tileset-select-label">{selectedLabel}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
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
                  className={`tileset-option${selectedTileset === 'ALL' ? ' active' : ''}`}
                  onClick={() => { setSelectedTileset('ALL'); setTilesetOpen(false); setTilesetSearch('') }}
                >
                  All Items
                </button>
                {filteredTilesets.map(t => (
                  <button
                    key={t.name}
                    className={`tileset-option${selectedTileset === t.name ? ' active' : ''}`}
                    onClick={() => { setSelectedTileset(t.name); setTilesetOpen(false); setTilesetSearch('') }}
                  >
                    {t.name}
                    <span className="tileset-option-count">{t.itemIds.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 var(--space-3) var(--space-2)' }}>
        <input
          className="search-input"
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="separator" />

      {/* Virtual scrolling grid */}
      <div
        ref={scrollRef}
        className="palette-scroll"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: offsetTop,
              left: 0,
              right: 0,
            }}
          >
            {visibleRows.map((row, i) => {
              if (row.kind === 'header') {
                return (
                  <div
                    key={`hdr-${row.label}-${i}`}
                    className="palette-section-header"
                  >
                    <span className="palette-section-label">{row.label}</span>
                    <span className="palette-section-count">{row.count}</span>
                  </div>
                )
              }

              return (
                <div key={`row-${row.items[0]?.id}-${i}`} className="item-grid">
                  {row.items.map((item) => {
                    const brush = brushTypeCache.get(item.id) ?? null
                    return (
                      <div
                        key={item.id}
                        className={`item-cell${item.id === selectedItemId ? ' selected' : ''}`}
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
                        <div style={{ position: 'relative' }}>
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
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
