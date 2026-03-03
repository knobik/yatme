import { useEffect, useRef, useState } from 'react'

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

  // Intercept paste to parse position strings like {x=123, y=456, z=7}
  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').trim()

    // Try {x=123, y=456, z=7} format (from "Copy Position")
    const eqMatch = text.match(/x\s*=\s*(\d+).*y\s*=\s*(\d+).*z\s*=\s*(\d+)/)
    // Try {x: 123, y: 456, z: 7} or {"x": 123, ...} JSON-like format
    const colonMatch = text.match(/x["\s]*:\s*(\d+).*y["\s]*:\s*(\d+).*z["\s]*:\s*(\d+)/)
    // Try plain comma-separated: 123, 456, 7
    const csvMatch = text.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/)

    const match = eqMatch || colonMatch || csvMatch
    if (match) {
      e.preventDefault()
      setX(match[1])
      setY(match[2])
      setZ(match[3])
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
    <div ref={scrimRef} className="goto-scrim" onClick={handleScrimClick}>
      <div className="panel goto-dialog">
        <div className="goto-title">Go to Position</div>
        <form onSubmit={handleSubmit} onPaste={handlePaste}>
          <div className="goto-fields">
            <div className="goto-field">
              <span className="label">X</span>
              <input
                ref={xRef}
                className="goto-input"
                type="number"
                value={x}
                onChange={e => setX(e.target.value)}
              />
            </div>
            <div className="goto-field">
              <span className="label">Y</span>
              <input
                className="goto-input"
                type="number"
                value={y}
                onChange={e => setY(e.target.value)}
              />
            </div>
            <div className="goto-field">
              <span className="label">Z</span>
              <input
                className="goto-input"
                type="number"
                value={z}
                min={0}
                max={15}
                onChange={e => setZ(e.target.value)}
              />
            </div>
          </div>
          <div className="goto-actions" style={{ marginTop: 'var(--space-6)' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-accent">Go</button>
          </div>
        </form>
      </div>
    </div>
  )
}
