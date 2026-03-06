import clsx from 'clsx'

interface ScopeSelectorProps {
  scope: 'map' | 'selection'
  onScopeChange: (scope: 'map' | 'selection') => void
  hasSelection: boolean
}

export function ScopeSelector({ scope, onScopeChange, hasSelection }: ScopeSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="label shrink-0">Scope</span>
      <div className="flex">
        <button
          className={clsx(
            'btn text-xs !rounded-r-none !border-r-0',
            scope === 'map' && 'border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover',
          )}
          onClick={() => onScopeChange('map')}
        >
          Entire Map
        </button>
        <button
          className={clsx(
            'btn text-xs !rounded-l-none',
            scope === 'selection' && 'border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover',
          )}
          disabled={!hasSelection}
          onClick={() => onScopeChange('selection')}
        >
          Selection
        </button>
      </div>
    </div>
  )
}
