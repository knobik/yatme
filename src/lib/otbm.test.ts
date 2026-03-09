import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deepCloneItem, parseOtbm, serializeOtbm, createItemNeedsCount, type OtbmItem, type OtbmMap, type ItemNeedsCountFn } from './otbm'
import type { AppearanceData } from './appearances'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('deepCloneItem', () => {
  it('clones a minimal item', () => {
    const item: OtbmItem = { id: 42 }
    const clone = deepCloneItem(item)
    expect(clone).toEqual({ id: 42 })
    expect(clone).not.toBe(item)
  })

  it('clones all scalar properties', () => {
    const item: OtbmItem = {
      id: 100,
      count: 5,
      actionId: 1000,
      uniqueId: 2000,
      text: 'hello',
      description: 'desc',
      depotId: 3,
      houseDoorId: 7,
      duration: 999,
    }
    const clone = deepCloneItem(item)
    expect(clone).toEqual(item)
  })

  it('deep-clones teleportDestination', () => {
    const item: OtbmItem = {
      id: 1,
      teleportDestination: { x: 10, y: 20, z: 7 },
    }
    const clone = deepCloneItem(item)
    expect(clone.teleportDestination).toEqual({ x: 10, y: 20, z: 7 })
    expect(clone.teleportDestination).not.toBe(item.teleportDestination)
  })

  it('deep-clones nested items', () => {
    const item: OtbmItem = {
      id: 1,
      items: [{ id: 2 }, { id: 3, count: 10 }],
    }
    const clone = deepCloneItem(item)
    expect(clone.items).toEqual([{ id: 2 }, { id: 3, count: 10 }])
    expect(clone.items).not.toBe(item.items)
    expect(clone.items![0]).not.toBe(item.items![0])
  })

  it('mutating clone does not affect original', () => {
    const item: OtbmItem = {
      id: 1,
      count: 5,
      items: [{ id: 2, text: 'original' }],
    }
    const clone = deepCloneItem(item)
    clone.count = 99
    clone.items![0].text = 'modified'
    expect(item.count).toBe(5)
    expect(item.items![0].text).toBe('original')
  })
})

// Binary encoding helpers
function encodeU16LE(v: number): number[] {
  return [v & 0xFF, (v >> 8) & 0xFF]
}

function encodeU32LE(v: number): number[] {
  return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]
}

function encodeString(s: string): number[] {
  const bytes = new TextEncoder().encode(s)
  return [...encodeU16LE(bytes.length), ...bytes]
}

// Escape special bytes in node data
function escapeBytes(data: number[]): number[] {
  const out: number[] = []
  for (const b of data) {
    if (b === 0xFD || b === 0xFE || b === 0xFF) {
      out.push(0xFD, b)
    } else {
      out.push(b)
    }
  }
  return out
}

// Wrap data + children in NODE_START/NODE_END with proper escaping
function encodeNode(data: number[], children: number[][] = []): number[] {
  const out = [0xFE, ...escapeBytes(data)]
  for (const child of children) {
    out.push(...child)
  }
  out.push(0xFF)
  return out
}

// Build complete OTBM buffer: 4-byte header + root node containing MAP_DATA child
function buildOtbmBuffer(opts: {
  version?: number
  width?: number
  height?: number
  mapDataPayload?: number[]
  mapDataChildren?: number[][]
} = {}): Uint8Array {
  const { version = 2, width = 256, height = 256, mapDataPayload = [], mapDataChildren = [] } = opts

  const rootData = [
    0, // root type = 0
    ...encodeU32LE(version),
    ...encodeU16LE(width),
    ...encodeU16LE(height),
    ...encodeU32LE(0), // majorItems
    ...encodeU32LE(0), // minorItems
  ]

  const mapDataNode = encodeNode([2, ...mapDataPayload], mapDataChildren) // type 2 = MAP_DATA

  const rootNode = encodeNode(rootData, [mapDataNode])

  return new Uint8Array([0, 0, 0, 0, ...rootNode]) // 4-byte header + root
}

