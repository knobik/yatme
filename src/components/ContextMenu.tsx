import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'

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

  useClickOutside([menuRef], onClose)
  useEscapeKey(onClose)

  const visibleGroups = groups.filter(g => g.items.length > 0)

  return (
    <div
      ref={menuRef}
      className="panel min-w-[200px] py-2 fixed z-100"
      style={{ left: pos.x, top: pos.y }}
    >
      {visibleGroups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="mx-0 my-2 h-px w-full bg-border-subtle" />}
          {group.items.map((item, ii) => (
            <button
              key={ii}
              className="flex w-full items-center justify-between border-none bg-none px-5 py-2 text-left font-ui text-sm font-normal text-fg transition-[background] duration-100 ease-out hover:enabled:bg-panel-hover disabled:cursor-default disabled:text-fg-disabled"
              disabled={item.disabled}
              onClick={() => {
                item.onClick()
                onClose()
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="ml-8 font-mono text-xs text-fg-faint">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
