import { useEffect, useRef } from 'react'
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

  // Escape dismissal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

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
    <div ref={scrimRef} className="goto-scrim" onClick={handleScrimClick}>
      <div className="panel settings-modal">
        <div className="settings-title">Settings</div>

        {/* View section */}
        <div className="settings-section">
          <div className="settings-section-title">View</div>

          <div className="settings-row">
            <span className="settings-row-label">Floor View Mode</span>
            <select
              className="settings-select"
              value={settings.floorViewMode}
              onChange={e => update({ floorViewMode: e.target.value as FloorViewMode })}
            >
              <option value="single">Single</option>
              <option value="current-below">Current + Below</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Transparent Upper</span>
            <Toggle checked={settings.showTransparentUpper} onChange={v => update({ showTransparentUpper: v })} />
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Show Lights</span>
            <Toggle checked={settings.showLights} onChange={v => update({ showLights: v })} />
          </div>
        </div>

        <div className="separator" />

        {/* Editor section */}
        <div className="settings-section">
          <div className="settings-section-title">Editor</div>

          <div className="settings-row">
            <span className="settings-row-label">Selection Border</span>
            <Toggle checked={settings.selectionBorder} onChange={v => update({ selectionBorder: v })} />
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Show Palette</span>
            <Toggle checked={settings.showPalette} onChange={v => update({ showPalette: v })} />
          </div>
        </div>

        <div className="separator" />

        {/* Data section */}
        <div className="settings-section">
          <div className="settings-section-title">Data</div>
          <div className="settings-data-row">
            <button type="button" className="btn" onClick={handleImport}>Import...</button>
            <button type="button" className="btn" onClick={() => exportSettings(settings)}>Export</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" className="btn btn-accent" onClick={onClose}>Close</button>
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
