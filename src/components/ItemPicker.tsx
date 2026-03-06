import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import type { ItemRegistry, ItemType } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'

type SearchMode = 'search' | 'type' | 'properties'

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'depot', label: 'Depot' },
  { value: 'mailbox', label: 'Mailbox' },
  { value: 'trashholder', label: 'Trash Holder' },
  { value: 'container', label: 'Container' },
  { value: 'door', label: 'Door' },
  { value: 'magicfield', label: 'Magic Field' },
  { value: 'teleport', label: 'Teleport' },
  { value: 'bed', label: 'Bed' },
  { value: 'key', label: 'Key' },
]

interface PropertyFilter {
  unpassable: boolean
  unmovable: boolean
  pickupable: boolean
  stackable: boolean
  rotatable: boolean
  hangable: boolean
}

const PROPERTY_LABELS: { key: keyof PropertyFilter; label: string }[] = [
  { key: 'unpassable', label: 'Unpassable' },
  { key: 'unmovable', label: 'Unmovable' },
  { key: 'pickupable', label: 'Pickupable' },
  { key: 'stackable', label: 'Stackable' },
  { key: 'rotatable', label: 'Rotatable' },
  { key: 'hangable', label: 'Hangable' },
]

const COLS = 4
const CELL_HEIGHT = 64
const BUFFER_ROWS = 2

interface ItemPickerProps {
  registry: ItemRegistry
  appearances: AppearanceData
  selectedItemId: number | null
  onSelect: (itemId: number) => void
}

export function ItemPicker({ registry, appearances, selectedItemId, onSelect }: ItemPickerProps) {
  const [mode, setMode] = useState<SearchMode>('search')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ItemType>('container')
  const [properties, setProperties] = useState<PropertyFilter>({
    unpassable: false, unmovable: false, pickupable: false,
    stackable: false, rotatable: false, hangable: false,
  })
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nameTimerRef = useRef<number>(0)

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    clearTimeout(nameTimerRef.current)
    nameTimerRef.current = window.setTimeout(() => setDebouncedSearch(value), 150)
  }, [])

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

  const filteredItems = useMemo(() => {
    switch (mode) {
      case 'search': {
        if (debouncedSearch.length < 2) return allItems
        const isNumeric = /^\d+$/.test(debouncedSearch)
        if (isNumeric) {
          const searchId = parseInt(debouncedSearch, 10)
          return allItems.filter(item => item.id === searchId || item.id.toString().includes(debouncedSearch))
        }
        const lower = debouncedSearch.toLowerCase()
        return allItems.filter(item => item.name.toLowerCase().includes(lower))
      }
      case 'type': {
        return allItems.filter(item => {
          const info = registry.get(item.id)
          return info?.itemType === typeFilter
        })
      }
      case 'properties': {
        const activeProps = PROPERTY_LABELS.filter(p => properties[p.key])
        if (activeProps.length === 0) return allItems
        return allItems.filter(item => {
          const appearance = appearances.objects.get(item.id)
          const flags = appearance?.flags
          if (!flags) return false
          const info = registry.get(item.id)
          for (const prop of activeProps) {
            switch (prop.key) {
              case 'unpassable': if (!flags.unsight) return false; break
              case 'unmovable': if (!flags.unmove) return false; break
              case 'pickupable': if (!flags.take) return false; break
              case 'stackable': if (!flags.cumulative) return false; break
              case 'rotatable': if (!info?.rotateTo) return false; break
              case 'hangable': if (!flags.hang) return false; break
            }
          }
          return true
        })
      }
    }
  }, [mode, debouncedSearch, typeFilter, properties, allItems, registry, appearances])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [filteredItems])

  const totalRows = Math.ceil(filteredItems.length / COLS)
  const totalHeight = totalRows * CELL_HEIGHT
  const viewportHeight = scrollRef.current?.clientHeight ?? 300

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop)
  }, [])

  const startRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - BUFFER_ROWS)
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / CELL_HEIGHT) + BUFFER_ROWS)
  const visibleItems = filteredItems.slice(startRow * COLS, endRow * COLS)

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Search mode tabs */}
      <div className="category-tabs !px-0 !py-0">
        {([['search', 'Search'], ['type', 'Type'], ['properties', 'Props']] as const).map(([key, label]) => (
          <button
            key={key}
            className={clsx('category-tab', mode === key && 'active')}
            onClick={() => setMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mode-specific controls */}
      {mode === 'search' && (
        <input
          className="search-input"
          type="text"
          placeholder="Name or ID..."
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          autoFocus
        />
      )}
      {mode === 'type' && (
        <select
          className="search-input"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as ItemType)}
        >
          {ITEM_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      )}
      {mode === 'properties' && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 py-1">
          {PROPERTY_LABELS.map(p => (
            <label key={p.key} className="item-picker-checkbox">
              <input
                type="checkbox"
                checked={properties[p.key]}
                onChange={e => setProperties(prev => ({ ...prev, [p.key]: e.target.checked }))}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Count */}
      <div className="flex items-center">
        <span className="value text-xs text-fg-faint">{filteredItems.length.toLocaleString()} items</span>
      </div>

      {/* Results grid */}
      <div
        ref={scrollRef}
        className={clsx(
          'overflow-y-auto overflow-x-hidden flex-1 min-h-0',
        )}
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
            {visibleItems.map(item => (
              <div
                key={item.id}
                className={clsx('item-cell', item.id === selectedItemId && 'selected')}
                onClick={() => onSelect(item.id)}
                title={`${item.name} (ID: ${item.id})`}
              >
                <ItemSprite itemId={item.id} appearances={appearances} size={36} />
                <span className="item-name">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
