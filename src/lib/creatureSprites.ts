import type { AppearanceData } from './appearances'
import type { CreatureOutfit } from './creatures'
import { getSpriteIndex, getItemPreviewSpriteId } from './SpriteResolver'

/**
 * Resolve the sprite ID for a creature outfit.
 *
 * @param outfit    The creature's outfit definition
 * @param appearances  Appearance data for lookups
 * @param direction  Facing direction: N=0, E=1, S=2, W=3 (default south)
 * @returns Sprite ID or null if no sprite found
 */
export function resolveCreatureSpriteId(
  outfit: CreatureOutfit,
  appearances: AppearanceData,
  direction: number = 2,
): number | null {
  if (outfit.looktype > 0) {
    const appearance = appearances.outfits.get(outfit.looktype)
    if (!appearance) return null

    const info = appearance.frameGroup?.[0]?.spriteInfo
    if (!info || info.spriteId.length === 0) return null

    const pw = Math.max(1, info.patternWidth)
    const xPattern = pw > direction ? direction : 0

    return getSpriteIndex(info, xPattern, 0)
  }

  if (outfit.lookitem > 0) {
    const appearance = appearances.objects.get(outfit.lookitem)
    if (!appearance) return null
    return getItemPreviewSpriteId(appearance)
  }

  return null
}
