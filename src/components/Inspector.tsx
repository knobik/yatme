import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import type { OtbmMap, OtbmItem } from '../lib/otbm'
import { deepCloneItem } from '../lib/otbm'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import type { MapMutator } from '../lib/MapMutator'
import { classifyItem } from '../lib/MapMutator'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'
import { XIcon, DotsSixVerticalIcon, CrosshairIcon, FadersIcon, TrashIcon } from '@phosphor-icons/react'
import { MIME_TIBIA_ITEM, MIME_TIBIA_INSPECTOR } from '../lib/dragUtils'
import type { SelectedItemInfo } from '../hooks/useSelection'
import { zoneColorCSS } from '../lib/zoneColors'

interface InspectorProps {
  tilePos: { x: number; y: number; z: number } | null
  mapData: OtbmMap
  tileVersion: number
  registry: ItemRegistry
  appearances: AppearanceData
  mutator: MapMutator
  onClose: () => void
  onSelectAsBrush: (itemId: number) => void
  selectedItems: SelectedItemInfo[]
  onItemSelectionChange: (items: SelectedItemInfo[]) => void
  offset?: boolean
  onEditItem?: (x: number, y: number, z: number, itemIndex: number) => void
  onDragToMap?: (itemId: number) => void
  onDragToMapEnd?: () => void
  houseName?: string | null
}

