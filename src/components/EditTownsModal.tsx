import { useRef, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { parsePositionString } from '../lib/position'
import type { OtbmTown } from '../lib/otbm'
import type { HouseData } from '../lib/sidecars'

interface EditTownsModalProps {
  towns: OtbmTown[]
  houses: HouseData[]
  onApply: (towns: OtbmTown[]) => void
  onClose: () => void
  onNavigate: (x: number, y: number, z: number) => void
}

export function EditTownsModal({ towns, houses, onApply, onClose, onNavigate }: EditTownsModalProps) {
  const scrimRef = useRef<HTMLDivElement>(null)
  const [workingTowns, setWorkingTowns] = useState<OtbmTown[]>(() =>
    towns.map(t => ({ ...t })),
  )
  const [selectedId, setSelectedId] = useState<number | null>(
    workingTowns.length > 0 ? workingTowns[0].id : null,
  )
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  const selected = workingTowns.find(t => t.id === selectedId) ?? null

  function handleScrimClick(e: React.MouseEvent) {
    if (e.target === scrimRef.current) onClose()
  }

  function handleAdd() {
    const maxId = workingTowns.reduce((max, t) => Math.max(max, t.id), 0)
    const newTown: OtbmTown = { id: maxId + 1, name: 'Unnamed Town', templeX: 0, templeY: 0, templeZ: 7 }
    setWorkingTowns(prev => [...prev, newTown])
    setSelectedId(newTown.id)
    setError(null)
  }

  function handleRemove() {
    if (selectedId == null) return
    const refCount = houses.filter(h => h.townId === selectedId).length
    if (refCount > 0) {
      setError(`Cannot delete: ${refCount} house${refCount > 1 ? 's' : ''} reference this town`)
      return
    }
    setWorkingTowns(prev => {
      const next = prev.filter(t => t.id !== selectedId)
      setSelectedId(next.length > 0 ? next[0].id : null)
      return next
    })
    setError(null)
  }

  function updateSelected(patch: Partial<OtbmTown>) {
    if (selectedId == null) return
    setWorkingTowns(prev => prev.map(t => t.id === selectedId ? { ...t, ...patch } : t))
    setError(null)
  }

  function handleApply() {
    onApply(workingTowns)
    onClose()
  }

  function handlePositionPaste(e: React.ClipboardEvent) {
    const pos = parsePositionString(e.clipboardData.getData('text'))
    if (pos) {
      e.preventDefault()
      updateSelected({
        templeX: Number(pos.x) || 0,
        templeY: Number(pos.y) || 0,
        templeZ: Math.max(0, Math.min(15, Number(pos.z) || 0)),
      })
    }
  }

  function handleGoTo() {
    if (!selected) return
    onNavigate(selected.templeX, selected.templeY, selected.templeZ)
  }

  return (
    <div ref={scrimRef} className="fixed inset-0 z-200 flex items-center justify-center bg-scrim" onClick={handleScrimClick}>
      <div className="panel flex min-w-[520px] max-w-[600px] flex-col gap-6 p-8">
        <div className="font-display text-lg font-semibold tracking-wide uppercase text-fg">Edit Towns</div>

        <div className="flex gap-6">
          {/* Town list */}
          <div className="flex w-[200px] flex-col gap-3">
            <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Towns</div>
            <div className="flex max-h-[280px] min-h-[160px] flex-col overflow-y-auto rounded-sm border border-border-default bg-bg-base">
              {workingTowns.length === 0 && (
                <div className="px-3 py-4 text-center font-ui text-xs text-fg-faint">No towns</div>
              )}
              {workingTowns.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`flex w-full items-baseline gap-2 rounded-sm px-3 py-1.5 text-left transition-colors duration-100 ease-out hover:bg-panel-hover ${
                    t.id === selectedId
                      ? 'bg-accent-subtle outline outline-1 -outline-offset-1 outline-accent'
                      : ''
                  }`}
                  onClick={() => { setSelectedId(t.id); setError(null) }}
                >
                  <span className="truncate font-ui text-sm text-fg">{t.name}</span>
                  <span className="shrink-0 font-mono text-xs text-fg-faint">#{t.id}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn flex-1 text-xs" onClick={handleAdd}>Add</button>
              <button type="button" className="btn flex-1 text-xs" onClick={handleRemove} disabled={selectedId == null}>Remove</button>
            </div>
          </div>

          {/* Detail panel */}
          <div className="flex flex-1 flex-col gap-4">
            {selected ? (
              <>
                <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Properties</div>

                <div className="flex flex-col gap-1">
                  <span className="font-ui text-sm font-normal text-fg-muted">Name</span>
                  <input
                    type="text"
                    className="rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                    value={selected.name}
                    onChange={e => updateSelected({ name: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-ui text-sm font-normal text-fg-muted">ID</span>
                  <span className="font-mono text-sm text-fg-faint">{selected.id}</span>
                </div>

                <div className="h-px w-full bg-border-subtle" />

                <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Temple Position</div>
                <div className="flex gap-3" onPaste={handlePositionPaste}>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-ui text-sm font-normal text-fg-muted">X</span>
                    <input
                      type="number"
                      className="w-full rounded-sm border border-border-default bg-bg-base px-2 py-1.5 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                      value={selected.templeX}
                      min={0}
                      max={65535}
                      onChange={e => updateSelected({ templeX: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-ui text-sm font-normal text-fg-muted">Y</span>
                    <input
                      type="number"
                      className="w-full rounded-sm border border-border-default bg-bg-base px-2 py-1.5 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                      value={selected.templeY}
                      min={0}
                      max={65535}
                      onChange={e => updateSelected({ templeY: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-ui text-sm font-normal text-fg-muted">Z</span>
                    <input
                      type="number"
                      className="w-full rounded-sm border border-border-default bg-bg-base px-2 py-1.5 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                      value={selected.templeZ}
                      min={0}
                      max={15}
                      onChange={e => updateSelected({ templeZ: Math.max(0, Math.min(15, Number(e.target.value) || 0)) })}
                    />
                  </div>
                </div>

                <button type="button" className="btn self-start text-xs" onClick={handleGoTo}>Go To Temple</button>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center font-ui text-sm text-fg-faint">
                Select a town to edit
              </div>
            )}
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="rounded-sm border border-danger bg-danger-subtle px-3 py-2 font-ui text-sm text-danger-fg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover hover:text-fg-inverse" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
