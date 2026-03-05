import { Container, Sprite } from 'pixi.js'
import { Appearance } from '../proto/appearances'
import { getTextureSync } from './TextureManager'
import { getItemSpriteId } from './SpriteResolver'
import { TILE_SIZE, MAX_ELEVATION } from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmTile, OtbmItem } from './otbm'

export interface RenderTileItemsOptions {
  parent: Container
  items: OtbmItem[]
  tile: OtbmTile
  baseX: number
  baseY: number
  appearances: AppearanceData
  elapsedMs?: number
  /** Called after each sprite is added to the parent. */
  onSprite?: (sprite: Sprite, item: OtbmItem, appearance: Appearance) => void
}

/**
 * Shared tile-item rendering loop: resolves sprites, positions them with
 * bottom-right anchor + elevation + shift, and accumulates elevation.
 */
export function renderTileItems(opts: RenderTileItemsOptions): void {
  const { parent, items, tile, baseX, baseY, appearances, elapsedMs, onSprite } = opts
  let elevation = 0

  for (const item of items) {
    const appearance = appearances.objects.get(item.id)
    if (!appearance) continue

    const spriteId = getItemSpriteId(appearance, item, tile, elapsedMs)
    if (spriteId == null || spriteId === 0) continue

    const texture = getTextureSync(spriteId)
    if (!texture) continue

    const sprite = new Sprite(texture)
    sprite.roundPixels = true

    const shift = appearance.flags?.shift
    sprite.x = baseX + TILE_SIZE - texture.width - elevation - (shift?.x ?? 0)
    sprite.y = baseY + TILE_SIZE - texture.height - elevation - (shift?.y ?? 0)

    parent.addChild(sprite)

    if (onSprite) onSprite(sprite, item, appearance)

    if (appearance.flags?.height?.elevation) {
      elevation = Math.min(elevation + appearance.flags.height.elevation, MAX_ELEVATION)
    }
  }
}