export function Inspector({
  tilePos,
  mapData,
  tileVersion,
  registry,
  appearances,
  mutator,
  onClose,
  onSelectAsBrush,
  selectedItems,
  onItemSelectionChange,
  offset,
  onEditItem,
  onDragToMap,
  onDragToMapEnd,
  houseName,
}: InspectorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragOverHalf, setDragOverHalf] = useState<'top' | 'bottom'>('bottom')
  const hoveredIndexRef = useRef<number | null>(null)
  const deleteRef = useRef<((index: number) => void) | null>(null)
  const anchorRef = useRef<number | null>(null)

  // Reset selection anchor when tile changes (ref write must happen in effect)
  useEffect(() => {
    if (tilePos) {
      const tile = mapData.tiles.get(`${tilePos.x},${tilePos.y},${tilePos.z}`)
      anchorRef.current = tile && tile.items.length > 0 ? tile.items.length - 1 : null
    } else {
      anchorRef.current = null
    }
  }, [tilePos, mapData])

  // Derive selected indices for this tile from selectedItems prop
  const selectedItemIndices = useMemo(() => {
    const s = new Set<number>()
    if (tilePos) {
      for (const it of selectedItems) {
        if (it.x === tilePos.x && it.y === tilePos.y && it.z === tilePos.z) {
          s.add(it.itemIndex)
        }
      }
    }
    return s
  }, [selectedItems, tilePos])

  // Handle item click with ctrl/shift/plain selection logic
  const handleItemClick = useCallback((index: number, e: React.MouseEvent) => {
    if (!tilePos) return
    const { x, y, z } = tilePos

    if (e.ctrlKey || e.metaKey) {
      // Toggle item in/out of selection
      const existing = selectedItems.filter(
        it => it.x === x && it.y === y && it.z === z
      )
      const alreadySelected = existing.some(it => it.itemIndex === index)
      const otherOnTile = alreadySelected
        ? existing.filter(it => it.itemIndex !== index)
        : [...existing, { x, y, z, itemIndex: index }]
      const otherTiles = selectedItems.filter(
        it => !(it.x === x && it.y === y && it.z === z)
      )
      const newItems = [...otherTiles, ...otherOnTile]
      onItemSelectionChange(newItems)
      anchorRef.current = alreadySelected ? null : index
    } else if (e.shiftKey && anchorRef.current !== null) {
      // Range select from anchor to clicked index
      const from = Math.min(anchorRef.current, index)
      const to = Math.max(anchorRef.current, index)
      const rangeItems: SelectedItemInfo[] = []
      for (let i = from; i <= to; i++) {
        rangeItems.push({ x, y, z, itemIndex: i })
      }
      onItemSelectionChange(rangeItems)
    } else {
      // Plain click — select single item
      onItemSelectionChange([{ x, y, z, itemIndex: index }])
      anchorRef.current = index
    }
  }, [tilePos, selectedItems, onItemSelectionChange])

  const handleDelete = useCallback((index: number) => {
    if (!tilePos) return
    mutator.removeItem(tilePos.x, tilePos.y, tilePos.z, index)
  }, [tilePos, mutator])

  useEffect(() => {
    deleteRef.current = handleDelete
  })

  // Delete hovered item on Delete key (capture phase — runs before App handler)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' && hoveredIndexRef.current !== null && deleteRef.current) {
        e.preventDefault()
        e.stopImmediatePropagation()
        deleteRef.current(hoveredIndexRef.current)
        hoveredIndexRef.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  if (!tilePos) return null

  const tile = mapData.tiles.get(`${tilePos.x},${tilePos.y},${tilePos.z}`)

  // Count ground items to enforce ordering constraints
  const groundCount = tile
    ? tile.items.filter(it => classifyItem(it.id, appearances) === 'ground').length
    : 0

  const handleDragStart = (index: number, e: React.DragEvent) => {
    if (!tile) return
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'copyMove'

    // Set item ID for palette-compatible drops
    const item = tile.items[index]
    if (item) {
      e.dataTransfer.setData(MIME_TIBIA_ITEM, String(item.id))
      e.dataTransfer.setData(MIME_TIBIA_INSPECTOR, JSON.stringify({
        x: tilePos.x, y: tilePos.y, z: tilePos.z, index,
      }))
      onDragToMap?.(item.id)
    }

    // Hide the native drag image — the map canvas shows a PixiJS ghost preview instead
    const ghost = document.createElement('canvas')
    ghost.width = 1
    ghost.height = 1
    e.dataTransfer.setDragImage(ghost, 0, 0)
  }

  const handleDragEnd = () => {
    clearDrag()
    onDragToMapEnd?.()
  }

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverHalf(e.clientY < midY ? 'top' : 'bottom')
    setDragOverIndex(index)
  }

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || !tile) return
    if (dragIndex === targetIndex) {
      clearDrag()
      return
    }

    // Ground items cannot be reordered within the inspector
    const draggedIsGround = classifyItem(tile.items[dragIndex].id, appearances) === 'ground'
    if (draggedIsGround) {
      clearDrag()
      return
    }

    let insertAt = dragOverHalf === 'top' ? targetIndex : targetIndex + 1
    if (dragIndex < insertAt) insertAt--
    insertAt = Math.max(insertAt, groundCount)

    if (insertAt === dragIndex) {
      clearDrag()
      return
    }

    const items = tile.items.map(deepCloneItem)
    const [dragged] = items.splice(dragIndex, 1)
    items.splice(insertAt, 0, dragged)
    mutator.setTileItems(tilePos.x, tilePos.y, tilePos.z, items)

    clearDrag()
  }

  const clearDrag = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className={clsx(
      'panel absolute top-4 bottom-4 z-10 flex w-[400px] flex-col pointer-events-auto transition-[left] duration-[180ms] ease-out',
      offset ? 'left-[calc(8px+320px+6px)]' : 'left-4',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <span className="label text-lg tracking-wide">
          BROWSE TILE
        </span>
        <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close (Esc)">
          <XIcon size={14} weight="bold" />
        </button>
      </div>

      <div className="h-px w-full bg-border-subtle" />

      {/* Position */}
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="label text-base">POSITION</span>
          <span className="value text-md">{tilePos.x}, {tilePos.y}, {tilePos.z}</span>
        </div>
        {tile && tile.flags !== 0 && (
          <div className="flex flex-col gap-2">
            <span className="label text-base">FLAGS</span>
            <div className="flex flex-wrap gap-2">
              {TILE_FLAGS.filter(f => (tile.flags & f.bit) !== 0).map(({ bit, label }) => (
                <span key={bit} className="rounded-sm bg-accent-subtle px-3 py-[2px] font-display text-xs font-semibold tracking-wide uppercase text-accent-fg">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        {tile && tile.zones && tile.zones.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="label text-base">ZONES</span>
            <div className="flex flex-wrap gap-2">
              {tile.zones.map(zoneId => (
                <span
                  key={zoneId}
                  className="rounded-sm px-3 py-[2px] font-display text-xs font-semibold tracking-wide uppercase text-fg"
                  style={{ backgroundColor: zoneColorCSS(zoneId, 30) }}
                >
                  Zone {zoneId}
                </span>
              ))}
            </div>
          </div>
        )}
        {tile?.houseId != null && (
          <div className="flex items-baseline gap-4">
            <span className="label text-base">HOUSE</span>
            <span className="value text-md">
              {houseName ? `${houseName} (#${tile.houseId})` : `#${tile.houseId}`}
            </span>
          </div>
        )}
      </div>

      <div className="h-px w-full bg-border-subtle" />

      {/* Items */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!tile || tile.items.length === 0 ? (
          <div className="p-6 font-mono text-base text-fg-faint">
            No items
          </div>
        ) : (
          tile.items.map((item, i) => {
            const isGround = classifyItem(item.id, appearances) === 'ground'
            const isDragging = dragIndex === i
            const isDragOver = dragOverIndex === i && dragIndex !== null && dragIndex !== i
            return (
              <div key={`${tileVersion}-${i}`}>
                <ItemRow
                  item={item}
                  index={i}
                  isGround={isGround}
                  isSelected={selectedItemIndices?.has(i) ?? false}
                  isDragging={isDragging}
                  isDragOver={isDragOver}
                  dragOverHalf={dragOverHalf}
                  registry={registry}
                  appearances={appearances}
                  depth={0}
                  onClick={(e) => handleItemClick(i, e)}
                  onDelete={() => handleDelete(i)}
                  onSelectAsBrush={() => onSelectAsBrush(item.id)}
                  onEditToggle={() => onEditItem?.(tilePos.x, tilePos.y, tilePos.z, i)}
                  onDragStart={(e) => handleDragStart(i, e)}
                  onDragOver={(e) => handleDragOver(i, e)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  onHoverChange={(hovered) => { hoveredIndexRef.current = hovered ? i : null }}
                />
                {/* Container children — read-only */}
                {item.items && item.items.length > 0 && (
                  item.items.map((child, ci) => (
                    <ItemRow
                      key={`child-${ci}`}
                      item={child}
                      index={ci}
                      isGround={false}
                      isDragging={false}
                      isDragOver={false}
                      dragOverHalf="bottom"
                      registry={registry}
                      appearances={appearances}
                      depth={1}
                    />
                  ))
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Icons (16x16) ─────────────────────────────────────────────────

function GripIcon() {
  return <DotsSixVerticalIcon size={16} weight="bold" />
}

function SelectAsBrushIcon() {
  return <CrosshairIcon size={16} weight="bold" />
}

function SlidersIcon() {
  return <FadersIcon size={16} weight="bold" />
}

function DeleteIcon() {
  return <TrashIcon size={16} weight="bold" />
}

// ── ItemRow ────────────────────────────────────────────────────────

function ItemRow({
  item,
  isGround,
  isSelected,
  isDragging,
  isDragOver,
  dragOverHalf,
  registry,
  appearances,
  depth,
  onClick,
  onDelete,
  onSelectAsBrush,
  onEditToggle,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onHoverChange,
}: {
  item: OtbmItem
  index: number
  isGround: boolean
  isSelected?: boolean
  isDragging: boolean
  isDragOver: boolean
  dragOverHalf: 'top' | 'bottom'
  registry: ItemRegistry
  appearances: AppearanceData
  depth: number
  onClick?: (e: React.MouseEvent) => void
  onDelete?: () => void
  onSelectAsBrush?: () => void
  onEditToggle?: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: () => void
  onDragEnd?: () => void
  onHoverChange?: (hovered: boolean) => void
}) {
  const name = getItemDisplayName(item.id, registry, appearances)
  const attrs = getItemAttributes(item, registry)
  const isTopLevel = depth === 0
  const hasActions = isTopLevel && !isGround && onDelete
  const canDrag = isTopLevel && onDragStart

  return (
    <div
      className={clsx(
        'group flex items-center gap-4 border-b border-border-subtle px-5 py-4 transition-[background,opacity] duration-100 ease-out last:border-b-0 hover:bg-panel-hover',
        isSelected && 'bg-accent-subtle',
        isDragging && 'opacity-35',
        isDragOver && dragOverHalf === 'top' && 'shadow-drag-top',
        isDragOver && dragOverHalf === 'bottom' && 'shadow-drag-bottom',
      )}
      style={{ paddingLeft: `calc(10px + ${depth * 16}px)`, cursor: onClick ? 'pointer' : undefined }}
      draggable={!!canDrag}
      onClick={onClick}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragOver={onDragOver}
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
      onDrop={onDrop ? (e) => { e.preventDefault(); onDrop() } : undefined}
      onDragEnd={onDragEnd}
      onDoubleClick={isTopLevel && onEditToggle ? onEditToggle : undefined}
    >
      {/* Drag handle — only for draggable items */}
      {canDrag ? (
        <div className="flex w-[14px] shrink-0 cursor-grab items-center justify-center text-fg-faint opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-60 active:cursor-grabbing">
          <GripIcon />
        </div>
      ) : isTopLevel ? (
        <div className="w-[14px] shrink-0" />
      ) : null}

      <ItemSprite itemId={item.id} appearances={appearances} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-ui text-md font-medium text-fg">{name}</div>
        <div className="font-mono text-sm leading-normal text-fg-faint">ID: {item.id}</div>
        {attrs.map((attr, i) => (
          <div key={i} className="font-mono text-sm leading-normal text-fg-faint">{attr}</div>
        ))}
      </div>
      {isTopLevel && isGround && (
        <>
          <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100">
            <button className="item-action-btn brush" onClick={onSelectAsBrush} title="Select as brush">
              <SelectAsBrushIcon />
            </button>
            <button className="item-action-btn" onClick={onEditToggle} title="Edit properties">
              <SlidersIcon />
            </button>
          </div>
          <span className="shrink-0 rounded-sm bg-accent-subtle px-3 py-[2px] font-display text-xs font-semibold tracking-wide uppercase text-accent-fg">GROUND</span>
        </>
      )}
      {hasActions && (
        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100">
          <button className="item-action-btn brush" onClick={onSelectAsBrush} title="Select as brush">
            <SelectAsBrushIcon />
          </button>
          <button className="item-action-btn" onClick={onEditToggle} title="Edit properties">
            <SlidersIcon />
          </button>
          <button className="item-action-btn danger" onClick={onDelete} title="Delete item">
            <DeleteIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tile Flags ────────────────────────────────────────────────────

const TILE_FLAGS = [
  { bit: 0x0001, label: 'PZ' },
  { bit: 0x0004, label: 'NO PVP' },
  { bit: 0x0008, label: 'NO LOGOUT' },
  { bit: 0x0010, label: 'PVP ZONE' },
  { bit: 0x0020, label: 'REFRESH' },
] as const

// ── Helpers ────────────────────────────────────────────────────────

function getItemAttributes(item: OtbmItem, registry: ItemRegistry): string[] {
  const attrs: string[] = []
  if (item.actionId != null) attrs.push(`AID: ${item.actionId}`)
  if (item.uniqueId != null) attrs.push(`UID: ${item.uniqueId}`)
  if (item.count != null && item.count > 1) {
    const itemInfo = registry.get(item.id)
    const defaultCharges = itemInfo?.charges
    const isCharged = defaultCharges != null && defaultCharges > 0
    const label = isCharged ? 'Charges' : 'Count'
    attrs.push(`${label}: ${item.count}`)
  }
  if (item.text) attrs.push(`Text: "${item.text}"`)
  if (item.description) attrs.push(`Desc: "${item.description}"`)
  if (item.teleportDestination) {
    const d = item.teleportDestination
    attrs.push(`Dest: ${d.x}, ${d.y}, ${d.z}`)
  }
  if (item.depotId != null) attrs.push(`Depot: ${item.depotId}`)
  if (item.houseDoorId != null) attrs.push(`Door: ${item.houseDoorId}`)
  if (item.duration != null) attrs.push(`Duration: ${item.duration}`)
  return attrs
}
