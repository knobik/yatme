/** Golden-angle hue for deterministic zone coloring. */
export function getZoneHue(zoneId: number): number {
  return (zoneId * 137.508) % 360
}

function hslToHex(h: number, s: number, l: number): number {
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

/** Zone color as PixiJS hex number (0xRRGGBB). */
export function zoneColorHex(zoneId: number): number {
  return hslToHex(getZoneHue(zoneId), 0.7, 0.5)
}

/** Zone color as CSS hsl() string. */
export function zoneColorCSS(zoneId: number, lightness = 50): string {
  return `hsl(${getZoneHue(zoneId)}, 70%, ${lightness}%)`
}
