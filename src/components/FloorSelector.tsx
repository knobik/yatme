import { CaretUpIcon, CaretDownIcon, EyeIcon } from '@phosphor-icons/react'
import type { FloorViewMode } from '../lib/MapRenderer'

interface FloorSelectorProps {
  floor: number
  floorViewMode: FloorViewMode
  showTransparentUpper: boolean
  onFloorChange: (delta: number) => void
  onFloorViewMode: (mode: FloorViewMode) => void
  onToggleTransparentUpper: () => void
}

export function FloorSelector({
  floor,
  floorViewMode,
  showTransparentUpper,
  onFloorChange,
  onFloorViewMode,
  onToggleTransparentUpper,
}: FloorSelectorProps) {
  return (
    <div className="panel absolute top-1/2 right-4 z-10 flex -translate-y-1/2 flex-col items-center gap-1 p-3">
      <button
        className="btn btn-icon border-none bg-transparent"
        onClick={() => onFloorChange(-1)}
        title="Floor up (PageUp)"
      >
        <CaretUpIcon size={16} weight="bold" />
      </button>

      <span className="value text-accent-fg text-2xl font-medium leading-none py-1">
        {floor}
      </span>

      <button
        className="btn btn-icon border-none bg-transparent"
        onClick={() => onFloorChange(1)}
        title="Floor down (PageDown)"
      >
        <CaretDownIcon size={16} weight="bold" />
      </button>

      <div className="mx-1 my-1 h-px w-full bg-border-subtle" />

      {/* Floor view mode: single / current+below / all */}
      <button
        className="btn btn-icon border-none bg-transparent"
        onClick={() => onFloorViewMode('single')}
        title="Single floor"
        style={{ color: floorViewMode === 'single' ? 'var(--color-accent)' : undefined }}
      >
        <svg width="18" height="13" viewBox="0 0 14 10" fill="none">
          <path d="M7 2L1 5L7 8L13 5L7 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        className="btn btn-icon border-none bg-transparent"
        onClick={() => onFloorViewMode('current-below')}
        title="Current floor + below"
        style={{ color: floorViewMode === 'current-below' ? 'var(--color-accent)' : undefined }}
      >
        <svg width="18" height="16" viewBox="0 0 14 12" fill="none">
          <path d="M7 1L1 4L7 7L13 4L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M1 7.5L7 10.5L13 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        className="btn btn-icon border-none bg-transparent"
        onClick={() => onFloorViewMode('all')}
        title="All floors"
        style={{ color: floorViewMode === 'all' ? 'var(--color-accent)' : undefined }}
      >
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
          <path d="M7 1L1 4L7 7L13 4L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M1 7L7 10L13 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1 10L7 13L13 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="mx-1 my-1 h-px w-full bg-border-subtle" />

      {/* Transparent upper floor toggle */}
      <button
        className="btn btn-icon border-none bg-transparent"
        onClick={onToggleTransparentUpper}
        title="Show transparent upper floor"
        style={{ color: showTransparentUpper ? 'var(--color-accent)' : undefined }}
      >
        <EyeIcon size={18} weight="bold" />
      </button>
    </div>
  )
}
