/** Convert HSL to a PixiJS-compatible hex number (0xRRGGBB). */
export function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const ri = Math.round((r + m) * 255)
  const gi = Math.round((g + m) * 255)
  const bi = Math.round((b + m) * 255)
  return (ri << 16) | (gi << 8) | bi
}

/** Golden-angle hue for deterministic ID-based coloring. */
export function goldenAngleHue(id: number, offset = 0): number {
  return (id * 137.508 + offset) % 360
}

/** RME 6x6x6 RGB cube (216 colors). Index 0 and >=216 -> black. */
export function colorFromEightBit(color: number): [number, number, number] {
  if (color <= 0 || color >= 216) return [0, 0, 0]
  const r = Math.floor(color / 36) % 6 * 51
  const g = Math.floor(color / 6) % 6 * 51
  const b = color % 6 * 51
  return [r, g, b]
}