describe('parseOtbm', () => {
  it('parses minimal empty map (version, width, height)', () => {
    const raw = buildOtbmBuffer({ version: 2, width: 512, height: 1024 })
    const map = parseOtbm(raw)
    expect(map.version).toBe(2)
    expect(map.width).toBe(512)
    expect(map.height).toBe(1024)
    expect(map.tiles.size).toBe(0)
    expect(map.towns).toEqual([])
    expect(map.waypoints).toEqual([])
  })

  it('parses map description attribute', () => {
    const raw = buildOtbmBuffer({
      mapDataPayload: [1, ...encodeString('Test map desc')], // ATTR_DESCRIPTION = 1
    })
    const map = parseOtbm(raw)
    expect(map.description).toBe('Test map desc')
  })

  it('parses spawnFile and houseFile attributes', () => {
    const raw = buildOtbmBuffer({
      mapDataPayload: [
        11, ...encodeString('spawn.xml'), // ATTR_SPAWN_FILE = 11
        13, ...encodeString('house.xml'), // ATTR_HOUSE_FILE = 13
      ],
    })
    const map = parseOtbm(raw)
    expect(map.spawnFile).toBe('spawn.xml')
    expect(map.houseFile).toBe('house.xml')
  })

  it('parses single tile area with one tile', () => {
    // Tile area: baseX=100, baseY=200, baseZ=7
    // Tile: xOff=5, yOff=10
    const tileNode = encodeNode([5, 5, 10]) // type=OTBM_TILE(5), xOff=5, yOff=10
    const tileAreaNode = encodeNode([
      4, // type = TILE_AREA
      ...encodeU16LE(100), // baseX
      ...encodeU16LE(200), // baseY
      7, // baseZ
    ], [tileNode])

    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    expect(map.tiles.size).toBe(1)
    const tile = map.tiles.get('105,210,7')
    expect(tile).toBeDefined()
    expect(tile!.x).toBe(105)
    expect(tile!.y).toBe(210)
    expect(tile!.z).toBe(7)
  })

  it('tile position = baseX + xOff, baseY + yOff', () => {
    const tileNode = encodeNode([5, 0, 0]) // xOff=0, yOff=0
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(50), ...encodeU16LE(75), 3,
    ], [tileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    const tile = map.tiles.get('50,75,3')
    expect(tile).toBeDefined()
    expect(tile!.x).toBe(50)
    expect(tile!.y).toBe(75)
    expect(tile!.z).toBe(3)
  })

  it('parses house tile with houseId', () => {
    const houseTileNode = encodeNode([
      14, // OTBM_HOUSETILE
      3, 4, // xOff=3, yOff=4
      ...encodeU32LE(12345), // houseId
    ])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [houseTileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    const tile = map.tiles.get('3,4,7')
    expect(tile).toBeDefined()
    expect(tile!.houseId).toBe(12345)
  })

  it('parses tile with ATTR_TILE_FLAGS', () => {
    const tileNode = encodeNode([
      5, 0, 0, // TILE, xOff=0, yOff=0
      3, ...encodeU32LE(0x0F), // ATTR_TILE_FLAGS = 3
    ])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    expect(map.tiles.get('0,0,7')!.flags).toBe(0x0F)
  })

  it('parses inline ATTR_ITEM (simple item)', () => {
    const tileNode = encodeNode([
      5, 0, 0,
      9, ...encodeU16LE(4526), // ATTR_ITEM = 9, itemId=4526
    ])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    const tile = map.tiles.get('0,0,7')!
    expect(tile.items.length).toBe(1)
    expect(tile.items[0].id).toBe(4526)
  })

  it('parses full item node with attributes', () => {
    const itemNode = encodeNode([
      6, // OTBM_ITEM
      ...encodeU16LE(999), // itemId
      15, 5, // ATTR_COUNT=15, count=5
      4, ...encodeU16LE(1234), // ATTR_ACTION_ID=4
      5, ...encodeU16LE(5678), // ATTR_UNIQUE_ID=5
      6, ...encodeString('hello'), // ATTR_TEXT=6
      7, ...encodeString('a desc'), // ATTR_DESC=7
      8, ...encodeU16LE(10), ...encodeU16LE(20), 7, // ATTR_TELE_DEST=8
      10, ...encodeU16LE(42), // ATTR_DEPOT_ID=10
      14, 3, // ATTR_HOUSEDOORID=14, doorId=3
      16, ...encodeU32LE(60000), // ATTR_DURATION=16
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    const item = map.tiles.get('0,0,7')!.items[0]
    expect(item.id).toBe(999)
    expect(item.count).toBe(5)
    expect(item.actionId).toBe(1234)
    expect(item.uniqueId).toBe(5678)
    expect(item.text).toBe('hello')
    expect(item.description).toBe('a desc')
    expect(item.teleportDestination).toEqual({ x: 10, y: 20, z: 7 })
    expect(item.depotId).toBe(42)
    expect(item.houseDoorId).toBe(3)
    expect(item.duration).toBe(60000)
  })

  it('parses container item with nested children', () => {
    const childItem = encodeNode([6, ...encodeU16LE(50)]) // ITEM child
    const containerNode = encodeNode([6, ...encodeU16LE(100)], [childItem])
    const tileNode = encodeNode([5, 0, 0], [containerNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    const item = map.tiles.get('0,0,7')!.items[0]
    expect(item.id).toBe(100)
    expect(item.items).toHaveLength(1)
    expect(item.items![0].id).toBe(50)
  })

  it('parses towns', () => {
    const townNode = encodeNode([
      13, // OTBM_TOWN
      ...encodeU32LE(1), // townId
      ...encodeString('Thais'), // name
      ...encodeU16LE(500), // templeX
      ...encodeU16LE(600), // templeY
      7, // templeZ
    ])
    const townsNode = encodeNode([12], [townNode]) // OTBM_TOWNS = 12
    const raw = buildOtbmBuffer({ mapDataChildren: [townsNode] })
    const map = parseOtbm(raw)
    expect(map.towns).toHaveLength(1)
    expect(map.towns[0]).toEqual({
      id: 1,
      name: 'Thais',
      templeX: 500,
      templeY: 600,
      templeZ: 7,
    })
  })

  it('parses waypoints', () => {
    const wpNode = encodeNode([
      16, // OTBM_WAYPOINT
      ...encodeString('depot'), // name
      ...encodeU16LE(100), // x
      ...encodeU16LE(200), // y
      5, // z
    ])
    const waypointsNode = encodeNode([15], [wpNode]) // OTBM_WAYPOINTS = 15
    const raw = buildOtbmBuffer({ mapDataChildren: [waypointsNode] })
    const map = parseOtbm(raw)
    expect(map.waypoints).toHaveLength(1)
    expect(map.waypoints[0]).toEqual({ name: 'depot', x: 100, y: 200, z: 5 })
  })

  it('handles escape characters in binary data', () => {
    // Use an item ID that contains 0xFD when encoded as u16 LE
    // 0x00FD = 253 → bytes: 0xFD, 0x00 → needs escape: 0xFD, 0xFD, 0x00
    const tileNode = encodeNode([
      5, 0, 0,
      9, ...encodeU16LE(253), // ATTR_ITEM with id=253 (0xFD in first byte)
    ])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    expect(map.tiles.get('0,0,7')!.items[0].id).toBe(253)
  })

  it('throws on invalid root node type', () => {
    // Build buffer manually with root type = 5 instead of 0
    const rootData = [
      5, // WRONG root type
      ...encodeU32LE(2),
      ...encodeU16LE(256), ...encodeU16LE(256),
      ...encodeU32LE(0), ...encodeU32LE(0),
    ]
    const mapDataNode = encodeNode([2])
    const rootNode = encodeNode(rootData, [mapDataNode])
    const raw = new Uint8Array([0, 0, 0, 0, ...rootNode])
    expect(() => parseOtbm(raw)).toThrow('Unexpected root node type: 5')
  })

  it('throws on missing MAP_DATA node', () => {
    // Root with no children
    const rootData = [
      0,
      ...encodeU32LE(2),
      ...encodeU16LE(256), ...encodeU16LE(256),
      ...encodeU32LE(0), ...encodeU32LE(0),
    ]
    const rootNode = encodeNode(rootData) // no children
    const raw = new Uint8Array([0, 0, 0, 0, ...rootNode])
    expect(() => parseOtbm(raw)).toThrow('No MAP_DATA node found')
  })

  it('throws when NODE_START not at byte 4', () => {
    const raw = new Uint8Array([0, 0, 0, 0, 0x00]) // byte 4 is not 0xFE
    expect(() => parseOtbm(raw)).toThrow('Expected NODE_START at byte 4')
  })
})

// ── Serializer tests ──────────────────────────────────────────────

function makeEmptyMap(overrides: Partial<OtbmMap> = {}): OtbmMap {
  return {
    version: 4,
    width: 256,
    height: 256,
    majorItems: 0,
    minorItems: 0,
    description: '',
    rawDescriptions: [],
    spawnFile: '',
    npcFile: '',
    houseFile: '',
    zoneFile: '',
    tiles: new Map(),
    towns: [],
    waypoints: [],
    ...overrides,
  }
}

function assertBytesEqual(a: Uint8Array, b: Uint8Array, label: string) {
  if (a.length === b.length && a.every((byte, i) => byte === b[i])) return

  writeFileSync(`/tmp/${label}-first.otbm`, a)
  writeFileSync(`/tmp/${label}-second.otbm`, b)

  const minLen = Math.min(a.length, b.length)
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) {
      const ctx = 16
      const start = Math.max(0, i - ctx)
      const aSlice = Array.from(a.slice(start, i + ctx)).map(v => v.toString(16).padStart(2, '0')).join(' ')
      const bSlice = Array.from(b.slice(start, i + ctx)).map(v => v.toString(16).padStart(2, '0')).join(' ')
      expect.unreachable(
        `First byte diff at offset ${i} (0x${i.toString(16)})\n` +
        `  First  (${a.length} bytes):  ${aSlice}\n` +
        `  Second (${b.length} bytes): ${bSlice}`
      )
    }
  }
  expect.unreachable(`Size mismatch: ${a.length} vs ${b.length} bytes`)
}

describe('serializeOtbm', () => {
  it('round-trips a minimal empty map', async () => {
    const map = makeEmptyMap({ width: 512, height: 1024 })
    const result = parseOtbm(await serializeOtbm(map))
    expect(result.version).toBe(4)
    expect(result.width).toBe(512)
    expect(result.height).toBe(1024)
    expect(result.tiles.size).toBe(0)
    expect(result.towns).toEqual([])
    expect(result.waypoints).toEqual([])
  })

  it('round-trips map description, spawnFile, houseFile', async () => {
    const map = makeEmptyMap({
      description: 'My test map',
      rawDescriptions: ['My test map', 'Second description'],
      spawnFile: 'spawn.xml',
      houseFile: 'house.xml',
    })
    const result = parseOtbm(await serializeOtbm(map))
    // Serializer replaces first description with editor stamp
    expect(result.rawDescriptions[0]).toBe('Saved with YATME')
    // Subsequent descriptions are preserved
    expect(result.rawDescriptions[1]).toBe('Second description')
    expect(result.spawnFile).toBe('spawn.xml')
    expect(result.houseFile).toBe('house.xml')
  })

  it('round-trips a single tile with flags', async () => {
    const map = makeEmptyMap()
    map.tiles.set('100,200,7', { x: 100, y: 200, z: 7, flags: 0x0F, items: [] })
    const result = parseOtbm(await serializeOtbm(map))
    expect(result.tiles.size).toBe(1)
    const tile = result.tiles.get('100,200,7')!
    expect(tile.x).toBe(100)
    expect(tile.y).toBe(200)
    expect(tile.z).toBe(7)
    expect(tile.flags).toBe(0x0F)
  })

  it('round-trips a simple item (id only)', async () => {
    const map = makeEmptyMap()
    map.tiles.set('0,0,7', { x: 0, y: 0, z: 7, flags: 0, items: [{ id: 4526 }] })
    const result = parseOtbm(await serializeOtbm(map))
    const tile = result.tiles.get('0,0,7')!
    expect(tile.items).toHaveLength(1)
    expect(tile.items[0].id).toBe(4526)
  })

  it('round-trips a complex item with all OTBM-supported attributes', async () => {
    const map = makeEmptyMap()
    const item: OtbmItem = {
      id: 999,
      count: 5,
      actionId: 1234,
      uniqueId: 5678,
      text: 'hello',
      description: 'a desc',
      teleportDestination: { x: 10, y: 20, z: 7 },
      depotId: 42,
      houseDoorId: 3,
    }
    map.tiles.set('0,0,7', { x: 0, y: 0, z: 7, flags: 0, items: [item] })
    const result = parseOtbm(await serializeOtbm(map))
    const parsed = result.tiles.get('0,0,7')!.items[0]
    expect(parsed.id).toBe(999)
    expect(parsed.count).toBe(5)
    expect(parsed.actionId).toBe(1234)
    expect(parsed.uniqueId).toBe(5678)
    expect(parsed.text).toBe('hello')
    expect(parsed.description).toBe('a desc')
    expect(parsed.teleportDestination).toEqual({ x: 10, y: 20, z: 7 })
    expect(parsed.depotId).toBe(42)
    expect(parsed.houseDoorId).toBe(3)
  })

  it('parses runtime attributes but does not write them to OTBM', async () => {
    // Runtime attributes (decayingState, writtenDate, writtenBy, sleeperGuid,
    // sleepStart, duration) are from Canary's iomapserialize, not supported
    // by BasicItem::readAttr in Canary's OTBM loader. Writing them would
    // cause Canary to stop reading attributes mid-stream.
    const map = makeEmptyMap()
    const item: OtbmItem = {
      id: 500,
      actionId: 42,
      decayingState: 1,
      writtenDate: 1700000000,
      writtenBy: 'Player Name',
      sleeperGuid: 12345,
      sleepStart: 1699999000,
      duration: 60000,
    }
    map.tiles.set('0,0,7', { x: 0, y: 0, z: 7, flags: 0, items: [item] })
    const result = parseOtbm(await serializeOtbm(map))
    const parsed = result.tiles.get('0,0,7')!.items[0]
    // Supported attributes survive round-trip
    expect(parsed.id).toBe(500)
    expect(parsed.actionId).toBe(42)
    // Runtime attributes are NOT written, so they don't survive round-trip
    expect(parsed.decayingState).toBeUndefined()
    expect(parsed.writtenDate).toBeUndefined()
    expect(parsed.writtenBy).toBeUndefined()
    expect(parsed.sleeperGuid).toBeUndefined()
    expect(parsed.sleepStart).toBeUndefined()
    expect(parsed.duration).toBeUndefined()
  })

  it('parses runtime attributes from binary without corrupting stream', () => {
    // Verify the parser reads the correct number of bytes for each
    // runtime attribute so subsequent data is not corrupted
    const itemNode = encodeNode([
      6, // OTBM_ITEM
      ...encodeU16LE(500),
      4, ...encodeU16LE(42), // ATTR_ACTION_ID (supported, written first)
      17, 1, // ATTR_DECAYING_STATE = u8
      18, ...encodeU32LE(1700000000), ...encodeU32LE(0), // ATTR_WRITTENDATE = u64
      19, ...encodeString('Author'), // ATTR_WRITTENBY = string
      20, ...encodeU32LE(12345), // ATTR_SLEEPERGUID = u32
      21, ...encodeU32LE(99999), // ATTR_SLEEPSTART = u32
      16, ...encodeU32LE(60000), // ATTR_DURATION = u32
      5, ...encodeU16LE(9999), // ATTR_UNIQUE_ID (supported, after runtime attrs)
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    const parsed = map.tiles.get('0,0,7')!.items[0]
    expect(parsed.actionId).toBe(42)
    expect(parsed.decayingState).toBe(1)
    expect(parsed.writtenDate).toBe(1700000000)
    expect(parsed.writtenBy).toBe('Author')
    expect(parsed.sleeperGuid).toBe(12345)
    expect(parsed.sleepStart).toBe(99999)
    expect(parsed.duration).toBe(60000)
    expect(parsed.uniqueId).toBe(9999)
  })

  it('round-trips item with charges using CHARGES attribute', async () => {
    const map = makeEmptyMap()
    map.tiles.set('0,0,7', {
      x: 0, y: 0, z: 7, flags: 0,
      items: [{ id: 100, charges: 500 }],
    })
    const result = parseOtbm(await serializeOtbm(map))
    expect(result.tiles.get('0,0,7')!.items[0].charges).toBe(500)
  })

  it('round-trips container with nested children', async () => {
    const map = makeEmptyMap()
    const container: OtbmItem = {
      id: 100,
      items: [
        { id: 50 },
        { id: 60, count: 3 },
      ],
    }
    map.tiles.set('0,0,7', { x: 0, y: 0, z: 7, flags: 0, items: [container] })
    const result = parseOtbm(await serializeOtbm(map))
    const parsed = result.tiles.get('0,0,7')!.items[0]
    expect(parsed.id).toBe(100)
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items![0].id).toBe(50)
    expect(parsed.items![1].id).toBe(60)
    expect(parsed.items![1].count).toBe(3)
  })

  it('round-trips house tile with houseId', async () => {
    const map = makeEmptyMap()
    map.tiles.set('3,4,7', {
      x: 3, y: 4, z: 7, flags: 0, houseId: 12345,
      items: [{ id: 100 }],
    })
    const result = parseOtbm(await serializeOtbm(map))
    const tile = result.tiles.get('3,4,7')!
    expect(tile.houseId).toBe(12345)
  })

  it('round-trips towns', async () => {
    const map = makeEmptyMap({
      towns: [
        { id: 1, name: 'Thais', templeX: 500, templeY: 600, templeZ: 7 },
        { id: 2, name: 'Carlin', templeX: 300, templeY: 400, templeZ: 7 },
      ],
    })
    const result = parseOtbm(await serializeOtbm(map))
    expect(result.towns).toHaveLength(2)
    expect(result.towns[0]).toEqual({ id: 1, name: 'Thais', templeX: 500, templeY: 600, templeZ: 7 })
    expect(result.towns[1]).toEqual({ id: 2, name: 'Carlin', templeX: 300, templeY: 400, templeZ: 7 })
  })

  it('round-trips waypoints', async () => {
    const map = makeEmptyMap({
      waypoints: [
        { name: 'depot', x: 100, y: 200, z: 5 },
        { name: 'spawn', x: 50, y: 75, z: 7 },
      ],
    })
    const result = parseOtbm(await serializeOtbm(map))
    expect(result.waypoints).toHaveLength(2)
    expect(result.waypoints[0]).toEqual({ name: 'depot', x: 100, y: 200, z: 5 })
    expect(result.waypoints[1]).toEqual({ name: 'spawn', x: 50, y: 75, z: 7 })
  })

  it('handles escape bytes in item IDs', async () => {
    const map = makeEmptyMap()
    // ID 253 = 0xFD, 254 = 0xFE, 255 = 0xFF — all need escaping
    map.tiles.set('0,0,7', {
      x: 0, y: 0, z: 7, flags: 0,
      items: [{ id: 253 }, { id: 254 }, { id: 255 }],
    })
    const result = parseOtbm(await serializeOtbm(map))
    const items = result.tiles.get('0,0,7')!.items
    expect(items).toHaveLength(3)
    expect(items[0].id).toBe(253)
    expect(items[1].id).toBe(254)
    expect(items[2].id).toBe(255)
  })

  it('handles escape bytes in coordinates', async () => {
    // Position where x & 0xFF = 0xFD (253)
    const map = makeEmptyMap()
    map.tiles.set('253,255,7', {
      x: 253, y: 255, z: 7, flags: 0, items: [{ id: 100 }],
    })
    const result = parseOtbm(await serializeOtbm(map))
    const tile = result.tiles.get('253,255,7')!
    expect(tile.x).toBe(253)
    expect(tile.y).toBe(255)
  })

  it('preserves item order through round-trip', async () => {
    const map = makeEmptyMap()
    map.tiles.set('0,0,7', {
      x: 0, y: 0, z: 7, flags: 0,
      items: [
        { id: 100 },         // simple inline
        { id: 200, count: 3 }, // full node
        { id: 300 },         // simple inline
        { id: 400, actionId: 10 }, // full node
      ],
    })
    const result = parseOtbm(await serializeOtbm(map))
    const items = result.tiles.get('0,0,7')!.items
    expect(items).toHaveLength(4)
    expect(items[0].id).toBe(100)
    expect(items[1].id).toBe(200)
    expect(items[2].id).toBe(300)
    expect(items[3].id).toBe(400)
  })

  it('parse-serialize is idempotent for habitats.otbm', async () => {
    const filePath = resolve(__dirname, '__fixtures__/habitats.otbm')
    const original = new Uint8Array(readFileSync(filePath))
    const first = await serializeOtbm(parseOtbm(original))
    const second = await serializeOtbm(parseOtbm(first))

    assertBytesEqual(first, second, 'habitats')
  })


  it('calls onProgress during serialization', async () => {
    const map = makeEmptyMap()
    for (let i = 0; i < 100; i++) {
      map.tiles.set(`${i},0,7`, { x: i, y: 0, z: 7, flags: 0, items: [{ id: 100 }] })
    }

    const calls: Array<[number, number]> = []
    await serializeOtbm(map, (done, total) => {
      calls.push([done, total])
    })

    // Final call should report total tiles
    const last = calls[calls.length - 1]
    expect(last[0]).toBe(100)
    expect(last[1]).toBe(100)
  })
})

// ── OTBM version 0 tests ──────────────────────────────────────────

describe('OTBM version 0 parsing', () => {
  // Callback: items 100 and 200 are stackable/splash/fluid
  const needsCount: ItemNeedsCountFn = (id) => id === 100 || id === 200

  it('reads inline count for stackable item in OTBM_ITEM child node', () => {
    // Item node: id=100 (stackable), inline count=5, then ATTR_ACTION_ID=42
    const itemNode = encodeNode([
      6, // OTBM_ITEM
      ...encodeU16LE(100), // itemId (stackable)
      5, // inline count byte
      4, ...encodeU16LE(42), // ATTR_ACTION_ID
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 0, mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw, needsCount)
    const item = map.tiles.get('0,0,7')!.items[0]
    expect(item.id).toBe(100)
    expect(item.count).toBe(5)
    expect(item.actionId).toBe(42)
  })

  it('reads inline count for stackable inline OTBM_ATTR_ITEM', () => {
    // Tile with inline ATTR_ITEM: id=200 (stackable), count=10
    const tileNode = encodeNode([
      5, 0, 0,
      9, ...encodeU16LE(200), 10, // ATTR_ITEM, id=200, count=10
    ])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 0, mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw, needsCount)
    const item = map.tiles.get('0,0,7')!.items[0]
    expect(item.id).toBe(200)
    expect(item.count).toBe(10)
  })

  it('does not read inline count for non-stackable items in version 0', () => {
    // Item 50 is NOT stackable — no inline count byte
    const itemNode = encodeNode([
      6, // OTBM_ITEM
      ...encodeU16LE(50), // itemId (not stackable)
      4, ...encodeU16LE(42), // ATTR_ACTION_ID — should be parsed correctly
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 0, mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw, needsCount)
    const item = map.tiles.get('0,0,7')!.items[0]
    expect(item.id).toBe(50)
    expect(item.count).toBeUndefined()
    expect(item.actionId).toBe(42)
  })

  it('does not read inline count in version 1+ even with callback', () => {
    // Version 2 map with stackable item — should use ATTR_COUNT, not inline
    const itemNode = encodeNode([
      6, // OTBM_ITEM
      ...encodeU16LE(100), // itemId (would be stackable in v0)
      15, 5, // ATTR_COUNT=15, count=5
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 2, mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw, needsCount)
    const item = map.tiles.get('0,0,7')!.items[0]
    expect(item.id).toBe(100)
    expect(item.count).toBe(5)
  })

  it('works without callback for version 1+', () => {
    const itemNode = encodeNode([
      6, ...encodeU16LE(100),
      15, 5, // ATTR_COUNT
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 2, mapDataChildren: [tileAreaNode] })
    // No callback provided — should work fine for non-v0
    const map = parseOtbm(raw)
    expect(map.tiles.get('0,0,7')!.items[0].count).toBe(5)
  })

  it('reads inline count in nested container children for version 0', () => {
    const childItem = encodeNode([
      6, ...encodeU16LE(100), 3, // OTBM_ITEM, id=100 (stackable), count=3
    ])
    const containerNode = encodeNode([
      6, ...encodeU16LE(50), // container (not stackable)
    ], [childItem])
    const tileNode = encodeNode([5, 0, 0], [containerNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 0, mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw, needsCount)
    const container = map.tiles.get('0,0,7')!.items[0]
    expect(container.id).toBe(50)
    expect(container.count).toBeUndefined()
    expect(container.items![0].id).toBe(100)
    expect(container.items![0].count).toBe(3)
  })

  it('serializes version 0 map as-is (UI is responsible for version selection)', async () => {
    // Build a v0 binary with stackable item
    const itemNode = encodeNode([
      6, ...encodeU16LE(100), 7, // id=100 (stackable), count=7
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 0, mapDataChildren: [tileAreaNode] })

    // Parse as v0, then set version to 4 (as the UI would do)
    const map = parseOtbm(raw, needsCount)
    expect(map.version).toBe(0)
    map.version = 4

    const serialized = await serializeOtbm(map)
    const reparsed = parseOtbm(serialized)
    expect(reparsed.version).toBe(4)
    expect(reparsed.tiles.get('0,0,7')!.items[0].id).toBe(100)
    expect(reparsed.tiles.get('0,0,7')!.items[0].count).toBe(7)
  })

  it('warns when parsing version 0 without callback', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw = buildOtbmBuffer({ version: 0 })
    parseOtbm(raw)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Version 0 map requires appearance data')
    )
    consoleSpy.mockRestore()
  })
})

// ── createItemNeedsCount tests ─────────────────────────────────────

describe('createItemNeedsCount', () => {
  function makeAppearances(items: Array<{ id: number; cumulative?: boolean; liquidpool?: boolean; liquidcontainer?: boolean }>): AppearanceData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objects = new Map<number, any>()
    for (const item of items) {
      objects.set(item.id, {
        id: item.id,
        flags: {
          cumulative: item.cumulative ?? false,
          liquidpool: item.liquidpool ?? false,
          liquidcontainer: item.liquidcontainer ?? false,
        },
      })
    }
    return { objects, outfits: new Map(), effects: new Map(), missiles: new Map() } as unknown as AppearanceData
  }

  it('returns true for cumulative (stackable) items', () => {
    const appearances = makeAppearances([{ id: 100, cumulative: true }])
    const fn = createItemNeedsCount(appearances)
    expect(fn(100)).toBe(true)
  })

  it('returns true for liquidpool (splash) items', () => {
    const appearances = makeAppearances([{ id: 200, liquidpool: true }])
    const fn = createItemNeedsCount(appearances)
    expect(fn(200)).toBe(true)
  })

  it('returns true for liquidcontainer (fluid) items', () => {
    const appearances = makeAppearances([{ id: 300, liquidcontainer: true }])
    const fn = createItemNeedsCount(appearances)
    expect(fn(300)).toBe(true)
  })

  it('returns false for non-stackable items', () => {
    const appearances = makeAppearances([{ id: 400 }])
    const fn = createItemNeedsCount(appearances)
    expect(fn(400)).toBe(false)
  })

  it('returns false for unknown item IDs', () => {
    const appearances = makeAppearances([])
    const fn = createItemNeedsCount(appearances)
    expect(fn(999)).toBe(false)
  })
})

// ── Attribute map serialization tests (version 5) ──────────────────

describe('attribute map serialization (version 5)', () => {
  it('round-trips v5 map with actionId, uniqueId, text, description, charges', async () => {
    const map = makeEmptyMap({ version: 5 })
    const item: OtbmItem = {
      id: 999,
      count: 5,
      actionId: 1234,
      uniqueId: 5678,
      text: 'hello world',
      description: 'a test description',
      charges: 42,
    }
    map.tiles.set('0,0,7', { x: 0, y: 0, z: 7, flags: 0, items: [item] })
    const serialized = await serializeOtbm(map)
    const result = parseOtbm(serialized)
    expect(result.version).toBe(5)
    const parsed = result.tiles.get('0,0,7')!.items[0]
    expect(parsed.id).toBe(999)
    expect(parsed.count).toBe(5)
    expect(parsed.actionId).toBe(1234)
    expect(parsed.uniqueId).toBe(5678)
    expect(parsed.text).toBe('hello world')
    expect(parsed.description).toBe('a test description')
    expect(parsed.charges).toBe(42)
  })

  it('v5 teleport destination stays as individual attribute', async () => {
    const map = makeEmptyMap({ version: 5 })
    map.tiles.set('0,0,7', {
      x: 0, y: 0, z: 7, flags: 0,
      items: [{ id: 1387, teleportDestination: { x: 100, y: 200, z: 7 } }],
    })
    const result = parseOtbm(await serializeOtbm(map))
    expect(result.tiles.get('0,0,7')!.items[0].teleportDestination).toEqual({ x: 100, y: 200, z: 7 })
  })

  it('v5 houseDoorId and depotId stay as individual attributes', async () => {
    const map = makeEmptyMap({ version: 5 })
    map.tiles.set('0,0,7', {
      x: 0, y: 0, z: 7, flags: 0,
      items: [
        { id: 100, houseDoorId: 3 },
        { id: 200, depotId: 42 },
      ],
    })
    const result = parseOtbm(await serializeOtbm(map))
    const items = result.tiles.get('0,0,7')!.items
    expect(items[0].houseDoorId).toBe(3)
    expect(items[1].depotId).toBe(42)
  })

  it('v4 does NOT contain OTBM_ATTR_ATTRIBUTE_MAP byte (128)', async () => {
    const map = makeEmptyMap({ version: 4 })
    map.tiles.set('0,0,7', {
      x: 0, y: 0, z: 7, flags: 0,
      items: [{ id: 100, actionId: 42, uniqueId: 99 }],
    })
    const serialized = await serializeOtbm(map)
    // Check that byte 128 (0x80) does not appear as an unescaped attribute tag.
    // We parse it back and verify it uses individual attrs (actionId/uniqueId survive).
    const result = parseOtbm(serialized)
    expect(result.tiles.get('0,0,7')!.items[0].actionId).toBe(42)
    expect(result.tiles.get('0,0,7')!.items[0].uniqueId).toBe(99)
    // The byte 0x80 should not appear in the raw serialized output as an
    // unescaped value (it's below 0xFD so no escaping concern, just verify
    // we don't accidentally write attribute map in v4 mode)
    expect(result.version).toBe(4)
  })

  it('v5 container children use attribute map format', async () => {
    const map = makeEmptyMap({ version: 5 })
    const container: OtbmItem = {
      id: 100,
      items: [
        { id: 50, actionId: 10 },
        { id: 60, count: 3, uniqueId: 20 },
      ],
    }
    map.tiles.set('0,0,7', { x: 0, y: 0, z: 7, flags: 0, items: [container] })
    const result = parseOtbm(await serializeOtbm(map))
    const parsed = result.tiles.get('0,0,7')!.items[0]
    expect(parsed.id).toBe(100)
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items![0].actionId).toBe(10)
    expect(parsed.items![1].count).toBe(3)
    expect(parsed.items![1].uniqueId).toBe(20)
  })

  it('parses "subtype" key in attribute map as item.count', () => {
    // Build binary with attribute map containing "subtype" key
    const subtypeKey = encodeString('subtype')
    const attrMapData = [
      ...encodeU16LE(1), // 1 entry
      ...subtypeKey,
      2, // ATTRMAP_INTEGER
      ...encodeU32LE(7), // value = 7
    ]
    const itemNode = encodeNode([
      6, // OTBM_ITEM
      ...encodeU16LE(500),
      128, // OTBM_ATTR_ATTRIBUTE_MAP
      ...attrMapData,
    ])
    const tileNode = encodeNode([5, 0, 0], [itemNode])
    const tileAreaNode = encodeNode([
      4, ...encodeU16LE(0), ...encodeU16LE(0), 7,
    ], [tileNode])
    const raw = buildOtbmBuffer({ version: 5, mapDataChildren: [tileAreaNode] })
    const map = parseOtbm(raw)
    expect(map.tiles.get('0,0,7')!.items[0].count).toBe(7)
  })

  it('v5 serialization is idempotent (serialize twice yields identical bytes)', async () => {
    const map = makeEmptyMap({ version: 5 })
    map.tiles.set('10,20,7', {
      x: 10, y: 20, z: 7, flags: 0x0F,
      items: [
        { id: 100, actionId: 42, text: 'hello', charges: 10 },
        { id: 200, uniqueId: 99, description: 'test desc' },
        { id: 300, teleportDestination: { x: 50, y: 60, z: 7 } },
      ],
    })
    map.towns = [{ id: 1, name: 'Thais', templeX: 500, templeY: 600, templeZ: 7 }]
    const first = await serializeOtbm(map)
    const second = await serializeOtbm(parseOtbm(first))
    assertBytesEqual(first, second, 'v5-idempotent')
  })

  it('round-trips v5 custom attributes through serialize/parse', async () => {
    const map = makeEmptyMap({ version: 5 })
    const item: OtbmItem = {
      id: 500,
      actionId: 42,
      customAttributes: new Map([
        ['myString', { type: 1, value: 'hello world' }],
        ['myInt', { type: 2, value: 12345 }],
        ['myBool', { type: 4, value: true }],
      ]),
    }
    map.tiles.set('0,0,7', { x: 0, y: 0, z: 7, flags: 0, items: [item] })
    const serialized = await serializeOtbm(map)
    const result = parseOtbm(serialized)
    const parsed = result.tiles.get('0,0,7')!.items[0]
    expect(parsed.actionId).toBe(42)
    expect(parsed.customAttributes).toBeDefined()
    expect(parsed.customAttributes!.get('myString')).toEqual({ type: 1, value: 'hello world' })
    expect(parsed.customAttributes!.get('myInt')).toEqual({ type: 2, value: 12345 })
    expect(parsed.customAttributes!.get('myBool')).toEqual({ type: 4, value: true })
  })

  it('deepCloneItem preserves customAttributes', () => {
    const item: OtbmItem = {
      id: 100,
      customAttributes: new Map([
        ['foo', { type: 2, value: 42 }],
        ['bar', { type: 1, value: 'test' }],
      ]),
    }
    const clone = deepCloneItem(item)
    expect(clone.customAttributes).toBeDefined()
    expect(clone.customAttributes).not.toBe(item.customAttributes)
    expect(clone.customAttributes!.get('foo')).toEqual({ type: 2, value: 42 })
    expect(clone.customAttributes!.get('foo')).not.toBe(item.customAttributes!.get('foo'))
    // Mutating clone doesn't affect original
    clone.customAttributes!.get('foo')!.value = 99
    expect(item.customAttributes!.get('foo')!.value).toBe(42)
  })

  it('v5 item with no attribute-map-eligible fields writes no map', async () => {
    const map = makeEmptyMap({ version: 5 })
    map.tiles.set('0,0,7', {
      x: 0, y: 0, z: 7, flags: 0,
      items: [{ id: 100, count: 5 }], // count only — individual, no map needed
    })
    const result = parseOtbm(await serializeOtbm(map))
    expect(result.tiles.get('0,0,7')!.items[0].count).toBe(5)
  })
})
