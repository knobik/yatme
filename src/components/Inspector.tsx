import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { OtbmMap, OtbmItem } from '../lib/otbm'
import { deepCloneItem } from '../lib/otbm'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import type { MapMutator } from '../lib/MapMutator'
import { classifyItem } from '../lib/MapMutator'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'

interface InspectorProps {
  tilePos: { x: number; y: number; z: number } | null
  mapData: OtbmMap
  tileVersion: number
  registry: ItemRegistry
  appearances: AppearanceData
  mutator: MapMutator
  onClose: () => void
  onSelectAsBrush: (itemId: number) => void
  onSelectItem?: (index: number, e: React.MouseEvent) => void
  selectedItemIndices?: Set<number>
  offset?: boolean
  initialEditIndex?: number | null
  onEditIndexConsumed?: () => void
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
  onSelectItem,
  selectedItemIndices,
  offset,
  initialEditIndex,
  onEditIndexConsumed,
}: InspectorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragOverHalf, setDragOverHalf] = useState<'top' | 'bottom'>('bottom')
  const hoveredIndexRef = useRef<number | null>(null)
  const deleteRef = useRef<((index: number) => void) | null>(null)

  // Reset editing when tile changes
  useEffect(() => {
    setEditingIndex(null)
  }, [tilePos?.x, tilePos?.y, tilePos?.z])

  // Open property editor on double-click request from outside
  useEffect(() => {
    if (initialEditIndex != null && initialEditIndex >= 0) {
      setEditingIndex(initialEditIndex)
      onEditIndexConsumed?.()
    }
  }, [initialEditIndex, onEditIndexConsumed])

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
  })

  if (!tilePos) return null

  const tile = mapData.tiles.get(`${tilePos.x},${tilePos.y},${tilePos.z}`)

  // Count ground items to enforce ordering constraints
  const groundCount = tile
    ? tile.items.filter(it => classifyItem(it.id, appearances) === 'ground').length
    : 0

  const handleDelete = (index: number) => {
    if (editingIndex === index) setEditingIndex(null)
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1)
    mutator.removeItem(tilePos.x, tilePos.y, tilePos.z, index)
  }
  deleteRef.current = handleDelete

  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    const ghost = document.createElement('canvas')
    ghost.width = 1
    ghost.height = 1
    e.dataTransfer.setDragImage(ghost, 0, 0)
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

    if (editingIndex === dragIndex) {
      setEditingIndex(insertAt)
    } else if (editingIndex !== null) {
      if (dragIndex < editingIndex && insertAt >= editingIndex) {
        setEditingIndex(editingIndex - 1)
      } else if (dragIndex > editingIndex && insertAt <= editingIndex) {
        setEditingIndex(editingIndex + 1)
      }
    }
    clearDrag()
  }

  const clearDrag = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleApplyProperties = (index: number, props: Partial<OtbmItem>) => {
    if (!tile) return
    const items = tile.items.map(deepCloneItem)
    const item = items[index]
    if (!item) return

    item.actionId = props.actionId ?? undefined
    item.uniqueId = props.uniqueId ?? undefined
    item.count = props.count ?? undefined
    item.charges = props.charges ?? undefined
    item.duration = props.duration ?? undefined
    item.depotId = props.depotId ?? undefined
    item.houseDoorId = props.houseDoorId ?? undefined
    item.text = props.text || undefined
    item.description = props.description || undefined

    if (props.teleportDestination) {
      item.teleportDestination = { ...props.teleportDestination }
    } else {
      item.teleportDestination = undefined
    }

    mutator.setTileItems(tilePos.x, tilePos.y, tilePos.z, items)
    setEditingIndex(null)
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
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
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
        {tile?.houseId != null && (
          <div className="flex items-baseline gap-4">
            <span className="label text-base">HOUSE</span>
            <span className="value text-md">{tile.houseId}</span>
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
                  onClick={(e) => onSelectItem?.(i, e)}
                  onDelete={() => handleDelete(i)}
                  onSelectAsBrush={() => onSelectAsBrush(item.id)}
                  onEditToggle={() => setEditingIndex(editingIndex === i ? null : i)}
                  onDragStart={(e) => handleDragStart(i, e)}
                  onDragOver={(e) => handleDragOver(i, e)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={clearDrag}
                  onHoverChange={(hovered) => { hoveredIndexRef.current = hovered ? i : null }}
                />
                {editingIndex === i && (
                  <PropertyEditor
                    key={`${tileVersion}-edit-${i}`}
                    item={item}
                    appearances={appearances}
                    onApply={(props) => handleApplyProperties(i, props)}
                    onCancel={() => setEditingIndex(null)}
                  />
                )}
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
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
      <circle cx="3" cy="3" r="1.4" fill="currentColor" />
      <circle cx="7" cy="3" r="1.4" fill="currentColor" />
      <circle cx="3" cy="8" r="1.4" fill="currentColor" />
      <circle cx="7" cy="8" r="1.4" fill="currentColor" />
      <circle cx="3" cy="13" r="1.4" fill="currentColor" />
      <circle cx="7" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <path d="M8 1.5V4M8 12V14.5M1.5 8H4M12 8H14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4H6M10 4H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 8H4M8 8H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 12H9M13 12H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 5H12.5M5 5V13H11V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 3H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 7.5V10.5M9 7.5V10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── ItemRow ────────────────────────────────────────────────────────

function ItemRow({
  item,
  index,
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
  const attrs = getItemAttributes(item)
  const isTopLevel = depth === 0
  const hasActions = isTopLevel && !isGround && onDelete
  const canDrag = isTopLevel && !isGround && onDragStart

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
              <CrosshairIcon />
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
            <CrosshairIcon />
          </button>
          <button className="item-action-btn" onClick={onEditToggle} title="Edit properties">
            <SlidersIcon />
          </button>
          <button className="item-action-btn danger" onClick={onDelete} title="Delete item">
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// ── PropertyEditor ─────────────────────────────────────────────────

function PropertyEditor({
  item,
  appearances,
  onApply,
  onCancel,
}: {
  item: OtbmItem
  appearances: AppearanceData
  onApply: (props: Partial<OtbmItem>) => void
  onCancel: () => void
}) {
  const [actionId, setActionId] = useState(item.actionId != null ? String(item.actionId) : '')
  const [uniqueId, setUniqueId] = useState(item.uniqueId != null ? String(item.uniqueId) : '')
  const [count, setCount] = useState(item.count != null ? String(item.count) : '')
  const [charges, setCharges] = useState(item.charges != null ? String(item.charges) : '')
  const [duration, setDuration] = useState(item.duration != null ? String(item.duration) : '')
  const [text, setText] = useState(item.text ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [depotId, setDepotId] = useState(item.depotId != null ? String(item.depotId) : '')
  const [doorId, setDoorId] = useState(item.houseDoorId != null ? String(item.houseDoorId) : '')
  const [destX, setDestX] = useState(item.teleportDestination != null ? String(item.teleportDestination.x) : '')
  const [destY, setDestY] = useState(item.teleportDestination != null ? String(item.teleportDestination.y) : '')
  const [destZ, setDestZ] = useState(item.teleportDestination != null ? String(item.teleportDestination.z) : '')

  const parseNum = (v: string): number | undefined => {
    if (v.trim() === '') return undefined
    const n = parseInt(v, 10)
    return isNaN(n) ? undefined : n
  }

  const handleApply = () => {
    const destXVal = parseNum(destX)
    const destYVal = parseNum(destY)
    const destZVal = parseNum(destZ)
    const hasDest = destXVal != null || destYVal != null || destZVal != null

    onApply({
      actionId: parseNum(actionId),
      uniqueId: parseNum(uniqueId),
      count: parseNum(count),
      charges: parseNum(charges),
      duration: parseNum(duration),
      text: text || undefined,
      description: description || undefined,
      depotId: parseNum(depotId),
      houseDoorId: parseNum(doorId),
      teleportDestination: hasDest ? {
        x: destXVal ?? 0,
        y: destYVal ?? 0,
        z: destZVal ?? 0,
      } : undefined,
    })
  }

  const appearance = appearances.objects.get(item.id)
  const flags = appearance?.flags
  const itemFlags = flags ? getItemFlags(flags) : []

  return (
    <div className="item-properties">
      {itemFlags.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {itemFlags.map(f => (
            <span key={f} className="rounded-sm bg-accent-subtle px-3 py-[2px] font-display text-xs font-semibold tracking-wide uppercase text-accent-fg">
              {f}
            </span>
          ))}
        </div>
      )}
      <div className="item-prop-row">
        <PropField label="ACTION ID" value={actionId} onChange={setActionId} />
        <PropField label="UNIQUE ID" value={uniqueId} onChange={setUniqueId} />
      </div>
      <div className="item-prop-row">
        <PropField label="COUNT" value={count} onChange={setCount} />
        <PropField label="CHARGES" value={charges} onChange={setCharges} />
        <PropField label="DURATION" value={duration} onChange={setDuration} />
      </div>
      <div className="item-prop-row">
        <PropField label="TEXT" value={text} onChange={setText} wide />
      </div>
      <div className="item-prop-row">
        <PropField label="DESCRIPTION" value={description} onChange={setDescription} wide />
      </div>
      <div className="item-prop-row">
        <PropField label="DEPOT ID" value={depotId} onChange={setDepotId} />
        <PropField label="DOOR ID" value={doorId} onChange={setDoorId} />
      </div>
      <div className="item-prop-row">
        <PropField label="DEST X" value={destX} onChange={setDestX} />
        <PropField label="DEST Y" value={destY} onChange={setDestY} />
        <PropField label="DEST Z" value={destZ} onChange={setDestZ} />
      </div>
      <div className="item-prop-actions">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover hover:text-fg-inverse" onClick={handleApply}>Apply</button>
      </div>
    </div>
  )
}

function PropField({
  label,
  value,
  onChange,
  wide,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  wide?: boolean
}) {
  return (
    <div className="item-prop-field" style={wide ? { flex: '1 1 100%' } : undefined}>
      <span className="label text-sm">{label}</span>
      <input
        className={clsx('item-prop-input', value && 'has-value')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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

// ── Item Flags ────────────────────────────────────────────────────

/** Skip internal/rendering-only flags that aren't useful in the inspector */
const HIDDEN_FLAGS = new Set(['shift', 'npcsaledata', 'noMovementAnimation', 'defaultAction', 'lenshelp', 'cyclopediaitem', 'skillwheelGem', 'transparencylevel'])

function getItemFlags(flags: Record<string, unknown>): string[] {
  const result: string[] = []
  for (const [key, value] of Object.entries(flags)) {
    if (HIDDEN_FLAGS.has(key)) continue
    if (value === false || value === undefined || value === 0) continue
    if (Array.isArray(value) && value.length === 0) continue

    if (value === true) {
      result.push(key)
    } else if (typeof value === 'object' && value !== null) {
      const inner = Object.values(value as Record<string, unknown>).filter(v => v !== undefined && v !== 0)
      result.push(inner.length > 0 ? `${key}(${inner.join(',')})` : key)
    } else {
      result.push(`${key}(${value})`)
    }
  }
  return result
}

// ── Helpers ────────────────────────────────────────────────────────

function getItemAttributes(item: OtbmItem): string[] {
  const attrs: string[] = []
  if (item.actionId != null) attrs.push(`AID: ${item.actionId}`)
  if (item.uniqueId != null) attrs.push(`UID: ${item.uniqueId}`)
  if (item.count != null && item.count > 1) attrs.push(`Count: ${item.count}`)
  if (item.text) attrs.push(`Text: "${item.text}"`)
  if (item.description) attrs.push(`Desc: "${item.description}"`)
  if (item.teleportDestination) {
    const d = item.teleportDestination
    attrs.push(`Dest: ${d.x}, ${d.y}, ${d.z}`)
  }
  if (item.depotId != null) attrs.push(`Depot: ${item.depotId}`)
  if (item.houseDoorId != null) attrs.push(`Door: ${item.houseDoorId}`)
  if (item.charges != null) attrs.push(`Charges: ${item.charges}`)
  if (item.duration != null) attrs.push(`Duration: ${item.duration}`)
  return attrs
}
