import { useState, useRef, useCallback } from 'react'
import clsx from 'clsx'
import type { OtbmItem } from '../lib/otbm'
import { ATTRMAP_STRING, ATTRMAP_INTEGER, ATTRMAP_FLOAT, ATTRMAP_BOOLEAN, applyItemProperties } from '../lib/otbm'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import { getItemDisplayName } from '../lib/items'
import { parsePositionString } from '../lib/position'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ItemSprite } from './ItemSprite'
import { ItemSearchSelect } from './ItemSearchSelect'
import { PlusIcon, TrashIcon } from '@phosphor-icons/react'

/** Only show pickupable items in container contents search. */
const pickupableFilter = (_id: number, appearance: { flags?: { take?: boolean } }) =>
  appearance.flags?.take === true

interface AttrEntry {
  key: string
  type: number
  value: string
}

/** Known attribute keys that map to typed OtbmItem fields */
const KNOWN_KEYS: Record<string, { field: keyof OtbmItem; type: number }> = {
  aid: { field: 'actionId', type: ATTRMAP_INTEGER },
  uid: { field: 'uniqueId', type: ATTRMAP_INTEGER },
  text: { field: 'text', type: ATTRMAP_STRING },
  desc: { field: 'description', type: ATTRMAP_STRING },
  charges: { field: 'charges', type: ATTRMAP_INTEGER },
  duration: { field: 'duration', type: ATTRMAP_INTEGER },
  depotId: { field: 'depotId', type: ATTRMAP_INTEGER },
  doorId: { field: 'houseDoorId', type: ATTRMAP_INTEGER },
}

const TYPE_LABELS: Record<number, string> = {
  [ATTRMAP_STRING]: 'String',
  [ATTRMAP_INTEGER]: 'Integer',
  [ATTRMAP_FLOAT]: 'Float',
  [ATTRMAP_BOOLEAN]: 'Boolean',
}

interface ItemPropertiesModalProps {
  item: OtbmItem
  appearances: AppearanceData
  registry: ItemRegistry
  mapVersion: number
  onApply: (props: Partial<OtbmItem>) => void
  onCancel: () => void
}

