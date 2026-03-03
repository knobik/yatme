import { useEffect, useRef, useState } from 'react'

export interface ContextMenuAction {
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
}

export interface ContextMenuGroup {
  items: ContextMenuAction[]
}

interface ContextMenuProps {
  x: number
  y: number
  groups: ContextMenuGroup[]
  onClose: () => void
}

export function ContextMenu({ x, y, groups, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Reposition if menu overflows viewport edges
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (rect.right > window.innerWidth) nx = window.innerWidth - rect.width - 4
    if (rect.bottom > window.innerHeight) ny = window.innerHeight - rect.height - 4
    if (nx < 0) nx = 4
    if (ny < 0) ny = 4
    if (nx !== pos.x || ny !== pos.y) setPos({ x: nx, y: ny })
  }, [x, y])

  // Click-outside dismissal (delayed to skip the opening event)
  useEffect(() => {
    let rafId = requestAnimationFrame(() => {
      rafId = 0
      const handler = (e: PointerEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose()
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
  }, [onClose])

  // Escape key dismissal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  const visibleGroups = groups.filter(g => g.items.length > 0)

  return (
    <div
      ref={menuRef}
      className="panel context-menu"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 100,
      }}
    >
      {visibleGroups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="separator" />}
          {group.items.map((item, ii) => (
            <button
              key={ii}
              className="context-menu-item"
              disabled={item.disabled}
              onClick={() => {
                item.onClick()
                onClose()
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="context-menu-shortcut">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
