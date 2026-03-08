import { useState } from 'react'
import type { ContextMenuGroup, ContextMenuAction } from '../components/ContextMenu'
import type { OtbmTile } from '../lib/otbm'
import type { AppearanceData } from '../lib/appearances'
import type { ItemRegistry } from '../lib/items'
import { getItemDisplayName } from '../lib/items'
import type { BrushRegistry } from '../lib/brushes/BrushRegistry'
import type { MapMutator } from '../lib/MapMutator'
import type { MapRenderer } from '../lib/MapRenderer'
import type { EditorToolsState } from './useEditorTools'

export interface ContextMenuState {
  x: number
  y: number
  tilePos: { x: number; y: number; z: number }
  tile: OtbmTile | null
}

export interface UseContextMenuOptions {
  toolsRef: React.RefObject<EditorToolsState>
  mutatorReady: MapMutator | null
  brushRegistryState: BrushRegistry | null
  itemRegistry: ItemRegistry | null
  appearancesData: AppearanceData | null
  rendererRef: React.RefObject<MapRenderer | null>
  handleSelectAsRaw: (itemId: number) => void
  handleSelectAsBrush: (itemId: number) => void
  setSelectedTilePos: (pos: { x: number; y: number; z: number }) => void
  setEditItemIndex: (index: number | null) => void
}

