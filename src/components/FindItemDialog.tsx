import { useState, useCallback, useRef, useEffect } from 'react'
import type { OtbmMap } from '../lib/otbm'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import { findItemsOnMap, type SearchResult } from '../lib/mapSearch'
import type { SelectedItemInfo } from '../hooks/useSelection'
import { ItemPicker } from './ItemPicker'
import { ScopeSelector } from './ScopeSelector'
import { XIcon, MagnifyingGlassIcon, MagnifyingGlassMinusIcon } from '@phosphor-icons/react'

interface FindItemDialogProps {
  mapData: OtbmMap
  registry: ItemRegistry
  appearances: AppearanceData
  hasSelection: boolean
  selectedItems: SelectedItemInfo[]
  onNavigate: (x: number, y: number, z: number) => void
  onClose: () => void
  left?: string
}

export function FindItemDialog({
  mapData,
  registry,
  appearances,
  hasSelection,
  selectedItems,
  onNavigate,
  onClose,
  left = '8px',
}: FindItemDialogProps) {
  const [findItemId, setFindItemId] = useState<number | null>(null)
  const [scope, setScope] = useState<'map' | 'selection'>('map')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [visibleCount, setVisibleCount] = useState(200)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null)

  const handleFind = useCallback(async () => {
    if (!findItemId) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const scopeKeys = scope === 'selection' && hasSelection
      ? new Set(selectedItems.map(s => `${s.x},${s.y},${s.z}`))
      : undefined

    setSearching(true)
    setProgress(0)
    setResults(null)
    setVisibleCount(200)

    const found = await findItemsOnMap(
      mapData, findItemId, scopeKeys,
      (processed, total) => setProgress(processed / total),
      controller.signal,
    )

    if (!controller.signal.aborted) {
      setResults(found)
      setSearching(false)
    }
  }, [findItemId, scope, hasSelection, selectedItems, mapData])

  const totalItems = results ? results.reduce((sum, r) => sum + r.itemIndices.length, 0) : 0

  return (
    <div
      className="panel absolute top-4 bottom-4 z-10 flex w-[340px] flex-col pointer-events-auto transition-[left] duration-[180ms] ease-out"
      style={{ left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="label text-lg tracking-wide">FIND ITEM</span>
        <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close (Esc)">
          <XIcon size={14} weight="bold" />
        </button>
      </div>

      <div className="mx-6 h-px bg-border-subtle" />

      {/* Search controls — top half */}
      <div className="flex-1 basis-0 min-h-0 flex flex-col px-5 pt-4 pb-4">
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <ItemPicker
            registry={registry}
            appearances={appearances}
            selectedItemId={findItemId}
            onSelect={setFindItemId}
          />

          {/* Action bar: scope + find */}
          <div className="find-action-bar shrink-0">
            <ScopeSelector scope={scope} onScopeChange={setScope} hasSelection={hasSelection} />
            <div className="flex-1" />
            <button
              className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover shrink-0 w-[90px]"
              disabled={!findItemId || searching}
              onClick={handleFind}
            >
              {searching ? 'Searching…' : 'Find All'}
            </button>
          </div>

          {/* Progress bar */}
          {searching && (
            <div className="h-[3px] w-full overflow-hidden rounded-[2px] bg-elevated shrink-0">
              <div
                className="h-full rounded-[2px] bg-accent transition-[width] duration-200 ease-out"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results — bottom half */}
      <div className="flex-1 basis-0 min-h-0 flex flex-col find-results-section">
        {/* Results header */}
        <div className="flex items-center gap-4 px-6 py-3">
          <span className="label shrink-0">Results</span>
          {results !== null && !searching && (
            <span className="value text-xs text-accent-fg">
              {totalItems} item{totalItems !== 1 ? 's' : ''} on {results.length} tile{results.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3" ref={(el) => { scrollRef.current = el; setScrollEl(el) }}>
          {results !== null && results.length > 0 ? (
            <div className="flex flex-col gap-px">
              {results.slice(0, visibleCount).map((r, i) => (
                <button
                  key={i}
                  className="find-result-row"
                  onClick={() => onNavigate(r.x, r.y, r.z)}
                >
                  <span className="find-result-coords">{r.x}, {r.y}, {r.z}</span>
                  <span className="find-result-count">&times;{r.itemIndices.length}</span>
                </button>
              ))}
              {results.length > visibleCount && (
                <LoadMoreSentinel root={scrollEl} onVisible={() => setVisibleCount(c => c + 200)}>
                  <div className="flex items-center justify-center gap-3 py-4 text-fg-faint">
                    <div className="h-3 w-3 animate-spin rounded-full border border-border-default border-t-accent" />
                    <span className="text-xs">Loading more…</span>
                  </div>
                </LoadMoreSentinel>
              )}
            </div>
          ) : results !== null ? (
            <div className="find-empty-state">
              <MagnifyingGlassMinusIcon size={24} className="text-fg-disabled" />
              <span>No matches found</span>
            </div>
          ) : (
            <div className="find-empty-state">
              <MagnifyingGlassIcon size={24} className="text-fg-disabled" />
              <span>Select an item and click Find All</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadMoreSentinel({ root, onVisible, children }: { root: Element | null; onVisible: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onVisible)
  useEffect(() => {
    callbackRef.current = onVisible
  })

  useEffect(() => {
    const el = ref.current
    if (!el || !root) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) callbackRef.current() },
      { root, threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [root])

  return <div ref={ref}>{children}</div>
}