export function ItemPropertiesModal({
  item,
  appearances,
  registry,
  mapVersion,
  onApply,
  onCancel,
}: ItemPropertiesModalProps) {
  const showAdvanced = mapVersion >= 5
  const [activeTab, setActiveTab] = useState<'simple' | 'advanced' | 'contents'>('simple')
  const modalRef = useRef<HTMLDivElement>(null)

  // Derive item info early so we can use it for default count/charges
  const appearance = appearances.objects.get(item.id)
  const flags = appearance?.flags
  const itemInfo = registry.get(item.id)
  const defaultCharges = itemInfo?.charges
  const isCharged = defaultCharges != null && defaultCharges > 0
  const isStackable = !!flags?.cumulative && !isCharged

  // Unified attribute array — the canonical state for both tabs
  const [attrs, setAttrs] = useState<AttrEntry[]>(() => {
    const entries: AttrEntry[] = []
    if (item.actionId != null) entries.push({ key: 'aid', type: ATTRMAP_INTEGER, value: String(item.actionId) })
    if (item.uniqueId != null) entries.push({ key: 'uid', type: ATTRMAP_INTEGER, value: String(item.uniqueId) })
    if (item.text != null) entries.push({ key: 'text', type: ATTRMAP_STRING, value: item.text })
    if (item.description != null) entries.push({ key: 'desc', type: ATTRMAP_STRING, value: item.description })
    if (item.duration != null) entries.push({ key: 'duration', type: ATTRMAP_INTEGER, value: String(item.duration) })
    if (item.depotId != null) entries.push({ key: 'depotId', type: ATTRMAP_INTEGER, value: String(item.depotId) })
    if (item.houseDoorId != null) entries.push({ key: 'doorId', type: ATTRMAP_INTEGER, value: String(item.houseDoorId) })
    if (item.customAttributes) {
      for (const [key, { type, value }] of item.customAttributes) {
        entries.push({ key, type, value: String(value) })
      }
    }
    return entries
  })

  // Container detection — items.xml first, fallback to appearance flags
  const isContainer = itemInfo?.itemType === 'container' || itemInfo?.itemType === 'depot' || itemInfo?.itemType === 'trashholder' || !!flags?.container
  const containerSize = itemInfo?.containerSize ?? (isContainer ? 20 : 0)
  const [containerItems, setContainerItems] = useState<OtbmItem[]>(() =>
    item.items ? item.items.map(i => ({ ...i })) : []
  )
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [dragIndex, setDragIndexState] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const dragging = dragIndex !== null
  const setDragIndex = (v: number | null) => { dragIndexRef.current = v; setDragIndexState(v) }

  // Separate state for teleport destination and count/charges (not part of attribute map).
  // RME convention: stackable items use item.count as "count", charged items use item.count
  // as "charges". Both are the same underlying field (subtype).
  const subtypeDefault = isStackable ? '1' : isCharged ? String(defaultCharges) : ''
  const [count, setCount] = useState(item.count != null ? String(item.count) : subtypeDefault)
  const [destX, setDestX] = useState(item.teleportDestination ? String(item.teleportDestination.x) : '')
  const [destY, setDestY] = useState(item.teleportDestination ? String(item.teleportDestination.y) : '')
  const [destZ, setDestZ] = useState(item.teleportDestination ? String(item.teleportDestination.z) : '')

  useEscapeKey(onCancel, editingSlot === null)

  // Live reorder: move items out of the way as the dragged item passes over
  const handleDragOver = useCallback((targetIndex: number) => {
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === targetIndex) return
    // Only allow dragging onto filled slots or the slot right after the last item
    if (targetIndex > containerItems.length) return
    setContainerItems(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      const insertAt = Math.min(targetIndex, updated.length)
      updated.splice(insertAt, 0, moved)
      return updated
    })
    setDragIndex(targetIndex)
  }, [setContainerItems, containerItems.length])

  // Focus trap — click outside closes
  const handleScrimClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel()
  }

  // Helper to get/set attr value by key
  const getAttrValue = (key: string): string => {
    const entry = attrs.find(a => a.key === key)
    return entry?.value ?? ''
  }

  const setAttrValue = (key: string, value: string, type?: number) => {
    setAttrs(prev => {
      const idx = prev.findIndex(a => a.key === key)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], value }
        return updated
      }
      // Create entry if it doesn't exist
      return [...prev, { key, type: type ?? ATTRMAP_INTEGER, value }]
    })
  }

  const removeAttr = (index: number) => {
    setAttrs(prev => prev.filter((_, i) => i !== index))
  }

  const updateAttrKey = (index: number, newKey: string) => {
    setAttrs(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], key: newKey }
      return updated
    })
  }

  const updateAttrType = (index: number, newType: number) => {
    setAttrs(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], type: newType }
      return updated
    })
  }

  const updateAttrValue = (index: number, newValue: string) => {
    setAttrs(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], value: newValue }
      return updated
    })
  }

  const addAttr = () => {
    setAttrs(prev => [...prev, { key: '', type: ATTRMAP_STRING, value: '' }])
  }

  const parseNum = (v: string): number | undefined => {
    if (v.trim() === '') return undefined
    const n = parseInt(v, 10)
    return isNaN(n) ? undefined : n
  }

  const handleApply = () => {
    const result: Partial<OtbmItem> = {}

    // Process unified attrs → known fields + customAttributes
    const custom = new Map<string, { type: number; value: string | number | boolean }>()

    for (const entry of attrs) {
      if (entry.key.trim() === '') continue
      const known = KNOWN_KEYS[entry.key]
      if (known) {
        const field = known.field
        if (known.type === ATTRMAP_STRING) {
          ;(result as Record<string, unknown>)[field] = entry.value || undefined
        } else {
          ;(result as Record<string, unknown>)[field] = parseNum(entry.value)
        }
      } else {
        // Custom attribute
        let typedValue: string | number | boolean
        if (entry.type === ATTRMAP_STRING) {
          typedValue = entry.value
        } else if (entry.type === ATTRMAP_BOOLEAN) {
          typedValue = entry.value === 'true' || entry.value === '1'
        } else {
          typedValue = parseNum(entry.value) ?? 0
        }
        custom.set(entry.key, { type: entry.type, value: typedValue })
      }
    }

    result.customAttributes = custom.size > 0 ? custom : undefined

    // Count (separate from attribute map)
    result.count = parseNum(count)

    // Teleport destination (separate from attribute map)
    const dx = parseNum(destX)
    const dy = parseNum(destY)
    const dz = parseNum(destZ)
    if (dx != null || dy != null || dz != null) {
      result.teleportDestination = { x: dx ?? 0, y: dy ?? 0, z: dz ?? 0 }
    } else {
      result.teleportDestination = undefined
    }

    // Container items
    if (isContainer) {
      result.items = containerItems.length > 0 ? containerItems.map(i => ({ ...i })) : undefined
    }

    onApply(result)
  }

  // Derive display info for Simple tab
  const isWriteable = !!(flags?.write || flags?.writeOnce || itemInfo?.writeable)
  const hasDuration = item.duration != null || getAttrValue('duration') !== ''
  const isTeleport = item.teleportDestination != null || itemInfo?.itemType === 'teleport'
  const isDepot = item.depotId != null || itemInfo?.itemType === 'depot'
  const isDoor = item.houseDoorId != null || itemInfo?.itemType === 'door'
  const hasDescription = item.description != null || getAttrValue('desc') !== ''
  const hasSubtype = isStackable || isCharged
  const subtypeLabel = isCharged ? 'CHARGES' : 'COUNT'

  const itemFlags = flags ? getItemFlags(flags as unknown as Record<string, unknown>) : []
  const itemName = getItemDisplayName(item.id, registry, appearances)

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-scrim"
      onClick={handleScrimClick}
    >
      <div
        ref={modalRef}
        className="panel flex min-w-[480px] max-w-[560px] flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <div className="px-6 py-5">
          <span className="label text-lg tracking-wide">
            ITEM PROPERTIES
          </span>
          <div className="mt-1 font-mono text-sm text-fg-faint">
            {itemName} (id: {item.id})
          </div>
        </div>

        {/* Tab bar */}
        {(showAdvanced || isContainer) && (
          <div className="section-tabs px-6">
            <button
              className={clsx('section-tab', activeTab === 'simple' && 'active')}
              onClick={() => setActiveTab('simple')}
            >
              Properties
            </button>
            {isContainer && (
              <button
                className={clsx('section-tab', activeTab === 'contents' && 'active')}
                onClick={() => setActiveTab('contents')}
              >
                Contents ({containerItems.length}/{containerSize})
              </button>
            )}
            {showAdvanced && (
              <button
                className={clsx('section-tab', activeTab === 'advanced' && 'active')}
                onClick={() => setActiveTab('advanced')}
              >
                Attributes
              </button>
            )}
          </div>
        )}

        {/* Tab content */}
        <div className="max-h-[400px] overflow-y-auto">
          {activeTab === 'contents' ? (
            <div className="flex flex-col gap-3 p-4">
              {/* Container slots grid — 6 columns like RME */}
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: containerSize }, (_, i) => {
                  const slotItem = containerItems[i]
                  const isDragSource = dragging && dragIndex === i
                  return (
                    <div
                      key={i}
                      className={clsx(
                        'group/slot relative flex aspect-square items-center justify-center rounded-sm border',
                        isDragSource && 'opacity-40 border-accent!',
                        slotItem && !isDragSource
                          ? 'border-border-subtle bg-bg-raised hover:border-accent cursor-pointer'
                          : !isDragSource && 'border-border-subtle/50 bg-bg-sunken',
                      )}
                      title={slotItem ? `${getItemDisplayName(slotItem.id, registry, appearances)} (id: ${slotItem.id})` : `Empty slot ${i + 1}`}
                      onClick={slotItem && !dragging ? () => setEditingSlot(i) : undefined}
                      draggable={!!slotItem}
                      onDragStart={slotItem ? (e) => {
                        setDragIndex(i)
                        e.dataTransfer.effectAllowed = 'move'
                      } : undefined}
                      onDragEnd={() => {
                        setDragIndex(null)
                      }}
                      onDragOver={(e) => {
                        if (dragIndexRef.current === null) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        handleDragOver(i)
                      }}
                      onDrop={(e) => e.preventDefault()}
                    >
                      {slotItem ? (
                        <>
                          <ItemSprite itemId={slotItem.id} appearances={appearances} size={32} count={slotItem.count} />
                          {/* Remove button on hover */}
                          <button
                            className="container-slot-remove hidden group-hover/slot:flex"
                            onClick={(e) => {
                              e.stopPropagation()
                              setContainerItems(prev => prev.filter((_, idx) => idx !== i))
                            }}
                            title="Remove item"
                          >
                            <TrashIcon size={10} weight="bold" />
                          </button>
                          {/* Count badge */}
                          {slotItem.count != null && slotItem.count > 1 && (
                            <span className="absolute bottom-0 right-0.5 font-mono text-[10px] font-bold text-fg drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                              {slotItem.count}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-fg-faint/30">{i + 1}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add item search */}
              {containerItems.length < containerSize && (
                <ItemSearchSelect
                  registry={registry}
                  appearances={appearances}
                  onSelect={(id) => setContainerItems(prev => [...prev, { id }])}
                  placeholder="Add item — search by name or ID..."
                  filter={pickupableFilter}
                />
              )}

              {containerItems.length === 0 && (
                <div className="py-2 text-center font-mono text-sm text-fg-faint">
                  Container is empty
                </div>
              )}
            </div>
          ) : activeTab === 'simple' ? (
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
                <PropField label="ACTION ID" value={getAttrValue('aid')} onChange={v => setAttrValue('aid', v)} />
                <PropField label="UNIQUE ID" value={getAttrValue('uid')} onChange={v => setAttrValue('uid', v)} />
              </div>
              {hasSubtype && (
                <div className="item-prop-row">
                  <PropField label={subtypeLabel} value={count} onChange={setCount} />
                </div>
              )}
              {hasDuration && (
                <div className="item-prop-row">
                  <PropField label="DURATION" value={getAttrValue('duration')} onChange={v => setAttrValue('duration', v)} />
                </div>
              )}
              {isWriteable && (
                <div className="item-prop-row">
                  <PropField label="TEXT" value={getAttrValue('text')} onChange={v => setAttrValue('text', v, ATTRMAP_STRING)} wide />
                </div>
              )}
              {hasDescription && (
                <div className="item-prop-row">
                  <PropField label="DESCRIPTION" value={getAttrValue('desc')} onChange={v => setAttrValue('desc', v, ATTRMAP_STRING)} wide />
                </div>
              )}
              {(isDepot || isDoor) && (
                <div className="item-prop-row">
                  {isDepot && <PropField label="DEPOT ID" value={getAttrValue('depotId')} onChange={v => setAttrValue('depotId', v)} />}
                  {isDoor && <PropField label="DOOR ID" value={getAttrValue('doorId')} onChange={v => setAttrValue('doorId', v)} />}
                </div>
              )}
              {isTeleport && (
                <div className="item-prop-row" onPaste={(e) => {
                  const pos = parsePositionString(e.clipboardData.getData('text'))
                  if (pos) {
                    e.preventDefault()
                    setDestX(pos.x)
                    setDestY(pos.y)
                    setDestZ(pos.z)
                  }
                }}>
                  <PropField label="DEST X" value={destX} onChange={setDestX} />
                  <PropField label="DEST Y" value={destY} onChange={setDestY} />
                  <PropField label="DEST Z" value={destZ} onChange={setDestZ} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {/* Header row */}
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className="label flex-[2] text-sm">KEY</span>
                <span className="label w-[100px] shrink-0 text-sm">TYPE</span>
                <span className="label flex-[3] text-sm">VALUE</span>
                <span className="w-[28px] shrink-0" />
              </div>
              {attrs.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="item-prop-input flex-[2]"
                    value={entry.key}
                    onChange={e => updateAttrKey(i, e.target.value)}
                    placeholder="key"
                  />
                  <select
                    className="item-prop-input w-[100px] shrink-0"
                    value={entry.type}
                    onChange={e => updateAttrType(i, Number(e.target.value))}
                  >
                    {Object.entries(TYPE_LABELS).map(([t, label]) => (
                      <option key={t} value={t}>{label}</option>
                    ))}
                  </select>
                  <input
                    className="item-prop-input flex-[3]"
                    value={entry.value}
                    onChange={e => updateAttrValue(i, e.target.value)}
                    placeholder="value"
                  />
                  <button
                    className="btn btn-icon shrink-0 border-none bg-transparent text-fg-faint hover:text-danger"
                    onClick={() => removeAttr(i)}
                    title="Remove attribute"
                  >
                    <TrashIcon size={14} weight="bold" />
                  </button>
                </div>
              ))}
              <button
                className="btn mt-1 flex items-center gap-2 self-start"
                onClick={addAttr}
              >
                <PlusIcon size={14} weight="bold" />
                Add Attribute
              </button>

              {/* Non-attribute-map fields shown as read-only info */}
              {(count || destX || destY || destZ) && (
                <div className="mt-3 border-t border-border-subtle pt-3">
                  <span className="label mb-2 block text-sm">NON-MAP FIELDS</span>
                  {count && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-fg-faint">count = {count}</span>
                    </div>
                  )}
                  {(destX || destY || destZ) && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-fg-faint">teleport = {destX || '0'}, {destY || '0'}, {destZ || '0'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="item-prop-actions px-6 pb-5">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover hover:text-fg-inverse"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Nested item properties modal for container contents */}
      {editingSlot !== null && containerItems[editingSlot] && (
        <ItemPropertiesModal
          item={containerItems[editingSlot]}
          appearances={appearances}
          registry={registry}
          mapVersion={mapVersion}
          onApply={(props) => {
            setContainerItems(prev => {
              const updated = [...prev]
              updated[editingSlot] = applyItemProperties(updated[editingSlot], props)
              return updated
            })
            setEditingSlot(null)
          }}
          onCancel={() => setEditingSlot(null)}
        />
      )}
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

// ── Item Flags ────────────────────────────────────────────────────

const SHOWN_FLAGS: [string, string][] = [
  ['cumulative', 'Stackable'],
  ['unmove', 'Movable'],
  ['take', 'Pickupable'],
  ['hang', 'Hangable'],
  ['unsight', 'Block Missiles'],
  ['avoid', 'Block Pathfinder'],
  ['height', 'Has Elevation'],
]

function getItemFlags(flags: Record<string, unknown>): string[] {
  const result: string[] = []
  for (const [key, label] of SHOWN_FLAGS) {
    const value = flags[key]
    if (key === 'unmove') {
      if (!value) result.push(label)
    } else if (value && value !== false && value !== 0) {
      result.push(label)
    }
  }
  return result
}

