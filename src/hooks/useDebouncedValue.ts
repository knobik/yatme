import { useState, useEffect, useRef } from 'react'

/**
 * Returns a debounced version of a value that only updates after `delay` ms of inactivity.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const timerRef = useRef<number>(0)

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timerRef.current)
  }, [value, delay])

  return debounced
}
