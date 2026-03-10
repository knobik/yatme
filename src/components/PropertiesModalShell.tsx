import type { ReactNode } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface PropertiesModalShellProps {
  title: string
  subtitle: string
  onApply: () => void
  onCancel: () => void
  children: ReactNode
  minWidth?: string
  maxWidth?: string
}

export function PropertiesModalShell({
  title, subtitle, onApply, onCancel, children,
  minWidth = 'min-w-[360px]', maxWidth = 'max-w-[420px]',
}: PropertiesModalShellProps) {
  useEscapeKey(onCancel)

  const handleScrimClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-scrim"
      onClick={handleScrimClick}
    >
      <div
        className={`panel flex ${minWidth} ${maxWidth} flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5">
          <span className="label text-lg tracking-wide">
            {title}
          </span>
          <div className="mt-1 font-mono text-sm text-fg-faint">
            {subtitle}
          </div>
        </div>

        {children}

        <div className="item-prop-actions px-6 pb-5">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover hover:text-fg-inverse"
            onClick={onApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
