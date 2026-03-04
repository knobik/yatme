import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'
import { itemCategory } from '../proto/appearances'

type SmartBrushType = 'ground' | 'wall' | 'carpet' | 'table' | 'doodad' | null

interface ItemPaletteProps {
  registry: ItemRegistry
  appearances: AppearanceData
  brushRegistry?: BrushRegistry | null
  onClose: () => void
  selectedItemId?: number | null
  onItemSelect?: (itemId: number) => void
}

type Category = 'ALL' | 'GROUND' | 'BORDERS' | 'CONTAINERS' | 'DECORATION' | 'EQUIPMENT' | 'WEAPONS' | 'TOOLS' | 'OTHER'

const CATEGORIES: Category[] = ['ALL', 'GROUND', 'BORDERS', 'CONTAINERS', 'DECORATION', 'EQUIPMENT', 'WEAPONS', 'TOOLS', 'OTHER']

const COLS = 4
const CELL_HEIGHT = 64
const BUFFER_ROWS = 2

const EQUIPMENT_CATEGORIES = new Set([
  itemCategory.ITEM_CATEGORY_ARMORS,
  itemCategory.ITEM_CATEGORY_HELMETS_HATS,
  itemCategory.ITEM_CATEGORY_LEGS,
  itemCategory.ITEM_CATEGORY_BOOTS,
  itemCategory.ITEM_CATEGORY_SHIELDS,
  itemCategory.ITEM_CATEGORY_AMULETS,
  itemCategory.ITEM_CATEGORY_RINGS,
])

const WEAPON_CATEGORIES = new Set([
  itemCategory.ITEM_CATEGORY_AXES,
  itemCategory.ITEM_CATEGORY_CLUBS,
  itemCategory.ITEM_CATEGORY_SWORDS,
  itemCategory.ITEM_CATEGORY_DISTANCE_WEAPONS,
  itemCategory.ITEM_CATEGORY_WANDS_RODS,
  itemCategory.ITEM_CATEGORY_AMMUNITION,
  itemCategory.ITEM_CATEGORY_FIST_WEAPONS,
])

function getItemCategory(id: number, appearances: AppearanceData, registry: ItemRegistry): Category {
  const appearance = appearances.objects.get(id)
  const flags = appearance?.flags

  if (flags?.bank) return 'GROUND'
  if (flags?.clip || flags?.bottom) return 'BORDERS'
  if (flags?.container) return 'CONTAINERS'

  const marketCat = flags?.market?.category
  if (marketCat != null) {
    if (EQUIPMENT_CATEGORIES.has(marketCat)) return 'EQUIPMENT'
    if (WEAPON_CATEGORIES.has(marketCat)) return 'WEAPONS'
    if (marketCat === itemCategory.ITEM_CATEGORY_TOOLS) return 'TOOLS'
    if (marketCat === itemCategory.ITEM_CATEGORY_DECORATION) return 'DECORATION'
  }

  const primaryType = registry.get(id)?.primaryType?.toLowerCase()
  if (primaryType) {
    if (primaryType.includes('weapon') || primaryType.includes('sword') || primaryType.includes('axe') || primaryType.includes('club')) return 'WEAPONS'
    if (primaryType.includes('armor') || primaryType.includes('helmet') || primaryType.includes('shield') || primaryType.includes('boot') || primaryType.includes('leg')) return 'EQUIPMENT'
    if (primaryType.includes('tool')) return 'TOOLS'
    if (primaryType.includes('decoration') || primaryType.includes('furniture')) return 'DECORATION'
    if (primaryType.includes('container') || primaryType.includes('bag') || primaryType.includes('backpack')) return 'CONTAINERS'
  }

  return 'OTHER'
}

export function ItemPalette({ registry, appearances, brushRegistry, onClose, selectedItemId, onItemSelect }: ItemPaletteProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('ALL')
  const [search, setSearch] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<number>(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => {
      setDebouncedSearch(value)
    }, 150)
  }, [])

  // Build the full item list with category assignments (cached)
  const allItems = useMemo(() => {
    const items: { id: number; name: string; category: Category; brush: SmartBrushType }[] = []
    // Use appearance objects as the source of truth — they define what items exist
    for (const [id] of appearances.objects) {
      // Skip items with no sprite
      const appearance = appearances.objects.get(id)
      const info = appearance?.frameGroup?.[0]?.spriteInfo
      if (!info || info.spriteId.length === 0 || info.spriteId[0] === 0) continue

      const name = getItemDisplayName(id, registry, appearances)
      const category = getItemCategory(id, appearances, registry)
      let brush: SmartBrushType = null
      if (brushRegistry) {
        if (brushRegistry.getBrushForItem(id)) brush = 'ground'
        else if (brushRegistry.getWallBrushForItem(id)) brush = 'wall'
        else if (brushRegistry.getCarpetBrushForItem(id)) brush = 'carpet'
        else if (brushRegistry.getTableBrushForItem(id)) brush = 'table'
        else if (brushRegistry.getDoodadBrushForItem(id)) brush = 'doodad'
      }
      items.push({ id, name, category, brush })
    }
    items.sort((a, b) => a.id - b.id)
    return items
  }, [appearances, registry, brushRegistry])

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    let items = allItems

    if (activeCategory !== 'ALL') {
      items = items.filter(item => item.category === activeCategory)
    }

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
  }, [allItems, activeCategory, debouncedSearch])

  // Reset scroll when filter changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [activeCategory, debouncedSearch])

  // Virtual scrolling calculations
  const totalRows = Math.ceil(filteredItems.length / COLS)
  const totalHeight = totalRows * CELL_HEIGHT
  const viewportRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  // Calculate visible range
  const viewportHeight = scrollRef.current?.clientHeight ?? 400
  const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - BUFFER_ROWS)
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / CELL_HEIGHT) + BUFFER_ROWS)
  const visibleItems = filteredItems.slice(startRow * COLS, endRow * COLS)

  return (
    <div className="panel palette">
      {/* Header */}
      <div className="palette-header">
        <span className="label" style={{ fontSize: 'var(--text-md)', letterSpacing: 'var(--tracking-wide)' }}>
          ITEMS
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
          {filteredItems.length.toLocaleString()}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-icon" onClick={onClose} title="Close (Esc)" style={{ border: 'none', background: 'transparent', width: 22, height: 22 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
        <input
          className="search-input"
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Category tabs */}
      <div className="category-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`category-tab${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="separator" />

      {/* Virtual scrolling grid */}
      <div
        ref={scrollRef}
        className="palette-scroll"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }} ref={viewportRef}>
          <div
            className="item-grid"
            style={{
              position: 'absolute',
              top: startRow * CELL_HEIGHT,
              left: 0,
              right: 0,
            }}
          >
            {visibleItems.map((item) => (
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
                  {item.brush && (
                    <span className={`brush-badge brush-badge-${item.brush}`} title={`Smart brush: ${item.brush}`}>
                      <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M15.2 0.8a2.7 2.7 0 0 0-3.8 0L4 8.2l-.2.6L2.4 13a.5.5 0 0 0 .6.6l4.2-1.4.6-.2L15.2 4.6a2.7 2.7 0 0 0 0-3.8zM5.4 9L11 3.4l1.6 1.6L7 11 5.4 9z"/>
                      </svg>
                    </span>
                  )}
                </div>
                <span className="item-name">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
