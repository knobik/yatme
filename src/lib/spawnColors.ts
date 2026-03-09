import { hslToHex, goldenAngleHue } from './colorUtils'

/** Golden-angle hue for deterministic spawn coloring, shifted from zone and house colors. */
export function getSpawnHue(spawnIndex: number): number {
  return goldenAngleHue(spawnIndex, 120)
}

/** Spawn color as PixiJS hex number (0xRRGGBB). */
export function spawnColorHex(spawnIndex: number): number {
  return hslToHex(getSpawnHue(spawnIndex), 0.7, 0.5)
}

/** Spawn color as CSS hsl() string. */
export function spawnColorCSS(spawnIndex: number, lightness = 50): string {
  return `hsl(${getSpawnHue(spawnIndex)}, 70%, ${lightness}%)`
}
