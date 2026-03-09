import { describe, it, expect } from 'vitest'
import { resolveCreatureSpriteId } from './creatureSprites'
import type { AppearanceData } from './appearances'
import type { CreatureOutfit } from './creatures'
import type { Appearance } from '../proto/appearances'

function makeOutfit(overrides: Partial<CreatureOutfit> = {}): CreatureOutfit {
  return {
    looktype: 0,
    lookitem: 0,
    lookhead: 0,
    lookbody: 0,
    looklegs: 0,
    lookfeet: 0,
    lookaddons: 0,
    ...overrides,
  }
}

function makeAppearance(spriteIds: number[], patternWidth = 4): Appearance {
  return {
    id: 1,
    frameGroup: [{
      fixedFrameGroup: 0,
      id: 0,
      spriteInfo: {
        spriteId: spriteIds,
        patternWidth,
        patternHeight: 1,
        patternDepth: 1,
        layers: 1,
        animation: undefined,
        boundingBoxPerDirection: [],
        isOpaque: false,
        boundingSquare: undefined,
      },
    }],
    flags: {},
    name: '',
  } as unknown as Appearance
}

function makeAppearances(
  outfits?: Map<number, Appearance>,
  objects?: Map<number, Appearance>,
): AppearanceData {
  return {
    objects: objects ?? new Map(),
    outfits: outfits ?? new Map(),
    effects: new Map(),
    missiles: new Map(),
  } as AppearanceData
}

describe('resolveCreatureSpriteId', () => {
  it('returns sprite for looktype outfit with south direction', () => {
    // 4 directions: N=sprite[0], E=sprite[1], S=sprite[2], W=sprite[3]
    const appearance = makeAppearance([100, 101, 102, 103], 4)
    const appearances = makeAppearances(new Map([[10, appearance]]))
    const outfit = makeOutfit({ looktype: 10 })

    const result = resolveCreatureSpriteId(outfit, appearances, 2)
    expect(result).toBe(102)
  })

  it('returns different sprite IDs for different directions', () => {
    const appearance = makeAppearance([100, 101, 102, 103], 4)
    const appearances = makeAppearances(new Map([[10, appearance]]))
    const outfit = makeOutfit({ looktype: 10 })

    const north = resolveCreatureSpriteId(outfit, appearances, 0)
    const east = resolveCreatureSpriteId(outfit, appearances, 1)
    const south = resolveCreatureSpriteId(outfit, appearances, 2)
    const west = resolveCreatureSpriteId(outfit, appearances, 3)

    expect(north).toBe(100)
    expect(east).toBe(101)
    expect(south).toBe(102)
    expect(west).toBe(103)
  })

  it('defaults to south direction when not specified', () => {
    const appearance = makeAppearance([100, 101, 102, 103], 4)
    const appearances = makeAppearances(new Map([[10, appearance]]))
    const outfit = makeOutfit({ looktype: 10 })

    const result = resolveCreatureSpriteId(outfit, appearances)
    expect(result).toBe(102)
  })

  it('falls back to direction 0 when patternWidth is too small', () => {
    // Only 1 direction available
    const appearance = makeAppearance([100], 1)
    const appearances = makeAppearances(new Map([[10, appearance]]))
    const outfit = makeOutfit({ looktype: 10 })

    const result = resolveCreatureSpriteId(outfit, appearances, 2)
    expect(result).toBe(100)
  })

  it('resolves lookitem outfit using item appearance', () => {
    const itemAppearance = makeAppearance([200], 1)
    const appearances = makeAppearances(undefined, new Map([[50, itemAppearance]]))
    const outfit = makeOutfit({ lookitem: 50 })

    const result = resolveCreatureSpriteId(outfit, appearances)
    expect(result).toBe(200)
  })

  it('returns null for unknown looktype', () => {
    const appearances = makeAppearances()
    const outfit = makeOutfit({ looktype: 999 })

    expect(resolveCreatureSpriteId(outfit, appearances)).toBeNull()
  })

  it('returns null for unknown lookitem', () => {
    const appearances = makeAppearances()
    const outfit = makeOutfit({ lookitem: 999 })

    expect(resolveCreatureSpriteId(outfit, appearances)).toBeNull()
  })

  it('returns null when outfit has neither looktype nor lookitem', () => {
    const appearances = makeAppearances()
    const outfit = makeOutfit()

    expect(resolveCreatureSpriteId(outfit, appearances)).toBeNull()
  })

  it('prefers looktype over lookitem when both are set', () => {
    const outfitAppearance = makeAppearance([100, 101, 102, 103], 4)
    const itemAppearance = makeAppearance([200], 1)
    const appearances = makeAppearances(
      new Map([[10, outfitAppearance]]),
      new Map([[50, itemAppearance]]),
    )
    const outfit = makeOutfit({ looktype: 10, lookitem: 50 })

    const result = resolveCreatureSpriteId(outfit, appearances, 2)
    expect(result).toBe(102)
  })
})
