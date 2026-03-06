import { describe, it, expect } from 'vitest'
import { getSpriteIndex, getAnimationPhase, getItemSpriteId } from './SpriteResolver'
import { makeSpriteInfo, makeSpriteAnimation, makeAppearanceWithSprite, makeTile, makeItem } from '../test/fixtures'
import type { Appearance } from '../proto/appearances'

describe('getSpriteIndex', () => {
  it('returns first sprite for simple 1x1 item', () => {
    const info = makeSpriteInfo({ spriteId: [42] })
    expect(getSpriteIndex(info, 0, 0)).toBe(42)
  })

  it('selects by xPattern (patternWidth)', () => {
    const info = makeSpriteInfo({ patternWidth: 2, spriteId: [10, 20] })
    expect(getSpriteIndex(info, 0, 0)).toBe(10)
    expect(getSpriteIndex(info, 1, 0)).toBe(20)
  })

  it('selects by yPattern (patternHeight)', () => {
    const info = makeSpriteInfo({ patternWidth: 1, patternHeight: 2, spriteId: [10, 20] })
    expect(getSpriteIndex(info, 0, 0)).toBe(10)
    expect(getSpriteIndex(info, 0, 1)).toBe(20)
  })

  it('handles animation phase', () => {
    const info = makeSpriteInfo({
      spriteId: [10, 20, 30],
      animation: makeSpriteAnimation(3),
    })
    expect(getSpriteIndex(info, 0, 0, 0, 0, 0)).toBe(10)
    expect(getSpriteIndex(info, 0, 0, 0, 0, 1)).toBe(20)
    expect(getSpriteIndex(info, 0, 0, 0, 0, 2)).toBe(30)
  })

  it('handles layers', () => {
    const info = makeSpriteInfo({ layers: 2, spriteId: [10, 20] })
    expect(getSpriteIndex(info, 0, 0, 0, 0)).toBe(10)
    expect(getSpriteIndex(info, 0, 0, 0, 1)).toBe(20)
  })

  it('falls back to spriteId[0] for out-of-bounds index', () => {
    const info = makeSpriteInfo({ spriteId: [99] })
    expect(getSpriteIndex(info, 5, 5)).toBe(99)
  })

  it('returns 0 for empty spriteId array', () => {
    const info = makeSpriteInfo({ spriteId: [] })
    expect(getSpriteIndex(info, 0, 0)).toBe(0)
  })
})

describe('getAnimationPhase', () => {
  it('returns 0 for single phase', () => {
    const anim = makeSpriteAnimation(1)
    expect(getAnimationPhase(anim, 500)).toBe(0)
  })

  it('cycles through phases for INFINITE (loopType=0)', () => {
    const anim = makeSpriteAnimation(3, 0) // 3 phases, 100ms each
    expect(getAnimationPhase(anim, 0)).toBe(0)
    expect(getAnimationPhase(anim, 50)).toBe(0)
    expect(getAnimationPhase(anim, 100)).toBe(1)
    expect(getAnimationPhase(anim, 250)).toBe(2)
  })

  it('wraps around for INFINITE', () => {
    const anim = makeSpriteAnimation(3, 0) // total = 300ms
    expect(getAnimationPhase(anim, 300)).toBe(0) // wraps to t=0
    expect(getAnimationPhase(anim, 400)).toBe(1) // wraps to t=100
  })

  it('ping-pongs for loopType=-1', () => {
    const anim = makeSpriteAnimation(3, -1) // phases 0,1,2 then 1 back
    // Forward: 0(0-100), 1(100-200), 2(200-300)
    // Backward: 1(300-400)
    // Cycle = 300 + 100 = 400
    expect(getAnimationPhase(anim, 0)).toBe(0)
    expect(getAnimationPhase(anim, 150)).toBe(1)
    expect(getAnimationPhase(anim, 250)).toBe(2)
    expect(getAnimationPhase(anim, 350)).toBe(1) // backward pass
  })

  it('returns 0 for zero total duration', () => {
    const anim = {
      ...makeSpriteAnimation(2),
      spritePhase: [
        { durationMin: 0, durationMax: 0 },
        { durationMin: 0, durationMax: 0 },
      ],
    }
    expect(getAnimationPhase(anim, 100)).toBe(0)
  })
})

describe('getItemSpriteId', () => {
  it('returns null when no frameGroup', () => {
    const appearance: Appearance = { id: 1, frameGroup: [], flags: undefined, name: '', description: '' }
    expect(getItemSpriteId(appearance, makeItem(), makeTile(0, 0, 7))).toBeNull()
  })

  it('returns sprite based on tile position pattern', () => {
    const info = makeSpriteInfo({ patternWidth: 2, spriteId: [10, 20] })
    const appearance = makeAppearanceWithSprite(info)
    expect(getItemSpriteId(appearance, makeItem(), makeTile(0, 0, 7))).toBe(10)
    expect(getItemSpriteId(appearance, makeItem(), makeTile(1, 0, 7))).toBe(20)
  })

  it('handles stackable items (cumulative flag)', () => {
    const info = makeSpriteInfo({
      patternWidth: 4,
      patternHeight: 2,
      spriteId: [0, 1, 2, 3, 4, 5, 6, 7],
    })
    const appearance = makeAppearanceWithSprite(info, { cumulative: true })
    // count=1 → xPattern=0, yPattern=0
    expect(getItemSpriteId(appearance, makeItem({ count: 1 }), makeTile(0, 0, 7))).toBe(0)
    // count=3 → xPattern=2, yPattern=0
    expect(getItemSpriteId(appearance, makeItem({ count: 3 }), makeTile(0, 0, 7))).toBe(2)
    // count=50 → xPattern=3, yPattern=1
    expect(getItemSpriteId(appearance, makeItem({ count: 50 }), makeTile(0, 0, 7))).toBe(7)
  })

  it('respects overridePhase', () => {
    const info = makeSpriteInfo({
      spriteId: [10, 20, 30],
      animation: makeSpriteAnimation(3),
    })
    const appearance = makeAppearanceWithSprite(info)
    expect(getItemSpriteId(appearance, makeItem(), makeTile(0, 0, 7), 0, 2)).toBe(30)
  })
})
