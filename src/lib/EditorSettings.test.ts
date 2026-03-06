// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, importSettings, DEFAULT_SETTINGS } from './EditorSettings'

describe('EditorSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadSettings', () => {
    it('returns defaults when localStorage is empty', () => {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    })

    it('returns defaults when localStorage has invalid JSON', () => {
      localStorage.setItem('tibia-editor-settings', 'not json')
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    })

    it('merges partial saved settings with defaults', () => {
      localStorage.setItem('tibia-editor-settings', JSON.stringify({ showLights: true }))
      const settings = loadSettings()
      expect(settings.showLights).toBe(true)
      expect(settings.floorViewMode).toBe('single') // default
    })

    it('returns a new object each time (no shared reference)', () => {
      const a = loadSettings()
      const b = loadSettings()
      expect(a).not.toBe(b)
    })
  })

  describe('saveSettings + loadSettings round-trip', () => {
    it('persists and restores all settings', () => {
      const custom = {
        ...DEFAULT_SETTINGS,
        showLights: true,
        floorViewMode: 'all' as const,
        autoMagic: false,
      }
      saveSettings(custom)
      expect(loadSettings()).toEqual(custom)
    })
  })

  describe('importSettings', () => {
    it('returns merged settings for valid JSON', () => {
      const result = importSettings('{"showLights": true}')
      expect(result).not.toBeNull()
      expect(result!.showLights).toBe(true)
      expect(result!.floorViewMode).toBe('single')
    })

    it('returns null for invalid JSON', () => {
      expect(importSettings('not json')).toBeNull()
    })

    it('returns null for non-object JSON', () => {
      expect(importSettings('"string"')).toBeNull()
      expect(importSettings('null')).toBeNull()
    })

    it('ignores invalid field values', () => {
      const result = importSettings('{"floorViewMode": "invalid", "showLights": 123}')
      expect(result!.floorViewMode).toBe('single') // default, invalid value ignored
      expect(result!.showLights).toBe(false) // default, non-boolean ignored
    })
  })
})
