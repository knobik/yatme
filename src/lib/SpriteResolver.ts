import type { Sprite } from 'pixi.js'
import type { Appearance, SpriteInfo, SpriteAnimation } from '../proto/appearances'
import type { OtbmItem, OtbmTile } from './otbm'

/** Ref to an animated sprite for in-place texture updates (avoids chunk rebuild). */
export interface AnimatedSpriteRef {
  sprite: Sprite
  appearance: Appearance
  item: OtbmItem
  tile: OtbmTile
}

// ── Sprite index calculation ────────────────────────────────────────

export function getSpriteIndex(
  info: SpriteInfo,
  xPattern: number,
  yPattern: number,
  zPattern: number = 0,
  layer: number = 0,
  animPhase: number = 0,
): number {
  const phases = info.animation?.spritePhase?.length ?? 1
  const index =
    ((((animPhase % Math.max(1, phases)) * Math.max(1, info.patternDepth) + zPattern) *
      Math.max(1, info.patternHeight) +
      yPattern) *
      Math.max(1, info.patternWidth) +
      xPattern) *
      Math.max(1, info.layers) +
    layer
  return info.spriteId[index] ?? info.spriteId[0] ?? 0
}

export function getItemSpriteId(
  appearance: Appearance,
  item: OtbmItem,
  tile: OtbmTile,
  elapsedMs: number = 0,
  overridePhase?: number,
): number | null {
  const info = appearance.frameGroup?.[0]?.spriteInfo
  if (!info || info.spriteId.length === 0) return null

  const flags = appearance.flags
  const pw = Math.max(1, info.patternWidth)
  const ph = Math.max(1, info.patternHeight)
  const pd = Math.max(1, info.patternDepth)

  let xPattern = 0
  let yPattern = 0
  let zPattern = 0

  if (flags?.cumulative && pw === 4 && ph === 2) {
    // Stackable items: pattern based on count
    const count = item.count ?? 1
    if (count <= 0) {
      xPattern = 0; yPattern = 0
    } else if (count < 5) {
      xPattern = count - 1; yPattern = 0
    } else if (count < 10) {
      xPattern = 0; yPattern = 1
    } else if (count < 25) {
      xPattern = 1; yPattern = 1
    } else if (count < 50) {
      xPattern = 2; yPattern = 1
    } else {
      xPattern = 3; yPattern = 1
    }
  } else if (flags?.hang) {
    // Hangable items: pattern based on hook direction
    xPattern = 0
  } else if (flags?.liquidcontainer || flags?.liquidpool) {
    // Fluid items: pattern based on fluid type (stored in count)
    const color = item.count ?? 0
    xPattern = (color % 4) % pw
    yPattern = Math.floor(color / 4) % ph
  } else {
    // Regular items: pattern based on tile position
    xPattern = tile.x % pw
    yPattern = tile.y % ph
    zPattern = tile.z % pd
  }

  // Compute animation phase
  let animPhase = overridePhase ?? 0
  if (overridePhase === undefined && info.animation && info.animation.spritePhase.length > 1) {
    animPhase = getAnimationPhase(info.animation, elapsedMs)
  }

  return getSpriteIndex(info, xPattern, yPattern, zPattern, 0, animPhase)
}

// ── Animation phase calculation ─────────────────────────────────────

/** Precompute average durations for an animation (avoids per-frame allocation). */
function getAvgDurations(animation: SpriteAnimation): number[] {
  return animation.spritePhase.map(p => (p.durationMin + p.durationMax) / 2)
}

/** Animation duration cache — keyed by animation object identity. */
const animDurationCache = new WeakMap<SpriteAnimation, { durations: number[], total: number }>()

function getCachedDurations(animation: SpriteAnimation): { durations: number[], total: number } {
  let cached = animDurationCache.get(animation)
  if (!cached) {
    const durations = getAvgDurations(animation)
    const total = durations.reduce((a, b) => a + b, 0)
    cached = { durations, total }
    animDurationCache.set(animation, cached)
  }
  return cached
}

export function getAnimationPhase(animation: SpriteAnimation, elapsedMs: number): number {
  const phases = animation.spritePhase
  if (!phases || phases.length <= 1) return 0

  const { durations, total } = getCachedDurations(animation)
  if (total <= 0) return 0

  if (animation.loopType === -1) { // PINGPONG
    let backwardDuration = 0
    for (let i = phases.length - 2; i >= 1; i--) {
      backwardDuration += durations[i]
    }
    const cycleDuration = total + backwardDuration
    if (cycleDuration <= 0) return 0

    const t = elapsedMs % cycleDuration
    let accum = 0
    // Forward pass
    for (let i = 0; i < phases.length; i++) {
      accum += durations[i]
      if (t < accum) return i
    }
    // Backward pass
    for (let i = phases.length - 2; i >= 1; i--) {
      accum += durations[i]
      if (t < accum) return i
    }
    return 0
  }

  // INFINITE or COUNTED (treat counted as infinite for map viewer)
  const t = elapsedMs % total
  let accum = 0
  for (let i = 0; i < phases.length; i++) {
    accum += durations[i]
    if (t < accum) return i
  }
  return phases.length - 1
}
