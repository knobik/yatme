// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadTilesets, resolveTilesets, findEntryInTilesets } from './TilesetLoader'
import type {
  Tileset,
  TilesetCategory,
  ResolvedTileset,
  ResolvedBrushEntry,
  ResolvedItemEntry,
} from './TilesetTypes'
import type { AppearanceData } from '../appearances'
import type { ItemRegistry } from '../items'
import { makeMinimalRegistry, makeGroundBrush, makeWallBrush, makeCarpetBrushWithItems, makeTableBrushWithItems, makeDoodadBrush } from '../../test/brushFixtures'
import { makeAppearanceData, makeAppearanceWithSprite, makeSpriteInfo } from '../../test/fixtures'
import { CARPET_CENTER, TABLE_ALONE } from '../brushes/CarpetTypes'

// ── Helpers ──────────────────────────────────────────────────────────

function makeAppearancesWithSprites(ids: number[]): AppearanceData {
  const objects = new Map()
  for (const id of ids) {
    const app = makeAppearanceWithSprite(makeSpriteInfo())
    app.id = id
    objects.set(id, app)
  }
  return {
    objects,
    outfits: new Map(),
    effects: new Map(),
    missiles: new Map(),
  }
}

function makeItemRegistry(entries: [number, string][]): ItemRegistry {
  const reg: ItemRegistry = new Map()
  for (const [id, name] of entries) {
    reg.set(id, { id, name })
  }
  return reg
}

function makeTileset(name: string, categories: TilesetCategory[]): Tileset {
  return { name, categories }
}

// ── resolveTilesets ──────────────────────────────────────────────────

