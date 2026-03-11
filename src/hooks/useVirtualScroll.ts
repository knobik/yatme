import { useState, useCallback, useEffect, useRef } from 'react'

interface UseVirtualScrollOptions {
  totalItems: number
  itemHeight: number
  /** Number of extra items to render above/below the viewport */
  bufferItems?: number
  /** Columns per row (for grid layouts). Defaults to 1 for list layouts. */
  columns?: number
}

interface UseVirtualScrollResult {
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** Total height of the scrollable content in px */
  totalHeight: number
  /** First visible item index (accounting for buffer) */
  startIndex: number
  /** One past the last visible item index (accounting for buffer) */
  endIndex: number
  /** Scroll event handler — attach to onScroll */
  handleScroll: () => void
  /** Reset scroll position to top */
  resetScroll: () => void
}

export function useVirtualScroll({
  totalItems,
  itemHeight,
  bufferItems = 4,
  columns = 1,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(400)

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
      setViewportHeight(scrollRef.current.clientHeight)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewportHeight(el.clientHeight)
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const resetScroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [])

  const totalRows = columns > 1 ? Math.ceil(totalItems / columns) : totalItems
  const totalHeight = totalRows * itemHeight

  const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferItems)
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / itemHeight) + bufferItems)

  const startIndex = startRow * columns
  const endIndex = Math.min(totalItems, endRow * columns)

  return { scrollRef, totalHeight, startIndex, endIndex, handleScroll, resetScroll }
}
