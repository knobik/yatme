import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

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

  // Click-outside dismissal
  useEffect(() => {
    if (!open) return
    let rafId = requestAnimationFrame(() => {
      rafId = 0
      const handler = (e: PointerEvent) => {
        const target = e.target as Node
        if (
          menuRef.current && !menuRef.current.contains(target) &&
          buttonRef.current && !buttonRef.current.contains(target)
        ) {
          setOpen(false)
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
  }, [open])

  // Escape key dismissal
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open])

  const dropdown = open ? createPortal(
    <div
      ref={menuRef}
      className="panel context-menu hamburger-menu"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 100,
      }}
    >
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="separator" />}
          <div className="hamburger-menu-header">{section.title}</div>
          {section.items.map((item, ii) => {
            if (item === 'separator') {
              return <div key={ii} className="separator" />
            }
            return (
              <button
                key={ii}
                className="context-menu-item"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{
                    width: 14,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--accent-text)',
                  }}>
                    {item.checked ? '\u2713' : ''}
                  </span>
                  {item.label}
                </span>
                {item.shortcut && (
                  <span className="context-menu-shortcut">{item.shortcut}</span>
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
        className="btn btn-icon"
        onClick={() => setOpen(prev => !prev)}
        title="Menu"
        style={{ border: 'none', background: 'transparent' }}
      >
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
          <path d="M2 3.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M2 7H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M2 10.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {dropdown}
    </>
  )
}
