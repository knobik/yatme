import { hslToHex, goldenAngleHue } from './colorUtils'

/** Golden-angle hue for deterministic zone coloring. */
export function getZoneHue(zoneId: number): number {
  return goldenAngleHue(zoneId)
}

/** Zone color as PixiJS hex number (0xRRGGBB). */
export function zoneColorHex(zoneId: number): number {
  return hslToHex(getZoneHue(zoneId), 0.7, 0.5)
}

/** Zone color as CSS hsl() string. */
export function zoneColorCSS(zoneId: number, lightness = 50): string {
  return `hsl(${getZoneHue(zoneId)}, 70%, ${lightness}%)`
}
