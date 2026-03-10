import { useEffect, useRef } from 'react'
import type { EditorSettings, BooleanSettingKey } from '../lib/EditorSettings'
import type { EditorTool } from './tools/types'

/**
 * Auto-toggle an overlay+palette pair when a specific tool is active.
 * When the tool becomes active, it force-enables any currently-off toggles.
 * When the tool deactivates, it restores only the toggles it had to force on.
 */
export function useToolAutoToggle(
  activeTool: EditorTool,
  toolName: EditorTool,
  overlayKey: BooleanSettingKey,
  paletteKey: BooleanSettingKey,
  editorSettings: EditorSettings,
  updateSetting: (key: BooleanSettingKey, value: boolean) => void,
) {
  const overlayBeforeRef = useRef<boolean | null>(null)
  const paletteBeforeRef = useRef<boolean | null>(null)
  const settingsRef = useRef(editorSettings)
  useEffect(() => { settingsRef.current = editorSettings })

  useEffect(() => {
    if (activeTool === toolName) {
      if (!settingsRef.current[overlayKey]) {
        overlayBeforeRef.current = false
        updateSetting(overlayKey, true)
      }
      if (!settingsRef.current[paletteKey]) {
        paletteBeforeRef.current = false
        updateSetting(paletteKey, true)
      }
    } else {
      if (overlayBeforeRef.current === false) {
        overlayBeforeRef.current = null
        updateSetting(overlayKey, false)
      }
      if (paletteBeforeRef.current === false) {
        paletteBeforeRef.current = null
        updateSetting(paletteKey, false)
      }
    }
  }, [activeTool]) // eslint-disable-line react-hooks/exhaustive-deps
}
