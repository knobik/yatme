import { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'
import { CaretRightIcon } from '@phosphor-icons/react'

export interface MenuAction {
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  onClick: () => void
}

export interface MenuSubmenu {
  label: string
  items: (MenuAction | 'separator')[]
}

export interface MenuHeading {
  heading: string
}

export type MenuItem = MenuAction | 'separator' | MenuSubmenu | MenuHeading

export interface MenuSection {
  title: string
  items: MenuItem[]
}

function isMenuAction(item: MenuItem): item is MenuAction {
  return typeof item === 'object' && 'onClick' in item
}

function isMenuSubmenu(item: MenuItem): item is MenuSubmenu {
  return typeof item === 'object' && 'items' in item
}

function isMenuHeading(item: MenuItem): item is MenuHeading {
  return typeof item === 'object' && 'heading' in item
}

/* ── Shared primitives ───────────────────────────────────────────── */

function MenuSeparator() {
  return <div className="mx-0 my-2 h-px w-full bg-border-subtle" />
}

function MenuActionButton({ action, onClose }: { action: MenuAction; onClose: () => void }) {
  return (
    <button
      className="flex w-full items-center justify-between border-none bg-none px-5 py-2 text-left font-ui text-sm font-normal text-fg transition-[background] duration-100 ease-out hover:enabled:bg-panel-hover disabled:cursor-default disabled:text-fg-disabled"
      disabled={action.disabled}
      onClick={() => {
        action.onClick()
        onClose()
      }}
    >
      <span className="flex items-center gap-3">
        <span className="w-[14px] text-center font-mono text-sm text-accent-fg">
          {action.checked ? '\u2713' : ''}
        </span>
        {action.label}
      </span>
      {action.shortcut && (
        <span className="ml-8 font-mono text-xs text-fg-faint">{action.shortcut}</span>
      )}
    </button>
  )
}

/* ── Menu bar ────────────────────────────────────────────────────── */

interface MenuBarProps {
  sections: MenuSection[]
}

export function MenuBar({ sections }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const labelRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })

  const closeAll = useCallback(() => setOpenMenu(null), [])
  useEscapeKey(closeAll, openMenu !== null)
  useClickOutside(
    [containerRef, dropdownRef],
    closeAll,
    openMenu !== null,
  )

  const positionDropdown = useCallback((title: string) => {
    const el = labelRefs.current.get(title)
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left })
  }, [])

  const handleLabelClick = (title: string) => {
    if (openMenu === title) {
      setOpenMenu(null)
    } else {
      positionDropdown(title)
      setOpenMenu(title)
    }
  }

  const handleLabelEnter = (title: string) => {
    if (openMenu !== null && openMenu !== title) {
      positionDropdown(title)
      setOpenMenu(title)
    }
  }

  const activeSection = sections.find(s => s.title === openMenu)

  return (
    <div ref={containerRef} className="flex items-center gap-0.5">
      {sections.map(section => (
        <button
          key={section.title}
          ref={el => {
            if (el) labelRefs.current.set(section.title, el)
            else labelRefs.current.delete(section.title)
          }}
          className={`menu-label ${openMenu === section.title ? 'menu-label-active' : ''}`}
          onClick={() => handleLabelClick(section.title)}
          onMouseEnter={() => handleLabelEnter(section.title)}
        >
          {section.title}
        </button>
      ))}

      {activeSection && createPortal(
        <MenuDropdown
          ref={dropdownRef}
          items={activeSection.items}
          pos={dropdownPos}
          onClose={closeAll}
        />,
        document.body,
      )}
    </div>
  )
}

/* ── Dropdown panel ───────────────────────────────────────────────── */

interface MenuDropdownProps {
  items: MenuItem[]
  pos: { top: number; left: number }
  onClose: () => void
}

const MenuDropdown = forwardRef<HTMLDivElement, MenuDropdownProps>(
  function MenuDropdown({ items, pos, onClose }, ref) {
    return (
      <div
        ref={ref}
        className="panel min-w-[240px] py-2 fixed z-100"
        style={{ top: pos.top, left: pos.left }}
      >
        {items.map((item, i) => (
          <MenuItemRow key={i} item={item} onClose={onClose} />
        ))}
      </div>
    )
  },
)

/* ── Individual menu item row ─────────────────────────────────────── */

function MenuItemRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  if (item === 'separator') {
    return <MenuSeparator />
  }

  if (isMenuHeading(item)) {
    return (
      <div className="px-5 pt-3 pb-1 font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">
        {item.heading}
      </div>
    )
  }

  if (isMenuSubmenu(item)) {
    return <SubmenuRow submenu={item} onClose={onClose} />
  }

  if (isMenuAction(item)) {
    return <MenuActionButton action={item} onClose={onClose} />
  }

  return null
}

/* ── Submenu with flyout ──────────────────────────────────────────── */

function SubmenuRow({ submenu, onClose }: { submenu: MenuSubmenu; onClose: () => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null)

  const openFlyout = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (!rowRef.current) return
      const rect = rowRef.current.getBoundingClientRect()
      setFlyoutPos({ top: rect.top - 8, left: rect.right + 2 })
    }, 150)
  }, [])

  const closeFlyout = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setFlyoutPos(null)
    }, 200)
  }, [])

  const keepFlyout = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      ref={rowRef}
      className="relative"
      onMouseEnter={openFlyout}
      onMouseLeave={closeFlyout}
    >
      <div className="flex w-full items-center justify-between px-5 py-2 text-left font-ui text-sm font-normal text-fg transition-[background] duration-100 ease-out hover:bg-panel-hover cursor-default">
        <span className="flex items-center gap-3">
          <span className="w-[14px]" />
          {submenu.label}
        </span>
        <CaretRightIcon size={12} weight="bold" className="text-fg-faint" />
      </div>

      {flyoutPos && createPortal(
        <div
          ref={flyoutRef}
          className="panel min-w-[280px] py-2 fixed z-[101]"
          style={{ top: flyoutPos.top, left: flyoutPos.left }}
          onMouseEnter={keepFlyout}
          onMouseLeave={closeFlyout}
        >
          {submenu.items.map((item, i) => {
            if (item === 'separator') {
              return <MenuSeparator key={i} />
            }
            return <MenuActionButton key={i} action={item} onClose={onClose} />
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
