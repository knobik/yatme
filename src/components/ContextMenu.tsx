import { useCallback, useRef } from 'react'
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

  // Clamp menu position to viewport via callback ref — runs synchronously on mount,
  // avoids setState-in-effect by directly mutating the DOM style.
  const clampRef = useCallback((el: HTMLDivElement | null) => {
    menuRef.current = el
    if (!el) return
    const rect = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (rect.right > window.innerWidth) nx = window.innerWidth - rect.width - 4
    if (rect.bottom > window.innerHeight) ny = window.innerHeight - rect.height - 4
    if (nx < 0) nx = 4
    if (ny < 0) ny = 4
    el.style.left = `${nx}px`
    el.style.top = `${ny}px`
  }, [x, y])

  useClickOutside([menuRef], onClose)
  useEscapeKey(onClose)

  const visibleGroups = groups.filter(g => g.items.length > 0)

  return (
    <div
      ref={clampRef}
      className="panel min-w-[200px] py-2 fixed z-100"
      style={{ left: x, top: y }}
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
