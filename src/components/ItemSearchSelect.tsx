import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'

const MAX_RESULTS = 50

interface ItemSearchSelectProps {
  registry: ItemRegistry
  appearances: AppearanceData
  onSelect: (itemId: number) => void
  placeholder?: string
}

export function ItemSearchSelect({
  registry,
  appearances,
  onSelect,
  placeholder,
}: ItemSearchSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Build searchable item list once
  const allItems = useMemo(() => {
    const items: { id: number; name: string }[] = []
    for (const [id] of appearances.objects) {
      const appearance = appearances.objects.get(id)
      const info = appearance?.frameGroup?.[0]?.spriteInfo
      if (!info || info.spriteId.length === 0 || info.spriteId[0] === 0) continue
      items.push({ id, name: getItemDisplayName(id, registry, appearances) })
    }
    items.sort((a, b) => a.id - b.id)
    return items
  }, [appearances, registry])

  const results = useMemo(() => {
    const q = query.trim()
    if (q.length < 2) return []
    const isNumeric = /^\d+$/.test(q)
    if (isNumeric) {
      const searchId = parseInt(q, 10)
      return allItems.filter(item => item.id === searchId || item.id.toString().includes(q)).slice(0, MAX_RESULTS)
    }
    const lower = q.toLowerCase()
    return allItems.filter(item => item.name.toLowerCase().includes(lower)).slice(0, MAX_RESULTS)
  }, [query, allItems])

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  const handleSelect = useCallback((id: number) => {
    onSelect(id)
    setQuery('')
    setOpen(false)
    setHighlightIndex(0)
    inputRef.current?.focus()
  }, [onSelect])

  // Close on click outside (check both wrapper and portal list)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, open])

  // Update position when open or results change
  useEffect(() => {
    if (open) updatePosition()
  }, [open, results, updatePosition])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(results[highlightIndex].id)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        className="item-prop-input w-full"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlightIndex(0)
        }}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {open && results.length > 0 && dropdownPos && createPortal(
        <div
          ref={listRef}
          className="fixed z-300 max-h-[200px] overflow-y-auto rounded border border-border-subtle bg-elevated shadow-lg"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
          {results.map((item, i) => (
            <div
              key={item.id}
              className={clsx(
                'flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm',
                i === highlightIndex ? 'bg-accent-subtle text-fg' : 'text-fg hover:bg-panel-hover',
              )}
              onMouseDown={e => { e.preventDefault(); handleSelect(item.id) }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <ItemSprite itemId={item.id} appearances={appearances} size={24} />
              <span className="flex-1 truncate font-ui">{item.name}</span>
              <span className="shrink-0 font-mono text-xs text-fg-faint">{item.id}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
