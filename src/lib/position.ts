/**
 * Parse a position string in various formats:
 * - {x=123, y=456, z=7}  (Copy Position format)
 * - {x: 123, y: 456, z: 7} or {"x": 123, ...}  (JSON-like)
 * - 123, 456, 7  (comma-separated)
 */
export function parsePositionString(text: string): { x: string; y: string; z: string } | null {
  const trimmed = text.trim()
  const eqMatch = trimmed.match(/x\s*=\s*(\d+).*y\s*=\s*(\d+).*z\s*=\s*(\d+)/)
  const colonMatch = trimmed.match(/x["\s]*:\s*(\d+).*y["\s]*:\s*(\d+).*z["\s]*:\s*(\d+)/)
  const csvMatch = trimmed.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/)
  const match = eqMatch || colonMatch || csvMatch
  if (!match) return null
  return { x: match[1], y: match[2], z: match[3] }
}
