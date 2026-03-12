import { useEffect, useCallback, type RefObject } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import type { EditorToolsState } from './useEditorTools'
import type { EditorSettings, BooleanSettingKey } from '../lib/EditorSettings'
import type { ContextMenuState } from './useContextMenu'

interface UseKeyboardShortcutsOptions {
  toolsRef: RefObject<EditorToolsState>
  mutatorRef: RefObject<MapMutator | null>
  rendererRef: RefObject<MapRenderer | null>
  handleSave: () => void
  handleFloorChange: (delta: number) => void
  editorSettings: EditorSettings
  toggleSetting: (key: BooleanSettingKey) => void
  showGoToDialog: boolean
  setShowGoToDialog: React.Dispatch<React.SetStateAction<boolean>>
  showFindItem: boolean
  setShowFindItem: React.Dispatch<React.SetStateAction<boolean>>
  showReplaceItems: boolean
  setShowReplaceItems: React.Dispatch<React.SetStateAction<boolean>>
  selectedTilePos: { x: number; y: number; z: number } | null
  setSelectedTilePos: React.Dispatch<React.SetStateAction<{ x: number; y: number; z: number } | null>>
  contextMenu: ContextMenuState | null
  setContextMenu: (menu: ContextMenuState | null) => void
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
    editorSettings,
    toggleSetting,
    showGoToDialog,
    setShowGoToDialog,
    showFindItem,
    setShowFindItem,
    showReplaceItems,
    setShowReplaceItems,
    selectedTilePos,
    setSelectedTilePos,
    contextMenu,
    setContextMenu,
    placingHouseExit,
    setPlacingHouseExit,
  } = options

  const getUniqueTilePositions = useCallback(() => {
    const sel = toolsRef.current.selectedItems
    if (sel.length === 0) return null
    const unique = new Map<string, { x: number; y: number; z: number }>()
    for (const item of sel) {
      const key = `${item.x},${item.y},${item.z}`
      if (!unique.has(key)) unique.set(key, { x: item.x, y: item.y, z: item.z })
    }
    return [...unique.values()]
  }, [toolsRef])

  const borderizeCurrentSelection = useCallback(() => {
    const tiles = getUniqueTilePositions()
    if (tiles && mutatorRef.current) mutatorRef.current.borderizeSelection(tiles)
  }, [getUniqueTilePositions, mutatorRef])

  const randomizeCurrentSelection = useCallback(() => {
    const tiles = getUniqueTilePositions()
    if (tiles && mutatorRef.current) mutatorRef.current.randomizeSelection(tiles)
  }, [getUniqueTilePositions, mutatorRef])

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
        if (e.key === 'm') {
          e.preventDefault()
          toggleSetting('showMonsterSpawns')
          return
        }
        if (e.key === 'n') {
          e.preventDefault()
          toggleSetting('showNpcSpawns')
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
        } else if (editorSettings.showPalette) {
          toggleSetting('showPalette')
        } else if (selectedTilePos) {
          setSelectedTilePos(null)
          rendererRef.current?.deselectTile()
          toolsRef.current.setSelectedItems([])
          toolsRef.current.selectTiles([])
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        toggleSetting('showPalette')
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        toggleSetting('showLights')
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
      } else if (e.key === 'c' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('creature')
      } else if (e.key === 'w' && !e.ctrlKey) {
        e.preventDefault()
        toolsRef.current.setActiveTool('waypoint')
      } else if (e.key === 'm' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault()
        toggleSetting('showMonsters')
      } else if (e.key === 'M' && e.shiftKey && !e.ctrlKey) {
        e.preventDefault()
        toggleSetting('showMinimap')
      } else if (e.key === 'G' && e.shiftKey && !e.ctrlKey) {
        e.preventDefault()
        toggleSetting('showGrid')
      } else if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey) {
        e.preventDefault()
        toggleSetting('showNpcs')
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
  }, [handleFloorChange, handleSave, editorSettings, toggleSetting, selectedTilePos, contextMenu, showGoToDialog, showFindItem, showReplaceItems, placingHouseExit, borderizeCurrentSelection, mutatorRef, randomizeCurrentSelection, rendererRef, setContextMenu, setPlacingHouseExit, setSelectedTilePos, setShowFindItem, setShowGoToDialog, setShowReplaceItems, toolsRef])

  return { borderizeCurrentSelection, randomizeCurrentSelection }
}
