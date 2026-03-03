import { Container, Sprite } from 'pixi.js'
import { getTextureSync } from './TextureManager'
import { getItemSpriteId, type AnimatedSpriteRef } from './SpriteResolver'
import { TILE_SIZE, MAX_ELEVATION } from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmTile, OtbmItem } from './otbm'

// ── TileRenderer ────────────────────────────────────────────────────

export class TileRenderer {
  // Reusable per-tile arrays (avoids allocation per call)
  private _ground: OtbmItem[] = []
  private _bottom: OtbmItem[] = []
  private _common: OtbmItem[] = []
  private _top: OtbmItem[] = []
  private _drawOrder: OtbmItem[] = []

  constructor(private appearances: AppearanceData) {}

  renderTile(
    parent: Container,
    tile: OtbmTile,
    elapsedMs: number,
    animSprites?: AnimatedSpriteRef[],
  ): void {
    const baseX = tile.x * TILE_SIZE
    const baseY = tile.y * TILE_SIZE

    const ground = this._ground; ground.length = 0
    const bottom = this._bottom; bottom.length = 0
    const common = this._common; common.length = 0
    const top = this._top; top.length = 0

    for (const item of tile.items) {
      const appearance = this.appearances.objects.get(item.id)
      const flags = appearance?.flags
      if (flags?.bank) {
        ground.push(item)
      } else if (flags?.clip || flags?.bottom) {
        bottom.push(item)
      } else if (flags?.top) {
        top.push(item)
      } else {
        common.push(item)
      }
    }

    let elevation = 0
    const drawOrder = this._drawOrder; drawOrder.length = 0
    for (let i = 0; i < ground.length; i++) drawOrder.push(ground[i])
    for (let i = 0; i < bottom.length; i++) drawOrder.push(bottom[i])
    for (let i = 0; i < common.length; i++) drawOrder.push(common[i])
    for (let i = 0; i < top.length; i++) drawOrder.push(top[i])

    for (const item of drawOrder) {
      const appearance = this.appearances.objects.get(item.id)
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

      if (animSprites) {
        const info = appearance.frameGroup?.[0]?.spriteInfo
        if (info?.animation && info.animation.spritePhase.length > 1) {
          animSprites.push({ sprite, appearance, item, tile })
        }
      }

      if (appearance.flags?.height?.elevation) {
        elevation = Math.min(elevation + appearance.flags.height.elevation, MAX_ELEVATION)
      }
    }
  }
}