export function useContextMenu(options: UseContextMenuOptions) {
  const {
    toolsRef,
    mutatorReady,
    brushRegistryState,
    itemRegistry,
    appearancesData,
    rendererRef,
    handleSelectAsRaw,
    handleSelectAsBrush,
    setSelectedTilePos,
    setEditItemIndex,
  } = options

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  function buildContextMenuGroups(): ContextMenuGroup[] {
    if (!contextMenu) return []
    const { tilePos, tile } = contextMenu
    const renderer = rendererRef.current
    const currentTools = toolsRef.current

    const isInSelection = currentTools.selectedItems.some(
      i => i.x === tilePos.x && i.y === tilePos.y && i.z === tilePos.z
    )

    const clipboardGroup: ContextMenuGroup = {
      items: [
        {
          label: 'Copy',
          shortcut: 'Ctrl+C',
          disabled: !tile,
          onClick: () => {
            if (!isInSelection) currentTools.selectTiles([tilePos])
            currentTools.copy()
          },
        },
        {
          label: 'Cut',
          shortcut: 'Ctrl+X',
          disabled: !tile,
          onClick: () => {
            if (!isInSelection) currentTools.selectTiles([tilePos])
            currentTools.cut()
          },
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          disabled: !currentTools.canPaste,
          onClick: () => {
            currentTools.selectTiles([tilePos])
            currentTools.paste()
          },
        },
        {
          label: 'Delete',
          shortcut: 'Del',
          disabled: !tile,
          onClick: () => {
            if (!isInSelection) currentTools.selectTiles([tilePos])
            currentTools.deleteSelection()
          },
        },
      ],
    }

    const positionGroup: ContextMenuGroup = {
      items: [
        {
          label: 'Copy Position',
          onClick: () => {
            navigator.clipboard.writeText(`{x=${tilePos.x}, y=${tilePos.y}, z=${tilePos.z}}`)
          },
        },
        ...(tile
          ? [
              {
                label: 'Browse Tile',
                onClick: () => {
                  setSelectedTilePos({ x: tilePos.x, y: tilePos.y, z: tilePos.z })
                },
              },
              ...(tile.items && tile.items.length > 0
                ? [{
                    label: 'Properties',
                    onClick: () => {
                      setSelectedTilePos({ x: tilePos.x, y: tilePos.y, z: tilePos.z })
                      setEditItemIndex(tile.items!.length - 1)
                    },
                  }]
                : []),
            ]
          : []),
      ],
    }

    const topItem = tile?.items?.[tile.items.length - 1]
    const itemInfoGroup: ContextMenuGroup = {
      items: topItem && itemRegistry && appearancesData
        ? [
            {
              label: 'Copy Top Item ID',
              onClick: () => {
                navigator.clipboard.writeText(String(topItem.id))
              },
            },
            {
              label: 'Copy Top Item Name',
              onClick: () => {
                navigator.clipboard.writeText(
                  getItemDisplayName(topItem.id, itemRegistry!, appearancesData!),
                )
              },
            },
          ]
        : [],
    }

    const doorGroup: ContextMenuGroup = {
      items: topItem && brushRegistryState?.isDoorItem(topItem.id)
        ? [{
            label: brushRegistryState.getDoorInfo(topItem.id)?.open ? 'Close Door' : 'Open Door',
            onClick: () => {
              if (!mutatorReady || !brushRegistryState || !tile) return
              const idx = tile.items.length - 1
              mutatorReady.switchDoorItem(tilePos.x, tilePos.y, tilePos.z, idx)
            },
          }]
        : [],
    }

    const rotateGroup: ContextMenuGroup = {
      items: topItem && itemRegistry?.get(topItem.id)?.rotateTo
        ? [{
            label: 'Rotate Item',
            shortcut: 'Ctrl+R',
            onClick: () => {
              if (!mutatorReady || !tile) return
              mutatorReady.rotateItem(tilePos.x, tilePos.y, tilePos.z, -1)
            },
          }]
        : [],
    }

    // Brush selection group — scan tile items for all applicable brush types
    const brushSelectItems: ContextMenuAction[] = []
    if (topItem) {
      brushSelectItems.push({
        label: 'Select RAW',
        onClick: () => handleSelectAsRaw(topItem.id),
      })
    }

    if (tile?.items && brushRegistryState) {
      const registry = brushRegistryState

      // Ground brush — from the ground item (first item with bank flag)
      const groundItem = tile.items.find(i => {
        const app = appearancesData?.objects.get(i.id)
        return !!app?.flags?.bank
      })
      if (groundItem && registry.getBrushForItem(groundItem.id)) {
        brushSelectItems.push({
          label: 'Select Ground Brush',
          onClick: () => handleSelectAsBrush(groundItem.id),
        })
      }

      // Wall brush — any non-door item on tile that belongs to a wall brush
      const wallItem = tile.items.find(i => !registry.isDoorItem(i.id) && registry.getWallBrushForItem(i.id))
      if (wallItem) {
        brushSelectItems.push({
          label: 'Select Wall Brush',
          onClick: () => handleSelectAsBrush(wallItem.id),
        })
      }

      // Carpet brush — any item on tile that belongs to a carpet brush
      const carpetItem = tile.items.find(i => registry.getCarpetBrushForItem(i.id))
      if (carpetItem) {
        brushSelectItems.push({
          label: 'Select Carpet Brush',
          onClick: () => handleSelectAsBrush(carpetItem.id),
        })
      }

      // Table brush — any item on tile that belongs to a table brush
      const tableItem = tile.items.find(i => registry.getTableBrushForItem(i.id))
      if (tableItem) {
        brushSelectItems.push({
          label: 'Select Table Brush',
          onClick: () => handleSelectAsBrush(tableItem.id),
        })
      }

      // Doodad brush — from the top item specifically (like RME)
      if (topItem && registry.getDoodadBrushForItem(topItem.id)) {
        brushSelectItems.push({
          label: 'Select Doodad Brush',
          onClick: () => handleSelectAsBrush(topItem.id),
        })
      }

      // TODO: Add "Select House", "Select Monster", "Select Monster Spawn",
      // "Select NPC", and "Select NPC Spawn" once those systems are implemented.

      // Door brush — from the top item specifically (like RME)
      if (topItem && registry.isDoorItem(topItem.id)) {
        const doorInfo = registry.getDoorInfo(topItem.id)
        if (doorInfo) {
          // Find the wall brush that owns this door
          const wallBrush = registry.getWallBrushForItem(topItem.id)
          if (wallBrush) {
            brushSelectItems.push({
              label: 'Select Door Brush',
              onClick: () => handleSelectAsBrush(topItem.id),
            })
          }
        }
      }
    }
    const brushSelectGroup: ContextMenuGroup = { items: brushSelectItems }

    const teleportItem = tile?.items?.find(i => i.teleportDestination)
    const dest = teleportItem?.teleportDestination
    const teleportGroup: ContextMenuGroup = {
      items: dest && renderer
        ? [
            {
              label: 'Go to Destination',
              onClick: () => {
                renderer!.setFloor(dest.z)
                renderer!.centerOn(dest.x, dest.y)
              },
            },
            {
              label: 'Copy Destination',
              onClick: () => {
                navigator.clipboard.writeText(`{x=${dest.x}, y=${dest.y}, z=${dest.z}}`)
              },
            },
          ]
        : [],
    }

    return [clipboardGroup, positionGroup, itemInfoGroup, brushSelectGroup, doorGroup, rotateGroup, teleportGroup]
  }

  return { contextMenuGroups: buildContextMenuGroups(), contextMenu, setContextMenu }
}
