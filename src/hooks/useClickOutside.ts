import { type RefObject, useEffect } from 'react'

export function useClickOutside(
  refs: RefObject<Element | null>[],
  onClickOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return
    let rafId = requestAnimationFrame(() => {
      rafId = 0
      const handler = (e: PointerEvent) => {
        const target = e.target as Node
        if (refs.every(ref => ref.current && !ref.current.contains(target))) {
          onClickOutside()
        }
      }
      document.addEventListener('pointerdown', handler, true)
      cleanup = () => document.removeEventListener('pointerdown', handler, true)
    })
    let cleanup: (() => void) | undefined
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable RefObjects
  }, [onClickOutside, active])
}
