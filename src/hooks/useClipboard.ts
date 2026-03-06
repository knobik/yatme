import { useState, useCallback, useRef } from 'react'
import type { MapRenderer } from '../lib/MapRenderer'
import type { MapMutator } from '../lib/MapMutator'
import type { OtbmMap } from '../lib/otbm'
import type { SelectedItemInfo } from './useSelection'
import { selectAllItemsOnTiles } from './useSelection'
import { CopyBuffer, removeSelectedItems } from '../lib/CopyBuffer'
import { getCopyBufferFootprint } from './tools/types'
import type { EditorSettings } from '../lib/EditorSettings'

export function useClipboard(
  renderer: MapRenderer | null,
  mutator: MapMutator | null,
  mapData: OtbmMap | null,
  selectedItemsRef: React.MutableRefObject<SelectedItemInfo[]>,
  setSelectedItems: (items: SelectedItemInfo[]) => void,
  applyHighlights: (items: SelectedItemInfo[]) => void,
  hoverPosRef: React.MutableRefObject<{ x: number; y: number; z: number } | null>,
  settingsRef: React.MutableRefObject<EditorSettings>,
) {
  const [canPaste, setCanPaste] = useState(false)
  const [isPasting, setIsPasting] = useState(false)
  const isPastingRef = useRef(false)
  const copyBufferRef = useRef(new CopyBuffer())

  const cancelPaste = useCallback(() => {
    isPastingRef.current = false
    setIsPasting(false)
    renderer?.clearDragPreview()
    renderer?.updateBrushCursor([])
  }, [renderer])

  const executePasteAt = useCallback((targetX: number, targetY: number, targetZ: number) => {
    const buffer = copyBufferRef.current
    if (!buffer.canPaste() || !mutator || !renderer || !mapData) return

    const settings = settingsRef.current
    const pastedPositions = buffer.paste(
      targetX, targetY, targetZ,
      mutator, renderer,
      settings.mergePaste, settings.autoMagic,
    )

    const pastedItems = selectAllItemsOnTiles(pastedPositions, mapData)
    setSelectedItems(pastedItems)
    selectedItemsRef.current = pastedItems
    applyHighlights(pastedItems)
  }, [mutator, renderer, mapData, selectedItemsRef, setSelectedItems, applyHighlights, settingsRef])

  const copy = useCallback(() => {
    if (!mapData) return
    const items = selectedItemsRef.current
    if (items.length === 0) return

    copyBufferRef.current.copy(items, mapData)
    setCanPaste(copyBufferRef.current.canPaste())
  }, [mapData, selectedItemsRef])

  const paste = useCallback(() => {
    const buffer = copyBufferRef.current
    if (!buffer.canPaste() || !renderer) return
    if (isPastingRef.current) {
      cancelPaste()
      return
    }
    isPastingRef.current = true
    setIsPasting(true)
    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
    const hover = hoverPosRef.current
    if (hover) {
      renderer.updatePastePreview(buffer, hover.x, hover.y, renderer.floor)
      renderer.updateBrushCursor(getCopyBufferFootprint(buffer, hover.x, hover.y, renderer.floor))
    }
  }, [renderer, cancelPaste, selectedItemsRef, setSelectedItems, hoverPosRef])

  const deleteSelection = useCallback(() => {
    const items = selectedItemsRef.current
    if (!mutator || !renderer || !mapData) return
    if (items.length === 0) return

    mutator.beginBatch('Delete selection')
    removeSelectedItems(items, mapData, mutator)
    mutator.commitBatch()

    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
  }, [mutator, renderer, mapData, selectedItemsRef, setSelectedItems])

  const cut = useCallback(() => {
    if (!mutator || !renderer || !mapData) return
    const items = selectedItemsRef.current
    if (items.length === 0) return

    const settings = settingsRef.current
    copyBufferRef.current.cut(items, mapData, mutator, settings.autoMagic)
    setCanPaste(copyBufferRef.current.canPaste())

    setSelectedItems([])
    selectedItemsRef.current = []
    renderer.clearItemHighlight()
  }, [mutator, renderer, mapData, selectedItemsRef, setSelectedItems, settingsRef])

  return {
    canPaste,
    isPasting,
    isPastingRef,
    copyBufferRef,
    copy,
    cut,
    paste,
    deleteSelection,
    cancelPaste,
    executePasteAt,
  }
}
