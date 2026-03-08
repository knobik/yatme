import type { FloorViewMode } from './constants'
import { triggerDownload } from './triggerDownload'

// ── Editor Settings ──────────────────────────────────────────────────

export interface EditorSettings {
  // View
  floorViewMode: FloorViewMode
  showTransparentUpper: boolean
  showLights: boolean

  // Editor
  selectionBorder: boolean
  showPalette: boolean
  clickToInspect: boolean
  autoMagic: boolean
  mergePaste: boolean
  showZonePalette: boolean
  showZoneOverlay: boolean
  showHousePalette: boolean
  showHouseOverlay: boolean
}

export const DEFAULT_SETTINGS: EditorSettings = {
  floorViewMode: 'single',
  showTransparentUpper: false,
  showLights: false,
  selectionBorder: false,
  showPalette: true,
  clickToInspect: false,
  autoMagic: true,
  mergePaste: true,
  showZonePalette: false,
  showZoneOverlay: false,
  showHousePalette: false,
  showHouseOverlay: false,
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
  triggerDownload(JSON.stringify(settings, null, 2), 'editor-settings.json', 'application/json')
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
  if (typeof parsed.clickToInspect === 'boolean') s.clickToInspect = parsed.clickToInspect
  if (typeof parsed.autoMagic === 'boolean') s.autoMagic = parsed.autoMagic
  if (typeof parsed.mergePaste === 'boolean') s.mergePaste = parsed.mergePaste
  if (typeof parsed.showZonePalette === 'boolean') s.showZonePalette = parsed.showZonePalette
  if (typeof parsed.showZoneOverlay === 'boolean') s.showZoneOverlay = parsed.showZoneOverlay
  if (typeof parsed.showHousePalette === 'boolean') s.showHousePalette = parsed.showHousePalette
  if (typeof parsed.showHouseOverlay === 'boolean') s.showHouseOverlay = parsed.showHouseOverlay
  return s
}
