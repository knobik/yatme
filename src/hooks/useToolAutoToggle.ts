import { useEffect, useRef } from 'react'
import type { EditorSettings } from '../lib/EditorSettings'
import { saveSettings } from '../lib/EditorSettings'
import type { EditorTool } from './tools/types'

/**
 * Auto-toggle an overlay+palette pair when a specific tool is active.
 * When the tool becomes active, it force-enables any currently-off toggles.
 * When the tool deactivates, it restores only the toggles it had to force on.
 */
export function useToolAutoToggle(
  activeTool: EditorTool,
  toolName: EditorTool,
  overlay: {
    show: boolean
    setShow: (v: boolean) => void
    /** Renderer method to toggle the overlay — null if this toggle has no renderer counterpart. */
    rendererSet: ((enabled: boolean) => void) | null
    settingsKey: keyof EditorSettings
  },
  palette: {
    show: boolean
    setShow: (v: boolean) => void
    settingsKey: keyof EditorSettings
  },
  setEditorSettings: React.Dispatch<React.SetStateAction<EditorSettings>>,
) {
  const overlayBeforeRef = useRef<boolean | null>(null)
  const paletteBeforeRef = useRef<boolean | null>(null)
  const showOverlayRef = useRef(overlay.show)
  const showPaletteRef = useRef(palette.show)
  useEffect(() => {
    showOverlayRef.current = overlay.show
    showPaletteRef.current = palette.show
  })

  useEffect(() => {
    if (activeTool === toolName) {
      if (!showOverlayRef.current) {
        overlayBeforeRef.current = false
        overlay.setShow(true)
        overlay.rendererSet?.(true)
        setEditorSettings(s => { const u = { ...s, [overlay.settingsKey]: true } as EditorSettings; saveSettings(u); return u })
      }
      if (!showPaletteRef.current) {
        paletteBeforeRef.current = false
        palette.setShow(true)
        setEditorSettings(s => { const u = { ...s, [palette.settingsKey]: true } as EditorSettings; saveSettings(u); return u })
      }
    } else {
      if (overlayBeforeRef.current === false) {
        overlayBeforeRef.current = null
        overlay.setShow(false)
        overlay.rendererSet?.(false)
        setEditorSettings(s => { const u = { ...s, [overlay.settingsKey]: false } as EditorSettings; saveSettings(u); return u })
      }
      if (paletteBeforeRef.current === false) {
        paletteBeforeRef.current = null
        palette.setShow(false)
        setEditorSettings(s => { const u = { ...s, [palette.settingsKey]: false } as EditorSettings; saveSettings(u); return u })
      }
    }
  }, [activeTool]) // eslint-disable-line react-hooks/exhaustive-deps
}
