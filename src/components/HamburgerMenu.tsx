import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'
import { ListIcon } from '@phosphor-icons/react'

export interface MenuAction {
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  onClick: () => void
}

export interface MenuSection {
  title: string
  items: (MenuAction | 'separator')[]
}

interface HamburgerMenuProps {
  sections: MenuSection[]
}

export function HamburgerMenu({ sections }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Position the menu below the button
  const updatePos = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
  }, [open, updatePos])

  const closeMenu = useCallback(() => setOpen(false), [])
  useClickOutside([menuRef, buttonRef], closeMenu, open)
  useEscapeKey(closeMenu, open)

  const dropdown = open ? createPortal(
    <div
      ref={menuRef}
      className="panel min-w-[240px] py-2 fixed z-100"
      style={{ top: pos.top, left: pos.left }}
    >
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="mx-0 my-2 h-px w-full bg-border-subtle" />}
          <div className="px-5 pt-3 pb-1 font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">{section.title}</div>
          {section.items.map((item, ii) => {
            if (item === 'separator') {
              return <div key={ii} className="mx-0 my-2 h-px w-full bg-border-subtle" />
            }
            return (
              <button
                key={ii}
                className="flex w-full items-center justify-between border-none bg-none px-5 py-2 text-left font-ui text-sm font-normal text-fg transition-[background] duration-100 ease-out hover:enabled:bg-panel-hover disabled:cursor-default disabled:text-fg-disabled"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="w-[14px] text-center font-mono text-sm text-accent-fg">
                    {item.checked ? '\u2713' : ''}
                  </span>
                  {item.label}
                </span>
                {item.shortcut && (
                  <span className="ml-8 font-mono text-xs text-fg-faint">{item.shortcut}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        className="btn btn-icon border-none bg-transparent"
        onClick={() => setOpen(prev => !prev)}
        title="Menu"
      >
        <ListIcon size={18} weight="bold" />
      </button>
      {dropdown}
    </>
  )
}
