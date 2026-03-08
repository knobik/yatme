import { hslToHex, goldenAngleHue } from './colorUtils'

/** Golden-angle hue for deterministic house coloring, shifted from zone colors. */
export function getHouseHue(houseId: number): number {
  return goldenAngleHue(houseId, 60)
}

/** House color as PixiJS hex number (0xRRGGBB). */
export function houseColorHex(houseId: number): number {
  return hslToHex(getHouseHue(houseId), 0.7, 0.5)
}

/** House color as CSS hsl() string. */
export function houseColorCSS(houseId: number, lightness = 50): string {
  return `hsl(${getHouseHue(houseId)}, 70%, ${lightness}%)`
}
