import { describe, it, expect } from 'vitest'
import { CreatureSpriteResolver } from './CreatureSpriteResolver'
import { Direction } from './types'
import type { CreatureType } from './types'
import type { AppearanceData } from '../appearances'
import type { Appearance, FrameGroup, SpriteInfo } from '../../proto/appearances'
import { fixedFrameGroup } from '../../proto/appearances'

function makeSpriteInfo(spriteIds: number[], patternWidth = 4): SpriteInfo {
  return {
    spriteId: spriteIds,
    patternWidth,
    patternHeight: 1,
    patternDepth: 1,
    layers: 1,
    boundingSquare: 0,
    animation: undefined,
    isOpaque: false,
    boundingBoxPerDirection: [],
  }
}

function makeOutfit(
  id: number,
  spriteIds: number[],
  patternWidth = 4,
  frameGroupType: fixedFrameGroup = fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_IDLE,
): Appearance {
  const fg: FrameGroup = {
    fixedFrameGroup: frameGroupType,
    id: 0,
    spriteInfo: makeSpriteInfo(spriteIds, patternWidth),
  }
  return {
    id,
    frameGroup: [fg],
    flags: undefined,
    name: undefined,
    description: undefined,
    flashLight: undefined,
    displacement: undefined,
    cyclopediaItem: undefined,
  } as unknown as Appearance
}

function makeObject(id: number, spriteIds: number[]): Appearance {
  const fg: FrameGroup = {
    fixedFrameGroup: fixedFrameGroup.FIXED_FRAME_GROUP_OBJECT_INITIAL,
    id: 0,
    spriteInfo: makeSpriteInfo(spriteIds, 1),
  }
  return {
    id,
    frameGroup: [fg],
    flags: undefined,
    name: undefined,
    description: undefined,
    flashLight: undefined,
    displacement: undefined,
    cyclopediaItem: undefined,
  } as unknown as Appearance
}

function makeAppearanceData(
  outfits: Appearance[] = [],
  objects: Appearance[] = [],
): AppearanceData {
  return {
    outfits: new Map(outfits.map((o) => [o.id, o])),
    objects: new Map(objects.map((o) => [o.id, o])),
    effects: new Map(),
    missiles: new Map(),
  }
}

function makeCreature(overrides: Partial<CreatureType> = {}): CreatureType {
  return {
    name: 'Test Creature',
    lookType: 0,
    isNpc: false,
    ...overrides,
  }
}

describe('CreatureSpriteResolver', () => {
  it('resolves lookType to correct sprite ID', () => {
    // Arrange: outfit with 4 direction sprites (N=100, E=101, S=102, W=103)
    const outfit = makeOutfit(130, [100, 101, 102, 103])
    const data = makeAppearanceData([outfit])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 130 })

    // Act
    const spriteId = resolver.resolve(creature, Direction.SOUTH)

    // Assert — SOUTH=2, so xPattern=2 → spriteId[2]=102
    expect(spriteId).toBe(102)
  })

  it('produces different sprite IDs for different directions', () => {
    const outfit = makeOutfit(130, [100, 101, 102, 103])
    const data = makeAppearanceData([outfit])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 130 })

    const north = resolver.resolve(creature, Direction.NORTH)
    const east = resolver.resolve(creature, Direction.EAST)
    const south = resolver.resolve(creature, Direction.SOUTH)
    const west = resolver.resolve(creature, Direction.WEST)

    expect(north).toBe(100)
    expect(east).toBe(101)
    expect(south).toBe(102)
    expect(west).toBe(103)
  })

  it('resolves lookItem when lookType is 0', () => {
    const obj = makeObject(2148, [500])
    const data = makeAppearanceData([], [obj])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 0, lookItem: 2148 })

    const spriteId = resolver.resolve(creature, Direction.SOUTH)

    expect(spriteId).toBe(500)
  })

  it('returns null for unknown lookType', () => {
    const data = makeAppearanceData()
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 9999 })

    expect(resolver.resolve(creature, Direction.SOUTH)).toBeNull()
  })

  it('returns null for unknown lookItem', () => {
    const data = makeAppearanceData()
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 0, lookItem: 9999 })

    expect(resolver.resolve(creature, Direction.SOUTH)).toBeNull()
  })

  it('returns null when both lookType and lookItem are 0', () => {
    const data = makeAppearanceData()
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 0, lookItem: 0 })

    expect(resolver.resolve(creature, Direction.SOUTH)).toBeNull()
  })

  it('resolvePreview uses Direction.SOUTH', () => {
    const outfit = makeOutfit(130, [100, 101, 102, 103])
    const data = makeAppearanceData([outfit])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 130 })

    const preview = resolver.resolvePreview(creature)

    // SOUTH=2 → spriteId[2]=102
    expect(preview).toBe(102)
  })

  it('returns null when outfit has empty frameGroup', () => {
    const appearance: Appearance = {
      id: 130,
      frameGroup: [],
      flags: undefined,
      name: undefined,
      description: undefined,
      flashLight: undefined,
      displacement: undefined,
      cyclopediaItem: undefined,
    } as unknown as Appearance
    const data = makeAppearanceData([appearance])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 130 })

    expect(resolver.resolve(creature, Direction.SOUTH)).toBeNull()
  })

  it('returns null when spriteInfo is missing from frameGroup', () => {
    const appearance: Appearance = {
      id: 130,
      frameGroup: [
        {
          fixedFrameGroup: fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_IDLE,
          id: 0,
          spriteInfo: undefined,
        },
      ],
      flags: undefined,
      name: undefined,
      description: undefined,
      flashLight: undefined,
      displacement: undefined,
      cyclopediaItem: undefined,
    } as unknown as Appearance
    const data = makeAppearanceData([appearance])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 130 })

    expect(resolver.resolve(creature, Direction.SOUTH)).toBeNull()
  })

  it('falls back to first frameGroup when idle group is missing', () => {
    // Only has a MOVING frame group, no IDLE
    const outfit = makeOutfit(
      130,
      [200, 201, 202, 203],
      4,
      fixedFrameGroup.FIXED_FRAME_GROUP_OUTFIT_MOVING,
    )
    const data = makeAppearanceData([outfit])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 130 })

    expect(resolver.resolve(creature, Direction.SOUTH)).toBe(202)
  })

  it('prefers lookType over lookItem when both are set', () => {
    const outfit = makeOutfit(130, [100, 101, 102, 103])
    const obj = makeObject(2148, [500])
    const data = makeAppearanceData([outfit], [obj])
    const resolver = new CreatureSpriteResolver(data)
    const creature = makeCreature({ lookType: 130, lookItem: 2148 })

    expect(resolver.resolve(creature, Direction.SOUTH)).toBe(102)
  })
})
