import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from './constants'

// ── Shared icon badge constants ──────────────────────────────────────
export const ICON_SIZE = 10
export const BADGE_RADIUS = 7
export const SHADOW_RADIUS = 8
export const TILE_CENTER = TILE_SIZE / 2

// ── SVG helpers ──────────────────────────────────────────────────────

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// ── Icon badge rendering ─────────────────────────────────────────────

/**
 * Create a standard icon badge (shadow + dark circle with colored ring + icon sprite)
 * at the given center coordinates. Returns a Container with all three elements.
 */
export function createIconBadge(cx: number, cy: number, texture: Texture, ringColor: number): Container {
  const group = new Container()

  // Drop shadow
  const shadow = new Graphics()
  shadow.circle(cx + 1, cy + 1, SHADOW_RADIUS)
  shadow.fill({ color: 0x000000, alpha: 0.4 })
  group.addChild(shadow)

  // Badge background with colored ring
  const badge = new Graphics()
  badge.circle(cx, cy, BADGE_RADIUS)
  badge.fill({ color: 0x12121a, alpha: 0.85 })
  badge.stroke({ color: ringColor, alpha: 0.9, width: 1.5 })
  group.addChild(badge)

  // Icon sprite
  const sprite = new Sprite(texture)
  sprite.width = ICON_SIZE
  sprite.height = ICON_SIZE
  sprite.x = cx - ICON_SIZE / 2
  sprite.y = cy - ICON_SIZE / 2
  sprite.tint = 0xeeeeee
  sprite.alpha = 0.95
  group.addChild(sprite)

  return group
}
