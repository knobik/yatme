import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeAppearanceData, makeTile, makeItem } from '../test/fixtures'
import type { AppearanceData } from './appearances'
import type { CreatureDatabase } from './creatures/CreatureDatabase'
import type { CreatureSpriteResolver } from './creatures/CreatureSpriteResolver'
import type { CreatureType, TileCreature } from './creatures/types'
import { Direction } from './creatures/types'

// Mock pixi.js
vi.mock('pixi.js', () => {
  class MockSprite {
    x = 0
    y = 0
    tint = 0xFFFFFF
    alpha = 1
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

import { TileRenderer } from './TileRenderer'
import { getTextureSync } from './TextureManager'
import { getItemSpriteId } from './SpriteResolver'
import { Container } from 'pixi.js'

const mockedGetTextureSync = vi.mocked(getTextureSync)
const mockedGetItemSpriteId = vi.mocked(getItemSpriteId)

function makeFakeTexture(w = 32, h = 32) {
  return { width: w, height: h } as unknown as import('pixi.js').Texture
}

function makeCreatureType(name: string, lookType: number, isNpc = false): CreatureType {
  return { name, lookType, isNpc, lookItem: 0 }
}

function makeTileCreature(name: string, isNpc = false): TileCreature {
  return { name, direction: Direction.SOUTH, spawnTime: 60, isNpc }
}

function makeCreatureDb(creatures: CreatureType[]): CreatureDatabase {
  const map = new Map<string, CreatureType>()
  for (const c of creatures) map.set(c.name.toLowerCase(), c)
  return { getByName: (name: string) => map.get(name.toLowerCase()) } as unknown as CreatureDatabase
}

function makeResolver(spriteMap: Map<number, number>): CreatureSpriteResolver {
  return {
    resolve: (creature: CreatureType, _direction: Direction) => spriteMap.get(creature.lookType) ?? null,
    resolvePreview: () => null,
  } as unknown as CreatureSpriteResolver
}

describe('TileRenderer', () => {
  let appearances: AppearanceData

  beforeEach(() => {
    vi.clearAllMocks()
    appearances = makeAppearanceData([[100, {}]])
    mockedGetItemSpriteId.mockReturnValue(1)
    mockedGetTextureSync.mockReturnValue(makeFakeTexture())
  })

  it('renders creatures after items', () => {
    const renderer = new TileRenderer(appearances)
    const rat = makeCreatureType('Rat', 21)
    renderer.creatureDb = makeCreatureDb([rat])
    renderer.creatureSpriteResolver = makeResolver(new Map([[21, 500]]))

    // Return creature texture when spriteId=500
    mockedGetTextureSync.mockImplementation((id: number) =>
      id === 500 ? makeFakeTexture() : makeFakeTexture(),
    )

    const tile = makeTile(5, 5, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeTileCreature('Rat')]

    const parent = new Container()
    renderer.renderTile(parent, tile, 0)

    // Item sprite + creature sprite
    expect(parent.children.length).toBe(2)
  })

  it('showMonsters=false skips monster sprites', () => {
    const renderer = new TileRenderer(appearances)
    const rat = makeCreatureType('Rat', 21)
    renderer.creatureDb = makeCreatureDb([rat])
    renderer.creatureSpriteResolver = makeResolver(new Map([[21, 500]]))
    renderer.showMonsters = false

    const tile = makeTile(5, 5, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeTileCreature('Rat')]

    const parent = new Container()
    renderer.renderTile(parent, tile, 0)

    // Only item sprite, no creature
    expect(parent.children.length).toBe(1)
  })

  it('showNpcs=false skips NPC sprite', () => {
    const renderer = new TileRenderer(appearances)
    const npc = makeCreatureType('Captain', 128, true)
    renderer.creatureDb = makeCreatureDb([npc])
    renderer.creatureSpriteResolver = makeResolver(new Map([[128, 600]]))
    renderer.showNpcs = false

    const tile = makeTile(5, 5, 7, [makeItem({ id: 100 })])
    tile.npc = makeTileCreature('Captain', true)

    const parent = new Container()
    renderer.renderTile(parent, tile, 0)

    // Only item sprite, no NPC
    expect(parent.children.length).toBe(1)
  })

  it('renders monsters first, NPC on top (last child)', () => {
    const renderer = new TileRenderer(appearances)
    const rat = makeCreatureType('Rat', 21)
    const captain = makeCreatureType('Captain', 128, true)
    renderer.creatureDb = makeCreatureDb([rat, captain])
    renderer.creatureSpriteResolver = makeResolver(new Map([[21, 500], [128, 600]]))

    const ratTexture = makeFakeTexture()
    const npcTexture = makeFakeTexture()
    mockedGetTextureSync.mockImplementation((id: number) => {
      if (id === 500) return ratTexture
      if (id === 600) return npcTexture
      return makeFakeTexture()
    })

    const tile = makeTile(5, 5, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeTileCreature('Rat')]
    tile.npc = makeTileCreature('Captain', true)

    const parent = new Container()
    renderer.renderTile(parent, tile, 0)

    // item + monster + NPC = 3 children
    expect(parent.children.length).toBe(3)
    // Last child should use NPC texture
    expect((parent.children[2] as any).texture).toBe(npcTexture)
    // Monster is before NPC
    expect((parent.children[1] as any).texture).toBe(ratTexture)
  })

  it('skips unknown creature names gracefully', () => {
    const renderer = new TileRenderer(appearances)
    renderer.creatureDb = makeCreatureDb([]) // empty db
    renderer.creatureSpriteResolver = makeResolver(new Map())

    const tile = makeTile(5, 5, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeTileCreature('UnknownCreature')]

    const parent = new Container()
    renderer.renderTile(parent, tile, 0)

    // Only item sprite, creature skipped
    expect(parent.children.length).toBe(1)
  })

  it('null resolver renders items without crash', () => {
    const renderer = new TileRenderer(appearances)
    // No resolver or db set

    const tile = makeTile(5, 5, 7, [makeItem({ id: 100 })])
    tile.monsters = [makeTileCreature('Rat')]

    const parent = new Container()
    renderer.renderTile(parent, tile, 0)

    // Only item sprite rendered, no crash
    expect(parent.children.length).toBe(1)
  })
})
