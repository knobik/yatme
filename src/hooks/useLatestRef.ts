import { useRef, useEffect } from 'react'

/**
 * Returns a ref that always holds the latest value.
 * Useful for avoiding stale closures in callbacks registered once (e.g., on mount).
 */
export function useLatestRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => { ref.current = value })
  return ref
}
