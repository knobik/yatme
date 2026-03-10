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
import { nextDirection } from '../lib/creatures/types'
import { useLatestRef } from './useLatestRef'

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
  setEditingItem: (item: { x: number; y: number; z: number; index: number } | null) => void
  setEditingCreature: (creature: { x: number; y: number; z: number; creatureName: string; isNpc: boolean } | null) => void
  setEditingSpawn: (spawn: { x: number; y: number; z: number; spawnType: 'monster' | 'npc' } | null) => void
}

export function useContextMenu(options: UseContextMenuOptions) {
  // Keep a ref to the full options object to avoid stale closures — setContextMenu is
  // captured once in useEditorInit's mount effect, so buildContextMenuGroups must read
  // current values via this ref rather than the initial closure.
  const optionsRef = useLatestRef(options)

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [contextMenuGroups, setContextMenuGroups] = useState<ContextMenuGroup[]>([])

  function buildContextMenuGroups(menu: ContextMenuState): ContextMenuGroup[] {
    const { tilePos, tile } = menu
    const opts = optionsRef.current
    const renderer = opts.rendererRef.current
    const currentTools = opts.toolsRef.current
    const mutator = opts.mutatorReady
    const registry = opts.brushRegistryState
    const items = opts.itemRegistry
    const appearances = opts.appearancesData

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
                  opts.setSelectedTilePos({ x: tilePos.x, y: tilePos.y, z: tilePos.z })
                },
              },
              ...(tile.items && tile.items.length > 0
                ? [{
                    label: 'Properties',
                    onClick: () => {
                      opts.setEditingItem({ x: tilePos.x, y: tilePos.y, z: tilePos.z, index: tile.items!.length - 1 })
                    },
                  }]
                : []),
            ]
          : []),
      ],
    }

    // Creature/spawn properties group
    const creaturePropsItems: ContextMenuAction[] = []
    if (tile) {
      if (tile.spawnMonster) {
        creaturePropsItems.push({
          label: 'Monster Spawn Properties',
          onClick: () => opts.setEditingSpawn({ x: tilePos.x, y: tilePos.y, z: tilePos.z, spawnType: 'monster' }),
        })
        creaturePropsItems.push({
          label: 'Delete Monster Spawn',
          onClick: () => mutator?.removeSpawnZone(tilePos.x, tilePos.y, tilePos.z, 'monster'),
        })
      }
      if (tile.spawnNpc) {
        creaturePropsItems.push({
          label: 'NPC Spawn Properties',
          onClick: () => opts.setEditingSpawn({ x: tilePos.x, y: tilePos.y, z: tilePos.z, spawnType: 'npc' }),
        })
        creaturePropsItems.push({
          label: 'Delete NPC Spawn',
          onClick: () => mutator?.removeSpawnZone(tilePos.x, tilePos.y, tilePos.z, 'npc'),
        })
      }
      if (tile.monsters && tile.monsters.length > 0) {
        const topMonster = tile.monsters[tile.monsters.length - 1]
        creaturePropsItems.push({
          label: `Monster Properties (${topMonster.name})`,
          onClick: () => opts.setEditingCreature({ x: tilePos.x, y: tilePos.y, z: tilePos.z, creatureName: topMonster.name, isNpc: false }),
        })
        creaturePropsItems.push({
          label: `Rotate Monster (${topMonster.name})`,
          onClick: () => mutator?.updateCreatureProperties(tilePos.x, tilePos.y, tilePos.z, topMonster.name, false, { direction: nextDirection(topMonster.direction) }),
        })
        creaturePropsItems.push({
          label: `Delete Monster (${topMonster.name})`,
          onClick: () => mutator?.removeCreature(tilePos.x, tilePos.y, tilePos.z, topMonster.name, false),
        })
      }
      if (tile.npc) {
        creaturePropsItems.push({
          label: `NPC Properties (${tile.npc.name})`,
          onClick: () => opts.setEditingCreature({ x: tilePos.x, y: tilePos.y, z: tilePos.z, creatureName: tile.npc!.name, isNpc: true }),
        })
        creaturePropsItems.push({
          label: `Rotate NPC (${tile.npc.name})`,
          onClick: () => mutator?.updateCreatureProperties(tilePos.x, tilePos.y, tilePos.z, tile.npc!.name, true, { direction: nextDirection(tile.npc!.direction) }),
        })
        creaturePropsItems.push({
          label: `Delete NPC (${tile.npc.name})`,
          onClick: () => mutator?.removeCreature(tilePos.x, tilePos.y, tilePos.z, tile.npc!.name, true),
        })
      }
    }
    const creaturePropsGroup: ContextMenuGroup = { items: creaturePropsItems }

    const topItem = tile?.items?.[tile.items.length - 1]
    const itemInfoGroup: ContextMenuGroup = {
      items: topItem && items && appearances
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
                  getItemDisplayName(topItem.id, items!, appearances!),
                )
              },
            },
          ]
        : [],
    }

    const doorGroup: ContextMenuGroup = {
      items: topItem && registry?.isDoorItem(topItem.id)
        ? [{
            label: registry.getDoorInfo(topItem.id)?.open ? 'Close Door' : 'Open Door',
            onClick: () => {
              if (!mutator || !registry || !tile) return
              const idx = tile.items.length - 1
              mutator.switchDoorItem(tilePos.x, tilePos.y, tilePos.z, idx)
            },
          }]
        : [],
    }

    const rotateGroup: ContextMenuGroup = {
      items: topItem && items?.get(topItem.id)?.rotateTo
        ? [{
            label: 'Rotate Item',
            shortcut: 'Ctrl+R',
            onClick: () => {
              if (!mutator || !tile) return
              mutator.rotateItem(tilePos.x, tilePos.y, tilePos.z, -1)
            },
          }]
        : [],
    }

    // Brush selection group — scan tile items for all applicable brush types
    const brushSelectItems: ContextMenuAction[] = []
    if (topItem) {
      brushSelectItems.push({
        label: 'Select RAW',
        onClick: () => opts.handleSelectAsRaw(topItem.id),
      })
    }

    if (tile?.items && registry) {
      // Ground brush — from the ground item (first item with bank flag)
      const groundItem = tile.items.find(i => {
        const app = appearances?.objects.get(i.id)
        return !!app?.flags?.bank
      })
      if (groundItem && registry.getBrushForItem(groundItem.id)) {
        brushSelectItems.push({
          label: 'Select Ground Brush',
          onClick: () => opts.handleSelectAsBrush(groundItem.id),
        })
      }

      // Wall brush — any non-door item on tile that belongs to a wall brush
      const wallItem = tile.items.find(i => !registry.isDoorItem(i.id) && registry.getWallBrushForItem(i.id))
      if (wallItem) {
        brushSelectItems.push({
          label: 'Select Wall Brush',
          onClick: () => opts.handleSelectAsBrush(wallItem.id),
        })
      }

      // Carpet brush — any item on tile that belongs to a carpet brush
      const carpetItem = tile.items.find(i => registry.getCarpetBrushForItem(i.id))
      if (carpetItem) {
        brushSelectItems.push({
          label: 'Select Carpet Brush',
          onClick: () => opts.handleSelectAsBrush(carpetItem.id),
        })
      }

      // Table brush — any item on tile that belongs to a table brush
      const tableItem = tile.items.find(i => registry.getTableBrushForItem(i.id))
      if (tableItem) {
        brushSelectItems.push({
          label: 'Select Table Brush',
          onClick: () => opts.handleSelectAsBrush(tableItem.id),
        })
      }

      // Doodad brush — from the top item specifically (like RME)
      if (topItem && registry.getDoodadBrushForItem(topItem.id)) {
        brushSelectItems.push({
          label: 'Select Doodad Brush',
          onClick: () => opts.handleSelectAsBrush(topItem.id),
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
              onClick: () => opts.handleSelectAsBrush(topItem.id),
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
                renderer!.pingTile(dest.x, dest.y, dest.z)
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

    return [clipboardGroup, positionGroup, creaturePropsGroup, itemInfoGroup, brushSelectGroup, doorGroup, rotateGroup, teleportGroup]
  }

  const handleSetContextMenu = (menu: ContextMenuState | null) => {
    setContextMenu(menu)
    if (menu) {
      setContextMenuGroups(buildContextMenuGroups(menu))
    } else {
      setContextMenuGroups([])
    }
  }

  return { contextMenuGroups, contextMenu, setContextMenu: handleSetContextMenu }
}
