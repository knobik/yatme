import type { FloorViewMode } from './constants'

// ── Editor Settings ──────────────────────────────────────────────────

export interface EditorSettings {
  // View
  floorViewMode: FloorViewMode
  showTransparentUpper: boolean
  showLights: boolean

  // Editor
  selectionBorder: boolean
  showPalette: boolean
}

export const DEFAULT_SETTINGS: EditorSettings = {
  floorViewMode: 'single',
  showTransparentUpper: false,
  showLights: false,
  selectionBorder: false,
  showPalette: true,
}

const SETTINGS_KEY = 'tibia-editor-settings'

export function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return mergeWithDefaults(parsed)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: EditorSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function exportSettings(settings: EditorSettings): void {
  const json = JSON.stringify(settings, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'editor-settings.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function importSettings(json: string): EditorSettings | null {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return null
    return mergeWithDefaults(parsed)
  } catch {
    return null
  }
}

function mergeWithDefaults(parsed: Record<string, unknown>): EditorSettings {
  const s = { ...DEFAULT_SETTINGS }
  if (parsed.floorViewMode === 'single' || parsed.floorViewMode === 'current-below' || parsed.floorViewMode === 'all') {
    s.floorViewMode = parsed.floorViewMode
  }
  if (typeof parsed.showTransparentUpper === 'boolean') s.showTransparentUpper = parsed.showTransparentUpper
  if (typeof parsed.showLights === 'boolean') s.showLights = parsed.showLights
  if (typeof parsed.selectionBorder === 'boolean') s.selectionBorder = parsed.selectionBorder
  if (typeof parsed.showPalette === 'boolean') s.showPalette = parsed.showPalette
  return s
}
