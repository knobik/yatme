import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MAX_ELEVATION } from './constants'
import { makeAppearanceData, makeItem, makeTile } from '../test/fixtures'
import type { AppearanceFlags } from '../proto/appearances'
import type { AppearanceData } from './appearances'
import type { OtbmItem, OtbmTile } from './otbm'

// Mock pixi.js — classes must be defined inside the factory since vi.mock is hoisted
vi.mock('pixi.js', () => {
  class MockSprite {
    x = 0
    y = 0
    roundPixels = false
    texture: unknown
    constructor(texture: unknown) {
      this.texture = texture
    }
  }
  class MockContainer {
    children: MockSprite[] = []
    addChild(child: MockSprite) {
      this.children.push(child)
    }
  }
  return { Sprite: MockSprite, Container: MockContainer }
})

vi.mock('./TextureManager', () => ({
  getTextureSync: vi.fn(),
}))

vi.mock('./SpriteResolver', () => ({
  getItemSpriteId: vi.fn(),
}))

import { renderTileItems } from './renderTileItems'
import { getTextureSync } from './TextureManager'
import { getItemSpriteId } from './SpriteResolver'
import { Container } from 'pixi.js'

const mockedGetTextureSync = vi.mocked(getTextureSync)
const mockedGetItemSpriteId = vi.mocked(getItemSpriteId)

function renderAndGetSprites(
  items: OtbmItem[],
  appearances: AppearanceData,
  tile?: OtbmTile,
  textureSize: { w: number; h: number } = { w: 32, h: 32 },
): { x: number; y: number }[] {
  const t = tile ?? makeTile(5, 5, 7, items)
  mockedGetItemSpriteId.mockReturnValue(1)
  mockedGetTextureSync.mockReturnValue({ width: textureSize.w, height: textureSize.h } as any)

  const parent = new Container()
  renderTileItems({
    parent,
    items,
    tile: t,
    baseX: 0,
    baseY: 0,
    appearances,
  })
  return (parent as any).children as { x: number; y: number }[]
}

describe('renderTileItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('basic 32x32 sprite positioning', () => {
    const appearances = makeAppearanceData([[100, {}]])
    const sprites = renderAndGetSprites([makeItem({ id: 100 })], appearances)

    expect(sprites).toHaveLength(1)
    // x = baseX + TILE_SIZE - width - elevation - shift = 0 + 32 - 32 - 0 - 0 = 0
    expect(sprites[0].x).toBe(0)
    expect(sprites[0].y).toBe(0)
  })

  it('oversized 64x64 sprite anchor offset', () => {
    const appearances = makeAppearanceData([[100, {}]])
    const sprites = renderAndGetSprites([makeItem({ id: 100 })], appearances, undefined, { w: 64, h: 64 })

    // x = 0 + 32 - 64 - 0 - 0 = -32
    expect(sprites[0].x).toBe(-32)
    expect(sprites[0].y).toBe(-32)
  })

  it('elevation accumulation across items', () => {
    const appearances = makeAppearanceData([
      [100, { height: { elevation: 8 } } as Partial<AppearanceFlags>],
      [200, {}],
    ])
    const sprites = renderAndGetSprites(
      [makeItem({ id: 100 }), makeItem({ id: 200 })],
      appearances,
    )

    expect(sprites).toHaveLength(2)
    expect(sprites[0].x).toBe(0)
    expect(sprites[0].y).toBe(0)
    // Second item: elevation=8 accumulated -> x = 0+32-32-8 = -8
    expect(sprites[1].x).toBe(-8)
    expect(sprites[1].y).toBe(-8)
  })

  it('MAX_ELEVATION clamping', () => {
    const appearances = makeAppearanceData([
      [100, { height: { elevation: 20 } } as Partial<AppearanceFlags>],
      [200, { height: { elevation: 20 } } as Partial<AppearanceFlags>],
      [300, {}],
    ])
    const sprites = renderAndGetSprites(
      [makeItem({ id: 100 }), makeItem({ id: 200 }), makeItem({ id: 300 })],
      appearances,
    )

    // After item 1: elevation = min(20, 24) = 20
    // After item 2: elevation = min(20+20, 24) = 24
    // Third item: x = 0+32-32-24 = -24
    expect(sprites[2].x).toBe(-MAX_ELEVATION)
    expect(sprites[2].y).toBe(-MAX_ELEVATION)
  })

  it('shift flags applied', () => {
    const appearances = makeAppearanceData([
      [100, { shift: { x: 5, y: 10 } } as Partial<AppearanceFlags>],
    ])
    const sprites = renderAndGetSprites([makeItem({ id: 100 })], appearances)

    // x = 0+32-32-0-5 = -5, y = 0+32-32-0-10 = -10
    expect(sprites[0].x).toBe(-5)
    expect(sprites[0].y).toBe(-10)
  })

  it('skips items with no matching appearance', () => {
    const appearances = makeAppearanceData([[100, {}]])
    // Item 999 has no appearance entry
    const sprites = renderAndGetSprites(
      [makeItem({ id: 999 }), makeItem({ id: 100 })],
      appearances,
    )
    expect(sprites).toHaveLength(1) // only item 100 rendered
  })

  it('passes tile coordinates to getItemSpriteId for pattern selection', () => {
    const tile = makeTile(10, 20, 7, [makeItem({ id: 100 })])
    const appearances = makeAppearanceData([[100, {}]])
    renderAndGetSprites([makeItem({ id: 100 })], appearances, tile)

    expect(mockedGetItemSpriteId).toHaveBeenCalledWith(
      expect.objectContaining({ id: 100 }),
      expect.objectContaining({ id: 100 }),
      expect.objectContaining({ x: 10, y: 20, z: 7 }),
      undefined,
    )
  })
})