describe('resolveTilesets', () => {
  it('resolves brush entry in terrain section to ResolvedBrushEntry', () => {
    const groundBrush = makeGroundBrush({
      id: 1,
      name: 'grass',
      lookId: 10,
      items: [{ id: 10, chance: 100 }],
      totalChance: 100,
    })
    const registry = makeMinimalRegistry({ groundBrushes: [groundBrush] })
    const appearances = makeAppearancesWithSprites([10])
    const itemReg = makeItemRegistry([[10, 'Grass']])

    const tilesets: Tileset[] = [
      makeTileset('Nature', [{ type: 'terrain', entries: [{ type: 'brush', name: 'grass' }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Nature')
    expect(result[0].sections).toHaveLength(1)
    expect(result[0].sections[0].type).toBe('terrain')

    const entry = result[0].sections[0].entries[0] as ResolvedBrushEntry
    expect(entry.type).toBe('brush')
    expect(entry.brushType).toBe('ground')
    expect(entry.brushName).toBe('grass')
    expect(entry.lookId).toBe(10)
    expect(entry.displayName).toBe('Grass')
  })

  it('resolves item entry to ResolvedItemEntry', () => {
    const registry = makeMinimalRegistry()
    const appearances = makeAppearancesWithSprites([50])
    const itemReg = makeItemRegistry([[50, 'Magic Sword']])

    const tilesets: Tileset[] = [
      makeTileset('Weapons', [{ type: 'items', entries: [{ type: 'item', id: 50 }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result).toHaveLength(1)
    const entry = result[0].sections[0].entries[0] as ResolvedItemEntry
    expect(entry.type).toBe('item')
    expect(entry.itemId).toBe(50)
    expect(entry.displayName).toBe('Magic Sword')
  })

  it('resolves range entry to individual item entries', () => {
    const registry = makeMinimalRegistry()
    const appearances = makeAppearancesWithSprites([100, 101, 102])
    const itemReg = makeItemRegistry([[100, 'Item A'], [101, 'Item B'], [102, 'Item C']])

    const tilesets: Tileset[] = [
      makeTileset('Range', [{ type: 'raw', entries: [{ type: 'range', fromId: 100, toId: 102 }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result).toHaveLength(1)
    const entries = result[0].sections[0].entries as ResolvedItemEntry[]
    expect(entries).toHaveLength(3)
    expect(entries.map(e => e.itemId)).toEqual([100, 101, 102])
  })

  it('skips items without sprites', () => {
    const registry = makeMinimalRegistry()
    // ID 200 has a sprite, ID 201 does not (no appearance)
    const appearances = makeAppearancesWithSprites([200])
    const itemReg = makeItemRegistry([[200, 'Visible'], [201, 'Invisible']])

    const tilesets: Tileset[] = [
      makeTileset('Mixed', [{
        type: 'items',
        entries: [{ type: 'item', id: 200 }, { type: 'item', id: 201 }],
      }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result).toHaveLength(1)
    const entries = result[0].sections[0].entries as ResolvedItemEntry[]
    expect(entries).toHaveLength(1)
    expect(entries[0].itemId).toBe(200)
  })

  it('deduplicates brushes by name', () => {
    const groundBrush = makeGroundBrush({
      id: 1,
      name: 'grass',
      lookId: 10,
      items: [{ id: 10, chance: 100 }],
      totalChance: 100,
    })
    const registry = makeMinimalRegistry({ groundBrushes: [groundBrush] })
    const appearances = makeAppearancesWithSprites([10])
    const itemReg = makeItemRegistry([[10, 'Grass']])

    const tilesets: Tileset[] = [
      makeTileset('Dupes', [{
        type: 'terrain',
        entries: [
          { type: 'brush', name: 'grass' },
          { type: 'brush', name: 'grass' },
        ],
      }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result[0].sections[0].entries).toHaveLength(1)
  })

  it('deduplicates items by id', () => {
    const registry = makeMinimalRegistry()
    const appearances = makeAppearancesWithSprites([300])
    const itemReg = makeItemRegistry([[300, 'Potion']])

    const tilesets: Tileset[] = [
      makeTileset('Dupes', [{
        type: 'items',
        entries: [
          { type: 'item', id: 300 },
          { type: 'item', id: 300 },
        ],
      }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result[0].sections[0].entries).toHaveLength(1)
  })

  it('brush in items/raw section expands to individual items', () => {
    const groundBrush = makeGroundBrush({
      id: 1,
      name: 'sand',
      lookId: 20,
      items: [
        { id: 20, chance: 50 },
        { id: 21, chance: 50 },
      ],
      totalChance: 100,
    })
    const registry = makeMinimalRegistry({ groundBrushes: [groundBrush] })
    const appearances = makeAppearancesWithSprites([20, 21])
    const itemReg = makeItemRegistry([[20, 'Sand A'], [21, 'Sand B']])

    const tilesets: Tileset[] = [
      makeTileset('Items', [{
        type: 'items',
        entries: [{ type: 'brush', name: 'sand' }],
      }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result).toHaveLength(1)
    const entries = result[0].sections[0].entries as ResolvedItemEntry[]
    expect(entries).toHaveLength(2)
    expect(entries[0].type).toBe('item')
    expect(entries[0].itemId).toBe(20)
    expect(entries[1].itemId).toBe(21)
  })

  it('resolves wall brush entry in terrain section', () => {
    const wallBrush = makeWallBrush({ id: 1, name: 'stone wall', lookId: 40 })
    const registry = makeMinimalRegistry({ wallBrushes: [wallBrush] })
    const appearances = makeAppearancesWithSprites([40])
    const itemReg = makeItemRegistry([])

    const tilesets: Tileset[] = [
      makeTileset('Walls', [{ type: 'terrain', entries: [{ type: 'brush', name: 'stone wall' }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    const entry = result[0].sections[0].entries[0] as ResolvedBrushEntry
    expect(entry.brushType).toBe('wall')
    expect(entry.brushName).toBe('stone wall')
    expect(entry.lookId).toBe(40)
  })

  it('resolves carpet brush entry in terrain section', () => {
    const carpetBrush = makeCarpetBrushWithItems(1, 'red carpet', { [CARPET_CENTER]: 60 })
    carpetBrush.lookId = 60
    const registry = makeMinimalRegistry({ carpetBrushes: [carpetBrush] })
    const appearances = makeAppearancesWithSprites([60])
    const itemReg = makeItemRegistry([])

    const tilesets: Tileset[] = [
      makeTileset('Decor', [{ type: 'terrain', entries: [{ type: 'brush', name: 'red carpet' }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    const entry = result[0].sections[0].entries[0] as ResolvedBrushEntry
    expect(entry.brushType).toBe('carpet')
    expect(entry.brushName).toBe('red carpet')
  })

  it('resolves table brush entry in terrain section', () => {
    const tableBrush = makeTableBrushWithItems(1, 'wooden table', { [TABLE_ALONE]: 70 })
    tableBrush.lookId = 70
    const registry = makeMinimalRegistry({ tableBrushes: [tableBrush] })
    const appearances = makeAppearancesWithSprites([70])
    const itemReg = makeItemRegistry([])

    const tilesets: Tileset[] = [
      makeTileset('Furniture', [{ type: 'terrain', entries: [{ type: 'brush', name: 'wooden table' }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    const entry = result[0].sections[0].entries[0] as ResolvedBrushEntry
    expect(entry.brushType).toBe('table')
    expect(entry.brushName).toBe('wooden table')
  })

  it('resolves doodad brush entry in doodad section', () => {
    const doodadBrush = makeDoodadBrush({
      id: 1, name: 'tree', lookId: 80,
      alternatives: [{ singles: [{ itemId: 80, chance: 1 }], composites: [], totalChance: 1 }],
    })
    const registry = makeMinimalRegistry({ doodadBrushes: [doodadBrush] })
    const appearances = makeAppearancesWithSprites([80])
    const itemReg = makeItemRegistry([])

    const tilesets: Tileset[] = [
      makeTileset('Nature', [{ type: 'doodad', entries: [{ type: 'brush', name: 'tree' }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    const entry = result[0].sections[0].entries[0] as ResolvedBrushEntry
    expect(entry.brushType).toBe('doodad')
    expect(entry.brushName).toBe('tree')
  })

  it('formats brush display name with title case', () => {
    const groundBrush = makeGroundBrush({
      id: 1, name: 'dark grass', lookId: 10,
      items: [{ id: 10, chance: 100 }], totalChance: 100,
    })
    const registry = makeMinimalRegistry({ groundBrushes: [groundBrush] })
    const appearances = makeAppearancesWithSprites([10])
    const itemReg = makeItemRegistry([])

    const tilesets: Tileset[] = [
      makeTileset('T', [{ type: 'terrain', entries: [{ type: 'brush', name: 'dark grass' }] }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    const entry = result[0].sections[0].entries[0] as ResolvedBrushEntry
    expect(entry.displayName).toBe('Dark Grass')
  })

  it('filters out empty tilesets', () => {
    const registry = makeMinimalRegistry()
    // No appearances at all → no sprites → everything skipped
    const appearances = makeAppearanceData([])
    const itemReg = makeItemRegistry([])

    const tilesets: Tileset[] = [
      makeTileset('Empty', [{
        type: 'items',
        entries: [{ type: 'item', id: 999 }],
      }]),
    ]

    const result = resolveTilesets(tilesets, registry, appearances, itemReg)
    expect(result).toHaveLength(0)
  })
})

// ── findEntryInTilesets ──────────────────────────────────────────────

describe('findEntryInTilesets', () => {
  const brushEntry: ResolvedBrushEntry = {
    type: 'brush',
    brushType: 'ground',
    brushName: 'grass',
    lookId: 10,
    displayName: 'Grass',
  }

  const itemEntry: ResolvedItemEntry = {
    type: 'item',
    itemId: 50,
    displayName: 'Magic Sword',
  }

  const doodadBrushEntry: ResolvedBrushEntry = {
    type: 'brush',
    brushType: 'doodad',
    brushName: 'tree',
    lookId: 30,
    displayName: 'Tree',
  }

  const resolvedTilesets: ResolvedTileset[] = [
    {
      name: 'Nature',
      sections: [
        { type: 'terrain', entries: [brushEntry] },
        { type: 'doodad', entries: [doodadBrushEntry] },
      ],
      entryCount: 2,
    },
    {
      name: 'Weapons',
      sections: [
        { type: 'items', entries: [itemEntry] },
      ],
      entryCount: 1,
    },
  ]

  it('finds match by predicate', () => {
    const result = findEntryInTilesets(
      resolvedTilesets,
      (e) => e.type === 'item' && e.itemId === 50,
    )
    expect(result).not.toBeNull()
    expect(result!.entry).toBe(itemEntry)
    expect(result!.tilesetName).toBe('Weapons')
    expect(result!.category).toBe('items')
  })

  it('returns null on no match', () => {
    const result = findEntryInTilesets(
      resolvedTilesets,
      (e) => e.type === 'item' && (e as ResolvedItemEntry).itemId === 9999,
    )
    expect(result).toBeNull()
  })

  it('searches primaryCategory first', () => {
    // doodadBrushEntry is in doodad section; brushEntry is in terrain section
    // Both are type 'brush'. Without primaryCategory, terrain is searched first.
    const result = findEntryInTilesets(
      resolvedTilesets,
      (e) => e.type === 'brush',
      'doodad',
    )
    expect(result).not.toBeNull()
    expect(result!.category).toBe('doodad')
    expect(result!.entry).toBe(doodadBrushEntry)
  })

  it('falls back to other categories when primaryCategory has no match', () => {
    const result = findEntryInTilesets(
      resolvedTilesets,
      (e) => e.type === 'item' && (e as ResolvedItemEntry).itemId === 50,
      'terrain', // primary is terrain, but item is in 'items' section
    )
    expect(result).not.toBeNull()
    expect(result!.category).toBe('items')
    expect(result!.entry).toBe(itemEntry)
  })

  it('returns correct PaletteLocation shape', () => {
    const result = findEntryInTilesets(
      resolvedTilesets,
      (e) => e.type === 'brush' && (e as ResolvedBrushEntry).brushName === 'grass',
    )
    expect(result).not.toBeNull()
    expect(result).toEqual({
      category: 'terrain',
      tilesetName: 'Nature',
      entry: brushEntry,
    })
  })
})

// ── loadTilesets ─────────────────────────────────────────────────────

describe('loadTilesets', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetch(responses: Record<string, string>) {
    const fetchMock = vi.fn((url: string) => {
      const body = responses[url]
      if (body !== undefined) {
        return Promise.resolve({ text: () => Promise.resolve(body) } as Response)
      }
      return Promise.reject(new Error(`Not found: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('fetches master and child tileset files', async () => {
    const masterXml = `<?xml version="1.0"?>
<materials>
  <include file="grounds.xml"/>
  <include file="weapons.xml"/>
</materials>`

    const groundsXml = `<?xml version="1.0"?>
<tileset name="Grounds">
  <terrain>
    <item id="100"/>
  </terrain>
</tileset>`

    const weaponsXml = `<?xml version="1.0"?>
<tileset name="Weapons">
  <items>
    <item id="200"/>
  </items>
</tileset>`

    const fetchMock = mockFetch({
      '/data/materials/tilesets.xml': masterXml,
      '/data/materials/grounds.xml': groundsXml,
      '/data/materials/weapons.xml': weaponsXml,
    })

    const result = await loadTilesets()

    expect(fetchMock).toHaveBeenCalledWith('/data/materials/tilesets.xml')
    expect(fetchMock).toHaveBeenCalledWith('/data/materials/grounds.xml')
    expect(fetchMock).toHaveBeenCalledWith('/data/materials/weapons.xml')
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Grounds')
    expect(result[1].name).toBe('Weapons')
  })

  it('handles failed child fetches gracefully via Promise.allSettled', async () => {
    const masterXml = `<?xml version="1.0"?>
<materials>
  <include file="valid.xml"/>
  <include file="broken.xml"/>
</materials>`

    const validXml = `<?xml version="1.0"?>
<tileset name="Valid">
  <terrain>
    <item id="100"/>
  </terrain>
</tileset>`

    // Only provide valid.xml; broken.xml will reject
    mockFetch({
      '/data/materials/tilesets.xml': masterXml,
      '/data/materials/valid.xml': validXml,
    })

    const result = await loadTilesets()

    // Only the valid tileset should be returned
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Valid')
  })

  it('parses valid tilesets with multiple category types', async () => {
    const masterXml = `<?xml version="1.0"?>
<materials>
  <include file="mixed.xml"/>
</materials>`

    const mixedXml = `<?xml version="1.0"?>
<tileset name="Mixed">
  <terrain>
    <brush name="grass"/>
  </terrain>
  <doodad>
    <brush name="tree"/>
  </doodad>
  <items>
    <item id="500"/>
    <item fromid="600" toid="602"/>
  </items>
  <raw>
    <item id="700"/>
  </raw>
</tileset>`

    mockFetch({
      '/data/materials/tilesets.xml': masterXml,
      '/data/materials/mixed.xml': mixedXml,
    })

    const result = await loadTilesets()
    expect(result).toHaveLength(1)

    const tileset = result[0]
    expect(tileset.name).toBe('Mixed')
    expect(tileset.categories).toHaveLength(4)

    expect(tileset.categories[0].type).toBe('terrain')
    expect(tileset.categories[0].entries).toEqual([{ type: 'brush', name: 'grass' }])

    expect(tileset.categories[1].type).toBe('doodad')
    expect(tileset.categories[1].entries).toEqual([{ type: 'brush', name: 'tree' }])

    expect(tileset.categories[2].type).toBe('items')
    expect(tileset.categories[2].entries).toHaveLength(2)
    expect(tileset.categories[2].entries[0]).toEqual({ type: 'item', id: 500 })
    expect(tileset.categories[2].entries[1]).toEqual({ type: 'range', fromId: 600, toId: 602 })

    expect(tileset.categories[3].type).toBe('raw')
    expect(tileset.categories[3].entries).toEqual([{ type: 'item', id: 700 }])
  })
})
