export function LoadingOverlay({ status, progress }: { status: string; progress: number }) {
  const pct = Math.round(progress * 100)
  return (
    <div className="absolute inset-0 z-100 flex flex-col items-center justify-center gap-8 bg-void">
      {/* Animated sigil */}
      <div className="relative h-[48px] w-[48px]">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-border-default border-t-accent" />
        <div className="absolute inset-[6px] animate-spin-reverse rounded-full border-2 border-border-subtle border-b-accent-pressed" />
      </div>

      <div className="font-display text-xl font-semibold tracking-wide uppercase text-fg">
        Tibia Map Editor
      </div>

      {/* Progress bar */}
      <div className="flex w-[280px] flex-col gap-3">
        <div className="h-[4px] w-full overflow-hidden rounded-[2px] bg-elevated">
          <div className="h-full rounded-[2px] bg-accent transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-baseline justify-between">
          <div className="font-mono text-xs text-fg-faint">
            {status}
          </div>
          <div className="font-mono text-xs text-accent">
            {pct}%
          </div>
        </div>
      </div>
    </div>
  )
}
