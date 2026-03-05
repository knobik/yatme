import { useRef } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  type EditorSettings,
  saveSettings,
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
    saveSettings(next)
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
      if (result) {
        saveSettings(result)
        onChange(result)
      }
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
            <span className="font-ui text-sm font-normal text-fg-muted">Transparent Upper</span>
            <Toggle checked={settings.showTransparentUpper} onChange={v => update({ showTransparentUpper: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Show Lights</span>
            <Toggle checked={settings.showLights} onChange={v => update({ showLights: v })} />
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
            <span className="font-ui text-sm font-normal text-fg-muted">Show Palette</span>
            <Toggle checked={settings.showPalette} onChange={v => update({ showPalette: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Click to Inspect</span>
            <Toggle checked={settings.clickToInspect} onChange={v => update({ clickToInspect: v })} />
          </div>
        </div>

        <div className="h-px w-full bg-border-subtle" />

        {/* Data section */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Data</div>
          <div className="flex gap-3">
            <button type="button" className="btn" onClick={handleImport}>Import...</button>
            <button type="button" className="btn" onClick={() => exportSettings(settings)}>Export</button>
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

// ── Toggle component ────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="settings-toggle-track" />
    </label>
  )
}
