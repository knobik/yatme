import { useEffect, useCallback, type RefObject } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import type { EditorToolsState } from './useEditorTools'
import type { EditorSettings } from '../lib/EditorSettings'
import { saveSettings } from '../lib/EditorSettings'
import type { ContextMenuState } from './useContextMenu'

interface UseKeyboardShortcutsOptions {
  toolsRef: RefObject<EditorToolsState>
  mutatorRef: RefObject<MapMutator | null>
  rendererRef: RefObject<MapRenderer | null>
  handleSave: () => void
  handleFloorChange: (delta: number) => void
  showPalette: boolean
  setShowPalette: React.Dispatch<React.SetStateAction<boolean>>
  showLights: boolean
  setShowLights: React.Dispatch<React.SetStateAction<boolean>>
  showGoToDialog: boolean
  setShowGoToDialog: React.Dispatch<React.SetStateAction<boolean>>
  showFindItem: boolean
  setShowFindItem: React.Dispatch<React.SetStateAction<boolean>>
  showReplaceItems: boolean
  setShowReplaceItems: React.Dispatch<React.SetStateAction<boolean>>
  showZonePalette: boolean
  setEditorSettings: React.Dispatch<React.SetStateAction<EditorSettings>>
  selectedTilePos: { x: number; y: number; z: number } | null
  setSelectedTilePos: React.Dispatch<React.SetStateAction<{ x: number; y: number; z: number } | null>>
  contextMenu: ContextMenuState | null
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState | null>>
  placingHouseExit: number | null
  setPlacingHouseExit: React.Dispatch<React.SetStateAction<number | null>>
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
    toolsRef,
    mutatorRef,
    rendererRef,
    handleSave,
    handleFloorChange,
    showPalette,
    setShowPalette,
    setShowLights,
    showGoToDialog,
    setShowGoToDialog,
    showFindItem,
    setShowFindItem,
    showReplaceItems,
    setShowReplaceItems,
    showZonePalette,
    setEditorSettings,
    selectedTilePos,
    setSelectedTilePos,
    contextMenu,
    setContextMenu,
    placingHouseExit,
    setPlacingHouseExit,
  } = options

  const borderizeCurrentSelection = useCallback(() => {
    const sel = toolsRef.current.selectedItems
    if (sel.length === 0 || !mutatorRef.current) return
    const uniqueTiles = new Map<string, { x: number; y: number; z: number }>()
    for (const item of sel) {
      const key = `${item.x},${item.y},${item.z}`
      if (!uniqueTiles.has(key)) uniqueTiles.set(key, { x: item.x, y: item.y, z: item.z })
    }
    mutatorRef.current.borderizeSelection([...uniqueTiles.values()])
  }, [toolsRef, mutatorRef])

  const randomizeCurrentSelection = useCallback(() => {
    const sel = toolsRef.current.selectedItems
    if (sel.length === 0 || !mutatorRef.current) return
    const uniqueTiles = new Map<string, { x: number; y: number; z: number }>()
    for (const item of sel) {
      const key = `${item.x},${item.y},${item.z}`
      if (!uniqueTiles.has(key)) uniqueTiles.set(key, { x: item.x, y: item.y, z: item.z })
    }
    mutatorRef.current.randomizeSelection([...uniqueTiles.values()])
  }, [toolsRef, mutatorRef])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault()
          handleSave()
          return
        }
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          toolsRef.current.undo()
          return
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z')) {
          e.preventDefault()
          toolsRef.current.redo()
          return
        }
        if (e.key === 'c') {
          e.preventDefault()
          toolsRef.current.copy()
          return
        }
        if (e.key === 'x') {
          e.preventDefault()
          toolsRef.current.cut()
          return
        }
        if (e.key === 'v') {
          e.preventDefault()
          toolsRef.current.paste()
          return
        }
        if (e.key === 'g') {
          e.preventDefault()
          setShowGoToDialog(true)
          return
        }
        if (e.key === 'f') {
          e.preventDefault()
          setShowFindItem(true)
          setShowReplaceItems(false)
          return
        }
        if (e.key === 'h') {
          e.preventDefault()
          setShowReplaceItems(true)
          setShowFindItem(false)
          return
        }
        if (e.key === 'b') {
          e.preventDefault()
          borderizeCurrentSelection()
          return
        }
        if (e.key === 'r' && !e.shiftKey) {
          e.preventDefault()
          const sel = toolsRef.current.selectedItems
          if (sel.length > 0 && mutatorRef.current) {
            const last = sel[sel.length - 1]
            mutatorRef.current.rotateItem(last.x, last.y, last.z, -1)
          }
          return
        }
        if (e.key === 'R' && e.shiftKey) {
          e.preventDefault()
          randomizeCurrentSelection()
          return
        }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          rendererRef.current?.zoomIn()
          return
        }
        if (e.key === '-') {
          e.preventDefault()
          rendererRef.current?.zoomOut()
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          rendererRef.current?.resetZoom()
          return
        }
        return
      }

      if (e.key === 'PageUp') {
        e.preventDefault()
        handleFloorChange(-1)
      } else if (e.key === 'PageDown') {
        e.preventDefault()
        handleFloorChange(1)
      } else if (e.key === 'Delete') {
        e.preventDefault()
        toolsRef.current.deleteSelection()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (placingHouseExit != null) {
          setPlacingHouseExit(null)
        } else if (toolsRef.current.isPasting) {
          toolsRef.current.cancelPaste()
        } else if (showGoToDialog) {
          setShowGoToDialog(false)
        } else if (showFindItem) {
          setShowFindItem(false)
        } else if (showReplaceItems) {
          setShowReplaceItems(false)
        } else if (contextMenu) {
          setContextMenu(null)
        } else if (showPalette) {
          setShowPalette(false)
        } else if (selectedTilePos) {
          setSelectedTilePos(null)
          rendererRef.current?.deselectTile()
          toolsRef.current.setSelectedItems([])
          toolsRef.current.selectTiles([])
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setShowPalette(prev => {
          const next = !prev
          setEditorSettings(s => { const u = { ...s, showPalette: next }; saveSettings(u); return u })
          return next
        })
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setShowLights(prev => {
          const next = !prev
          rendererRef.current?.setShowLights(next)
          setEditorSettings(s => { const u = { ...s, showLights: next }; saveSettings(u); return u })
          return next
        })
      } else if (e.key === 's' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('select')
      } else if (e.key === 'd' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('draw')
      } else if (e.key === 'e' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('erase')
      } else if (e.key === 'r' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('door')
      } else if (e.key === 'f' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('fill')
      } else if (e.key === 'z' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('zone')
      } else if (e.key === 'h' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('house')
      } else if (e.key === ']') {
        e.preventDefault()
        const cur = toolsRef.current.brushSize
        if (cur < 6) toolsRef.current.setBrushSize(cur + 1)
      } else if (e.key === '[') {
        e.preventDefault()
        const cur = toolsRef.current.brushSize
        if (cur > 0) toolsRef.current.setBrushSize(cur - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleFloorChange, handleSave, showPalette, showZonePalette, selectedTilePos, contextMenu, showGoToDialog, showFindItem, showReplaceItems, placingHouseExit])

  return { borderizeCurrentSelection, randomizeCurrentSelection }
}
