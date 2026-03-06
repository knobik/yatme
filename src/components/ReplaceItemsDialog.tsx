import { useState, useRef } from 'react'
import clsx from 'clsx'
import type { OtbmMap } from '../lib/otbm'
import type { MapMutator } from '../lib/MapMutator'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import { getItemDisplayName } from '../lib/items'
import { replaceItemsOnMap } from '../lib/mapSearch'
import type { SelectedItemInfo } from '../hooks/useSelection'
import { ItemPicker } from './ItemPicker'
import { ItemSprite } from './ItemSprite'
import { ScopeSelector } from './ScopeSelector'
import { X, ArrowRight, Swap, Plus } from '@phosphor-icons/react'

interface ReplaceRule {
  sourceId: number
  targetId: number
  replacedCount: number | null
}

interface ReplaceItemsDialogProps {
  mapData: OtbmMap
  mutator: MapMutator
  registry: ItemRegistry
  appearances: AppearanceData
  hasSelection: boolean
  selectedItems: SelectedItemInfo[]
  onClose: () => void
  left?: string
}

export function ReplaceItemsDialog({
  mapData,
  mutator,
  registry,
  appearances,
  hasSelection,
  selectedItems,
  onClose,
  left = '8px',
}: ReplaceItemsDialogProps) {
  const [sourceId, setSourceId] = useState<number | null>(null)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [expandedPicker, setExpandedPicker] = useState<'source' | 'target' | null>(null)
  const [rules, setRules] = useState<ReplaceRule[]>([])
  const [scope, setScope] = useState<'map' | 'selection'>('map')
  const [replacing, setReplacing] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const canAddRule = sourceId !== null && targetId !== null
    && sourceId !== targetId
    && !rules.some(r => r.sourceId === sourceId)

  function handleAddRule() {
    if (!canAddRule || sourceId === null || targetId === null) return
    setRules(prev => [...prev, { sourceId, targetId, replacedCount: null }])
    setSourceId(null)
    setTargetId(null)
    setExpandedPicker(null)
  }

  function handleRemoveRule(index: number) {
    setRules(prev => prev.filter((_, i) => i !== index))
  }

  async function handleExecute() {
    if (rules.length === 0) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const scopeKeys = scope === 'selection' && hasSelection
      ? new Set(selectedItems.map(s => `${s.x},${s.y},${s.z}`))
      : undefined

    setReplacing(true)
    setProgress(0)

    mutator.beginBatch('Replace items')

    const updatedRules = [...rules]
    const totalRules = updatedRules.filter(r => r.replacedCount === null).length
    let doneRules = 0

    for (let i = 0; i < updatedRules.length; i++) {
      if (controller.signal.aborted) break
      if (updatedRules[i].replacedCount !== null) continue

      const count = await replaceItemsOnMap(
        mapData, mutator, updatedRules[i].sourceId, updatedRules[i].targetId, scopeKeys,
        (processed, total) => {
          const ruleProgress = processed / total
          setProgress((doneRules + ruleProgress) / totalRules)
        },
        controller.signal,
      )
      updatedRules[i] = { ...updatedRules[i], replacedCount: count }
      doneRules++
    }

    mutator.commitBatch()

    if (!controller.signal.aborted) {
      setRules(updatedRules)
      setReplacing(false)
    }
  }

  const hasUnexecuted = rules.some(r => r.replacedCount === null)

  return (
    <div
      className="panel absolute top-4 bottom-4 z-10 flex w-[340px] flex-col pointer-events-auto transition-[left] duration-[180ms] ease-out"
      style={{ left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="label text-lg tracking-wide">REPLACE ITEMS</span>
        <button className="btn btn-icon border-none bg-transparent" onClick={onClose} title="Close (Esc)">
          <X size={14} weight="bold" />
        </button>
      </div>

      <div className="mx-6 h-px bg-border-subtle" />

      {/* Source → Target selectors */}
      <div className="shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-stretch gap-4">
          <ItemSelectorButton
            itemId={sourceId}
            appearances={appearances}
            registry={registry}
            label="FIND"
            active={expandedPicker === 'source'}
            onClick={() => setExpandedPicker(expandedPicker === 'source' ? null : 'source')}
          />
          <div className="flex items-center px-1">
            <ArrowRight size={20} weight="bold" className="text-fg-faint" />
          </div>
          <ItemSelectorButton
            itemId={targetId}
            appearances={appearances}
            registry={registry}
            label="REPLACE WITH"
            active={expandedPicker === 'target'}
            onClick={() => setExpandedPicker(expandedPicker === 'target' ? null : 'target')}
          />
          <div className="flex-1" />
          <button
            className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover self-center"
            disabled={!canAddRule}
            onClick={handleAddRule}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Inline picker (expands when a slot is clicked) */}
      {expandedPicker && (
        <div className="flex flex-col flex-1 min-h-0 px-5 pb-4">
          <ItemPicker
            registry={registry}
            appearances={appearances}
            selectedItemId={expandedPicker === 'source' ? sourceId : targetId}
            onSelect={(id) => {
              if (expandedPicker === 'source') setSourceId(id)
              else setTargetId(id)
              setExpandedPicker(null)
            }}
          />
        </div>
      )}

      {/* Rules list — fills remaining space */}
      <div className={clsx(
        'flex flex-col min-h-0',
        expandedPicker ? 'shrink-0' : 'flex-1',
      )}>
        <div className="mx-5 h-px bg-border-subtle" />

        {/* Rules header */}
        <div className="flex items-center gap-4 px-6 py-4 shrink-0">
          <span className="label shrink-0">Rules</span>
          {rules.length > 0 && (
            <span className="value text-xs text-accent-fg">
              {rules.length} rule{rules.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Rules content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
          {rules.length > 0 ? (
            <div className="flex flex-col gap-px">
              {rules.map((rule, i) => (
                <div key={i} className="find-replace-rule-row">
                  <div className="find-replace-rule-item">
                    <ItemSprite itemId={rule.sourceId} appearances={appearances} size={24} />
                    <span className="value text-xs">{rule.sourceId}</span>
                  </div>
                  <ArrowRight size={14} className="text-fg-faint shrink-0" />
                  <div className="find-replace-rule-item">
                    <ItemSprite itemId={rule.targetId} appearances={appearances} size={24} />
                    <span className="value text-xs">{rule.targetId}</span>
                  </div>
                  <div className="flex-1" />
                  {rule.replacedCount !== null && (
                    <span className="value text-xs text-success">{rule.replacedCount} replaced</span>
                  )}
                  <button
                    className="item-action-btn danger !w-[22px] !h-[22px]"
                    onClick={() => handleRemoveRule(i)}
                    title="Remove rule"
                  >
                    <X size={10} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="find-empty-state">
              <Swap size={24} className="text-fg-disabled" />
              <span>Select items and click + Add</span>
            </div>
          )}
        </div>
      </div>

      {/* Pinned bottom bar — scope + replace */}
      <div className="shrink-0 px-5 pb-5 pt-3 flex flex-col gap-3">
        <div className="h-px bg-border-subtle" />
        <div className="find-action-bar">
          <ScopeSelector scope={scope} onScopeChange={setScope} hasSelection={hasSelection} />
          <div className="flex-1" />
          <button
            className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover shrink-0 w-[90px]"
            disabled={rules.length === 0 || !hasUnexecuted || replacing}
            onClick={handleExecute}
          >
            {replacing ? 'Replacing…' : 'Replace'}
          </button>
        </div>

        {/* Progress bar */}
        {replacing && (
          <div className="h-[3px] w-full overflow-hidden rounded-[2px] bg-elevated">
            <div
              className="h-full rounded-[2px] bg-accent transition-[width] duration-200 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Item Selector Button ─────────────────────────────────────────────

function ItemSelectorButton({
  itemId,
  appearances,
  registry,
  label,
  active,
  onClick,
}: {
  itemId: number | null
  appearances: AppearanceData
  registry: ItemRegistry
  label: string
  active: boolean
  onClick: () => void
}) {
  const name = itemId !== null ? getItemDisplayName(itemId, registry, appearances) : null

  return (
    <button
      className={clsx('find-replace-item-slot', active && 'active')}
      onClick={onClick}
    >
      <span className="label text-[10px] leading-none">{label}</span>
      <div className="flex items-center justify-center h-[40px] w-[40px]">
        {itemId !== null ? (
          <ItemSprite itemId={itemId} appearances={appearances} size={36} />
        ) : (
          <div className="h-[36px] w-[36px] rounded-sm border border-dashed border-border-default flex items-center justify-center">
            <Plus size={14} className="text-fg-faint" />
          </div>
        )}
      </div>
      {name && (
        <span className="value text-[10px] text-fg-faint max-w-[80px] truncate leading-tight">{name}</span>
      )}
    </button>
  )
}
