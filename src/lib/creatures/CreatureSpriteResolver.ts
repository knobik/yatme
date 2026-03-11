import type { AppearanceData } from '../appearances'
import type { CreatureType } from './types'
import { Direction } from './types'
import { getSpriteIndex, getItemPreviewSpriteId } from '../SpriteResolver'
import { fixedFrameGroup } from '../../proto/appearances'

export class CreatureSpriteResolver {
  private appearances: AppearanceData

  constructor(appearances: AppearanceData) {
    this.appearances = appearances
  }

  /**
   * Resolve a creature's sprite ID for rendering.
   * Returns sprite ID or null if no visual can be resolved.
   */
  resolve(creature: CreatureType, direction: Direction): number | null {
    if (creature.lookType > 0) {
      return this.resolveOutfit(creature.lookType, direction)
    }
    if (creature.lookItem && creature.lookItem > 0) {
      return this.resolveItem(creature.lookItem)
    }
    return null
  }

  /**
   * Preview sprite for palette UI (always SOUTH, idle).
   */
  resolvePreview(creature: CreatureType): number | null {
    return this.resolve(creature, Direction.SOUTH)
  }

  private resolveOutfit(lookType: number, direction: Direction): number | null {
    const appearance = this.appearances.outfits.get(lookType)
    if (!appearance) return null

    const frameGroups = appearance.frameGroup
    if (!frameGroups || frameGroups.length === 0) return null

    // Prefer idle frame group, fall back to first
    const idleGroup =
      frameGroups.find(
        (fg) => fg.fixedFrameGroup === fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_IDLE,
      ) ?? frameGroups[0]

    const spriteInfo = idleGroup.spriteInfo
    if (!spriteInfo || spriteInfo.spriteId.length === 0) return null

    // Direction maps directly to xPattern (North=0, East=1, South=2, West=3)
    return getSpriteIndex(spriteInfo, direction, 0, 0, 0, 0)
  }

  private resolveItem(lookItem: number): number | null {
    const appearance = this.appearances.objects.get(lookItem)
    if (!appearance) return null
    return getItemPreviewSpriteId(appearance)
  }
}
