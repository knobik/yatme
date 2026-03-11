import { useRef, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  type EditorSettings,
  DEFAULT_SETTINGS,
  exportSettings,
  importSettings,
} from '../lib/EditorSettings'
import type { FloorViewMode } from '../lib/constants'

interface SettingsModalProps {
  settings: EditorSettings
  onChange: (settings: EditorSettings) => void
  onClose: () => void
}

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const scrimRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEscapeKey(onClose)

  function handleScrimClick(e: React.MouseEvent) {
    if (e.target === scrimRef.current) onClose()
  }

  function update(patch: Partial<EditorSettings>) {
    const next = { ...settings, ...patch }
    onChange(next)
  }

  function handleImport() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = importSettings(reader.result as string)
      if (result) onChange(result)
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }

  return (
    <div ref={scrimRef} className="fixed inset-0 z-200 flex items-center justify-center bg-scrim" onClick={handleScrimClick}>
      <div className="panel flex min-w-[340px] max-w-[400px] flex-col gap-6 p-8">
        <div className="font-display text-lg font-semibold tracking-wide uppercase text-fg">Settings</div>

        {/* View section */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">View</div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Floor View Mode</span>
            <select
              className="w-[140px] cursor-pointer rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
              value={settings.floorViewMode}
              onChange={e => update({ floorViewMode: e.target.value as FloorViewMode })}
            >
              <option value="single">Single</option>
              <option value="current-below">Current + Below</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Transparent Upper Floors</span>
            <Toggle checked={settings.showTransparentUpper} onChange={v => update({ showTransparentUpper: v })} />
          </div>

        </div>

        <div className="h-px w-full bg-border-subtle" />

        {/* Editor section */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Editor</div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Selection Border</span>
            <Toggle checked={settings.selectionBorder} onChange={v => update({ selectionBorder: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Click to Inspect</span>
            <Toggle checked={settings.clickToInspect} onChange={v => update({ clickToInspect: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Auto Magic</span>
            <Toggle checked={settings.autoMagic} onChange={v => update({ autoMagic: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Merge Paste</span>
            <Toggle checked={settings.mergePaste} onChange={v => update({ mergePaste: v })} />
          </div>
        </div>

        <div className="h-px w-full bg-border-subtle" />

        {/* Minimap section */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Minimap</div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Expand on Hover</span>
            <Toggle checked={settings.minimapExpandOnHover} onChange={v => update({ minimapExpandOnHover: v })} />
          </div>

          <RangeSlider label="Normal Size" value={settings.minimapSize} min={100} max={400} step={10}
            onChange={v => update({ minimapSize: v })} />
          <RangeSlider label="Expanded Size" value={settings.minimapExpandedSize} min={200} max={800} step={10}
            onChange={v => update({ minimapExpandedSize: v })} />
          <RangeSlider label="Opacity" value={settings.minimapOpacity} min={0} max={1} step={0.05}
            onChange={v => update({ minimapOpacity: v })} formatValue={v => v.toFixed(2)} />
        </div>

        <div className="h-px w-full bg-border-subtle" />

        {/* Eraser section */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Eraser</div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Leave Unique Items</span>
            <Toggle checked={settings.eraserLeaveUnique} onChange={v => update({ eraserLeaveUnique: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Keep Zones</span>
            <Toggle checked={settings.eraserKeepZones} onChange={v => update({ eraserKeepZones: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Keep Map Flags</span>
            <Toggle checked={settings.eraserKeepMapFlags} onChange={v => update({ eraserKeepMapFlags: v })} />
          </div>
        </div>

        <div className="h-px w-full bg-border-subtle" />

        {/* Data section */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Data</div>
          <div className="flex gap-3">
            <button type="button" className="btn" onClick={handleImport}>Import...</button>
            <button type="button" className="btn" onClick={() => exportSettings(settings)}>Export</button>
            <button type="button" className="btn border-danger/40 text-danger hover:border-danger hover:bg-danger/10" onClick={() => {
              onChange({ ...DEFAULT_SETTINGS })
            }}>Reset to Defaults</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover hover:text-fg-inverse" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Shared setting components ────────────────────────────────────────

function RangeSlider({ label, value, min, max, step, onChange, formatValue = String }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; formatValue?: (v: number) => string
}) {
  const [localValue, setLocalValue] = useState<number | null>(null)
  const display = localValue ?? value

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-ui text-sm font-normal text-fg-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={display}
          onPointerDown={() => setLocalValue(value)}
          onChange={e => setLocalValue(+e.target.value)}
          onPointerUp={() => { if (localValue !== null) { onChange(localValue); setLocalValue(null) } }}
          onLostPointerCapture={() => { if (localValue !== null) { onChange(localValue); setLocalValue(null) } }}
          className="w-[100px] accent-accent" />
        <span className="w-[36px] text-right font-mono text-xs text-fg">{formatValue(display)}</span>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="settings-toggle-track" />
    </label>
  )
}
