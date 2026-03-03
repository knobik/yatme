import { useEffect, useRef, useState } from 'react'

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
  const menuRef = useRef<HTMLDivElement>(null)

  // Click-outside dismissal
  useEffect(() => {
    if (!open) return
    let rafId = requestAnimationFrame(() => {
      rafId = 0
      const handler = (e: PointerEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
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

      {open && (
        <div
          className="panel context-menu hamburger-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
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
        </div>
      )}
    </div>
  )
}
