import { useRef, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import type { OtbmMap } from '../lib/otbm'

/** Minimum version the serializer will write (matches RME behavior). */
const MIN_SAVE_VERSION = 4

const OTBM_VERSIONS = [
  { value: 0, label: '0.5.0' },
  { value: 1, label: '0.6.0' },
  { value: 2, label: '0.6.1' },
  { value: 3, label: '0.7.0 (revscriptsys)' },
  { value: 4, label: '1.0.0' },
  { value: 5, label: '1.1.0 (revscriptsys)' },
]

interface MapPropertiesModalProps {
  map: OtbmMap
  onApply: (patch: MapPropertiesPatch) => void
  onClose: () => void
}

export interface MapPropertiesPatch {
  description: string
  width: number
  height: number
  version: number
  spawnFile: string
  houseFile: string
}

export function MapPropertiesModal({ map, onApply, onClose }: MapPropertiesModalProps) {
  const scrimRef = useRef<HTMLDivElement>(null)

  const [description, setDescription] = useState(map.description)
  const [width, setWidth] = useState(map.width)
  const [height, setHeight] = useState(map.height)
  const [version, setVersion] = useState(
    map.version < MIN_SAVE_VERSION ? (map.version === 3 ? 5 : 4) : map.version,
  )
  const [spawnFile, setSpawnFile] = useState(map.spawnFile)
  const [houseFile, setHouseFile] = useState(map.houseFile)

  useEscapeKey(onClose)

  function handleScrimClick(e: React.MouseEvent) {
    if (e.target === scrimRef.current) onClose()
  }

  function handleApply() {
    onApply({
      description,
      width: Math.max(1, width),
      height: Math.max(1, height),
      version,
      spawnFile,
      houseFile,
    })
    onClose()
  }

  return (
    <div ref={scrimRef} className="fixed inset-0 z-200 flex items-center justify-center bg-scrim" onClick={handleScrimClick}>
      <div className="panel flex min-w-[380px] max-w-[440px] flex-col gap-6 p-8">
        <div className="font-display text-lg font-semibold tracking-wide uppercase text-fg">Map Properties</div>

        {/* Description */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">General</div>

          <div className="flex flex-col gap-1">
            <span className="font-ui text-sm font-normal text-fg-muted">Description</span>
            <textarea
              className="h-[72px] resize-none rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Map description..."
            />
          </div>
        </div>

        <div className="h-px w-full bg-border-subtle" />

        {/* Size */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Size</div>

          <div className="flex gap-4">
            <div className="flex flex-1 items-center justify-between gap-2">
              <span className="font-ui text-sm font-normal text-fg-muted">Width</span>
              <input
                type="number"
                className="w-[100px] rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                value={width}
                min={1}
                max={65535}
                onChange={e => setWidth(Number(e.target.value) || 1)}
              />
            </div>

            <div className="flex flex-1 items-center justify-between gap-2">
              <span className="font-ui text-sm font-normal text-fg-muted">Height</span>
              <input
                type="number"
                className="w-[100px] rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                value={height}
                min={1}
                max={65535}
                onChange={e => setHeight(Number(e.target.value) || 1)}
              />
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-border-subtle" />

        {/* Save Version & Files */}
        <div className="flex flex-col gap-4">
          <div className="font-display text-xs font-semibold tracking-wide uppercase text-fg-faint">Format</div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-ui text-sm font-normal text-fg-muted">OTBM Version</span>
              <Tooltip text="Legacy versions (pre-1.0.0) are read-only. Version 1.1.0 uses attribute map format for item properties." />
            </div>
            <select
              className="w-[200px] cursor-pointer rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
              value={version}
              onChange={e => setVersion(Number(e.target.value))}
            >
              {OTBM_VERSIONS.map(v => (
                <option key={v.value} value={v.value} disabled={v.value < MIN_SAVE_VERSION}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">Spawn File</span>
            <input
              type="text"
              className="w-[200px] rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
              value={spawnFile}
              onChange={e => setSpawnFile(e.target.value)}
              placeholder="spawn.xml"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-ui text-sm font-normal text-fg-muted">House File</span>
            <input
              type="text"
              className="w-[200px] rounded-sm border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
              value={houseFile}
              onChange={e => setHouseFile(e.target.value)}
              placeholder="houses.xml"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover hover:text-fg-inverse" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}

// ── Tooltip bubble ─────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="flex h-[16px] w-[16px] items-center justify-center rounded-full border border-border-default font-mono text-[10px] leading-none text-fg-faint hover:border-fg-faint hover:text-fg-muted"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
      >
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-10 mb-1.5 w-[220px] -translate-x-1/2 rounded-sm border border-border-default bg-panel-hover px-3 py-2 font-ui text-xs leading-relaxed text-fg shadow-lg">
          {text}
        </div>
      )}
    </span>
  )
}
