import type { FloorViewMode } from './constants'
import { triggerDownload } from './triggerDownload'

// ── Editor Settings ──────────────────────────────────────────────────

export interface EditorSettings {
  // View
  floorViewMode: FloorViewMode
  showTransparentUpper: boolean
  showLights: boolean
  showAnimations: boolean

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
  showCreaturePalette: boolean

  // Creatures
  showMonsters: boolean
  showMonsterSpawns: boolean
  showNpcs: boolean
  showNpcSpawns: boolean
  autoCreateSpawn: boolean

  // Waypoints
  showWaypointOverlay: boolean
  showWaypointPalette: boolean

  // Minimap
  showMinimap: boolean
  minimapExpandOnHover: boolean
  minimapSize: number
  minimapExpandedSize: number
  minimapOpacity: number

  // Grid
  showGrid: boolean

  // Client Box
  showClientBox: boolean

  // Eraser
  eraserLeaveUnique: boolean
  eraserKeepZones: boolean
  eraserKeepMapFlags: boolean

  // Debug
  showStats: boolean
}

export const DEFAULT_SETTINGS: EditorSettings = {
  floorViewMode: 'single',
  showTransparentUpper: false,
  showLights: false,
  showAnimations: true,
  selectionBorder: false,
  showPalette: true,
  clickToInspect: false,
  autoMagic: true,
  mergePaste: true,
  showZonePalette: false,
  showZoneOverlay: false,
  showHousePalette: false,
  showHouseOverlay: false,
  showCreaturePalette: false,
  showMonsters: true,
  showMonsterSpawns: true,
  showNpcs: true,
  showNpcSpawns: true,
  autoCreateSpawn: true,
  showWaypointOverlay: false,
  showWaypointPalette: false,
  showMinimap: true,
  minimapExpandOnHover: true,
  minimapSize: 200,
  minimapExpandedSize: 600,
  minimapOpacity: 1.0,
  showGrid: false,
  showClientBox: false,
  eraserLeaveUnique: true,
  eraserKeepZones: false,
  eraserKeepMapFlags: false,
  showStats: false,
}

/** Union of all boolean keys in EditorSettings — used to type-check toggle callbacks. */
export type BooleanSettingKey = { [K in keyof EditorSettings]: EditorSettings[K] extends boolean ? K : never }[keyof EditorSettings]

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

const VALID_FLOOR_VIEW_MODES = new Set(['single', 'current-below', 'all'])

function mergeWithDefaults(parsed: Record<string, unknown>): EditorSettings {
  const s = { ...DEFAULT_SETTINGS }
  if (VALID_FLOOR_VIEW_MODES.has(parsed.floorViewMode as string)) {
    s.floorViewMode = parsed.floorViewMode as EditorSettings['floorViewMode']
  }
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof EditorSettings)[]) {
    if (key === 'floorViewMode') continue
    if (typeof parsed[key] === typeof DEFAULT_SETTINGS[key]) {
      ;(s as Record<string, unknown>)[key] = parsed[key]
    }
  }
  return s
}
