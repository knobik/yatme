import { useEffect, useRef, useState } from 'react'
import { parsePositionString } from '../lib/position'

interface GoToPositionDialogProps {
  currentX: number
  currentY: number
  currentZ: number
  onNavigate: (x: number, y: number, z: number) => void
  onClose: () => void
}

export function GoToPositionDialog({
  currentX,
  currentY,
  currentZ,
  onNavigate,
  onClose,
}: GoToPositionDialogProps) {
  const [x, setX] = useState(String(currentX))
  const [y, setY] = useState(String(currentY))
  const [z, setZ] = useState(String(currentZ))
  const xRef = useRef<HTMLInputElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)

  // Auto-focus and select X input on mount
  useEffect(() => {
    xRef.current?.focus()
    xRef.current?.select()
  }, [])

  // Escape dismissal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  function handlePaste(e: React.ClipboardEvent) {
    const pos = parsePositionString(e.clipboardData.getData('text'))
    if (pos) {
      e.preventDefault()
      setX(pos.x)
      setY(pos.y)
      setZ(pos.z)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nx = parseInt(x, 10)
    const ny = parseInt(y, 10)
    let nz = parseInt(z, 10)
    if (isNaN(nx) || isNaN(ny) || isNaN(nz)) return
    nz = Math.max(0, Math.min(15, nz))
    onNavigate(nx, ny, nz)
    onClose()
  }

  function handleScrimClick(e: React.MouseEvent) {
    if (e.target === scrimRef.current) {
      onClose()
    }
  }

  return (
    <div ref={scrimRef} className="fixed inset-0 z-200 flex items-center justify-center bg-scrim" onClick={handleScrimClick}>
      <div className="panel min-w-[280px] flex flex-col gap-6 p-8">
        <div className="font-display text-lg font-semibold tracking-wide uppercase text-fg">Go to Position</div>
        <form onSubmit={handleSubmit} onPaste={handlePaste}>
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <span className="label text-sm">X</span>
              <input
                ref={xRef}
                className="w-full rounded-sm border border-border-default bg-bg-base px-4 py-3 font-mono text-md text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                type="number"
                value={x}
                onChange={e => setX(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <span className="label text-sm">Y</span>
              <input
                className="w-full rounded-sm border border-border-default bg-bg-base px-4 py-3 font-mono text-md text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                type="number"
                value={y}
                onChange={e => setY(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <span className="label text-sm">Z</span>
              <input
                className="w-full rounded-sm border border-border-default bg-bg-base px-4 py-3 font-mono text-md text-fg outline-none transition-[border-color] duration-100 ease-out focus:border-accent"
                type="number"
                value={z}
                min={0}
                max={15}
                onChange={e => setZ(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn border-accent bg-accent text-fg-inverse hover:border-accent-hover hover:bg-accent-hover hover:text-fg-inverse">Go</button>
          </div>
        </form>
      </div>
    </div>
  )
}
