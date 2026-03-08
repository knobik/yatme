export type SavePhase = 'serialize' | 'upload'

interface SaveToastProps {
  progress: number // 0–1
  phase: SavePhase
}

const phaseLabels: Record<SavePhase, string> = {
  serialize: 'Serializing map\u2026',
  upload: 'Uploading map\u2026',
}

export function SaveToast({ progress, phase }: SaveToastProps) {
  const pct = Math.round(progress * 100)

  return (
    <div
      className="panel absolute bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 px-5 py-3"
      style={{ minWidth: 260, maxWidth: 340 }}
    >
      {/* Spinner */}
      <div className="relative h-[16px] w-[16px] shrink-0">
        <div className="absolute inset-0 animate-spin rounded-full border-[2px] border-border-default border-t-accent" />
      </div>

      {/* Label + progress bar */}
      <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
        <div className="flex items-baseline justify-between">
          <span className="font-ui text-xs text-fg-muted">{phaseLabels[phase]}</span>
          <span className="font-mono text-xs text-accent">{pct}%</span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-[2px] bg-elevated">
          <div
            className="h-full rounded-[2px] bg-accent transition-[width] duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
