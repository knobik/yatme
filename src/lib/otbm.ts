// ── OTBM binary map parser ──────────────────────────────────────────

import { yieldToMain } from './yieldToMain'
import type { AppearanceData } from './appearances'
import type { TileCreature } from './creatures/types'

// Shared encoder/decoder instances (avoid allocating per call)
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// Special bytes in the binary tree encoding
const NODE_START = 0xfe
const NODE_END = 0xff
const ESCAPE_CHAR = 0xfd

// OTBM node types
const OTBM_MAP_DATA = 2
const OTBM_TILE_AREA = 4
const OTBM_TILE = 5
const OTBM_ITEM = 6
const OTBM_TOWNS = 12
const OTBM_TOWN = 13
const OTBM_HOUSETILE = 14
const OTBM_WAYPOINTS = 15
const OTBM_WAYPOINT = 16
const OTBM_TILE_ZONE = 19

// Tile/map attributes
const OTBM_ATTR_DESCRIPTION = 1
const OTBM_ATTR_TILE_FLAGS = 3
const OTBM_ATTR_ACTION_ID = 4
const OTBM_ATTR_UNIQUE_ID = 5
const OTBM_ATTR_TEXT = 6
const OTBM_ATTR_DESC = 7
const OTBM_ATTR_TELE_DEST = 8
const OTBM_ATTR_ITEM = 9
const OTBM_ATTR_DEPOT_ID = 10
const OTBM_ATTR_SPAWN_FILE = 11
const OTBM_ATTR_RUNE_CHARGES = 12
const OTBM_ATTR_HOUSE_FILE = 13
const OTBM_ATTR_HOUSEDOORID = 14
const OTBM_ATTR_COUNT = 15
const OTBM_ATTR_DURATION = 16
const OTBM_ATTR_DECAYING_STATE = 17
const OTBM_ATTR_WRITTENDATE = 18
const OTBM_ATTR_WRITTENBY = 19
const OTBM_ATTR_SLEEPERGUID = 20
const OTBM_ATTR_SLEEPSTART = 21
const OTBM_ATTR_CHARGES = 22
const OTBM_ATTR_CONTAINER_ITEMS = 23
const OTBM_ATTR_EXT_SPAWN_NPC_FILE = 23
const OTBM_ATTR_EXT_ZONE_FILE = 24
const OTBM_ATTR_ATTRIBUTE_MAP = 128

// ── Map bounds (RME convention) ─────────────────────────────────────

export const MAP_MAX_WIDTH = 65000
export const MAP_MAX_HEIGHT = 65000
export const MAP_MIN_LAYER = 0
export const MAP_MAX_LAYER = 15

/** Tile flag: Protection Zone */
export const PZ_FLAG = 0x0001

/** Check whether a tile coordinate is within the valid map range. */
export function tileKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

export function isPositionValid(x: number, y: number, z: number): boolean {
  return x >= 0 && x <= MAP_MAX_WIDTH
    && y >= 0 && y <= MAP_MAX_HEIGHT
    && z >= MAP_MIN_LAYER && z <= MAP_MAX_LAYER
}

// ── Data types ──────────────────────────────────────────────────────

export interface OtbmMap {
  version: number
  width: number
  height: number
  majorItems: number
  minorItems: number
  description: string
  /** Individual OTBM_ATTR_DESCRIPTION entries (concatenated → description) */
  rawDescriptions: string[]
  spawnFile: string
  npcFile: string
  houseFile: string
  zoneFile: string
  tiles: Map<string, OtbmTile>
  towns: OtbmTown[]
  waypoints: OtbmWaypoint[]
  /** Original tile area grouping for byte-identical serialization.
   *  Each entry is [baseX, baseY, baseZ, ...tileKeys] */
  _areaSequence?: Array<{ baseX: number; baseY: number; baseZ: number; tileKeys: string[] }>
}

export function createEmptyMap(): OtbmMap {
  return {
    version: 4,
    width: 65535,
    height: 65535,
    majorItems: 4,
    minorItems: 4,
    description: '',
    rawDescriptions: [],
    spawnFile: '',
    npcFile: '',
    houseFile: '',
    zoneFile: '',
    tiles: new Map(),
    towns: [],
    waypoints: [],
  }
}

export interface OtbmTile {
  x: number
  y: number
  z: number
  flags: number
  houseId?: number
  items: OtbmItem[]
  zones?: number[]
  monsters?: TileCreature[]
  npc?: TileCreature
  spawnMonster?: { radius: number }
  spawnNpc?: { radius: number }
  /** Number of items that were stored as inline OTBM_ATTR_ITEM in the original file */
  inlineItemCount?: number
  /** Original tile order index within its area node (for byte-identical serialization) */
  _areaOrder?: number
}

export interface OtbmItem {
  id: number
  count?: number
  /** When both ATTR_COUNT and ATTR_CHARGES are present in the original file */
  charges?: number
  actionId?: number
  uniqueId?: number
  text?: string
  description?: string
  teleportDestination?: { x: number; y: number; z: number }
  depotId?: number
  houseDoorId?: number
  duration?: number
  decayingState?: number
  writtenDate?: number
  writtenBy?: string
  sleeperGuid?: number
  sleepStart?: number
  items?: OtbmItem[]
  /** Arbitrary key-value attributes from OTBM v5 attribute map (unknown keys only) */
  customAttributes?: Map<string, { type: number; value: string | number | boolean }>
}

/** Apply partial properties onto an item, returning a new deep-cloned result. */
export function applyItemProperties(item: OtbmItem, props: Partial<OtbmItem>): OtbmItem {
  return deepCloneItem({ ...item, ...props } as OtbmItem)
}

export function deepCloneItem(item: OtbmItem): OtbmItem {
  const clone: OtbmItem = { id: item.id }
  if (item.count != null) clone.count = item.count
  if (item.charges != null) clone.charges = item.charges
  if (item.actionId != null) clone.actionId = item.actionId
  if (item.uniqueId != null) clone.uniqueId = item.uniqueId
  if (item.text != null) clone.text = item.text
  if (item.description != null) clone.description = item.description
  if (item.teleportDestination) clone.teleportDestination = { ...item.teleportDestination }
  if (item.depotId != null) clone.depotId = item.depotId
  if (item.houseDoorId != null) clone.houseDoorId = item.houseDoorId
  if (item.duration != null) clone.duration = item.duration
  if (item.decayingState != null) clone.decayingState = item.decayingState
  if (item.writtenDate != null) clone.writtenDate = item.writtenDate
  if (item.writtenBy != null) clone.writtenBy = item.writtenBy
  if (item.sleeperGuid != null) clone.sleeperGuid = item.sleeperGuid
  if (item.sleepStart != null) clone.sleepStart = item.sleepStart
  if (item.items && item.items.length > 0) clone.items = item.items.map(deepCloneItem)
  if (item.customAttributes && item.customAttributes.size > 0) {
    clone.customAttributes = new Map(
      [...item.customAttributes].map(([k, v]) => [k, { ...v }])
    )
  }
  return clone
}

export interface OtbmTown {
  id: number
  name: string
  templeX: number
  templeY: number
  templeZ: number
}

export interface OtbmWaypoint {
  name: string
  x: number
  y: number
  z: number
}

// ── Version 0 item count callback ──────────────────────────────────

/**
 * For OTBM version 0, stackable/splash/fluid items have an inline u8 count
 * byte after their ID. This callback returns true for such items.
 */
export type ItemNeedsCountFn = (id: number) => boolean

/**
 * Create an ItemNeedsCountFn from loaded appearance data.
 * Maps to RME's `type.stackable || type.isSplash() || type.isFluidContainer()`.
 */
export function createItemNeedsCount(appearances: AppearanceData): ItemNeedsCountFn {
  return (id: number): boolean => {
    const appearance = appearances.objects.get(id)
    if (!appearance?.flags) return false
    const flags = appearance.flags
    return !!(flags.cumulative || flags.liquidpool || flags.liquidcontainer)
  }
}

// ── Binary tree node ────────────────────────────────────────────────

class BinaryNode {
  readonly data: DataView
  readonly children: BinaryNode[]
  private cursor = 0

  constructor(data: ArrayBuffer, children: BinaryNode[]) {
    this.data = new DataView(data)
    this.children = children
  }

  canRead(): boolean {
    return this.cursor < this.data.byteLength
  }

  readU8(): number {
    const v = this.data.getUint8(this.cursor)
    this.cursor += 1
    return v
  }

  readU16(): number {
    const v = this.data.getUint16(this.cursor, true)
    this.cursor += 2
    return v
  }

  readU32(): number {
    const v = this.data.getUint32(this.cursor, true)
    this.cursor += 4
    return v
  }

  // Read 64-bit unsigned integer as JS number (safe for values < 2^53)
  readU64(): number {
    const lo = this.data.getUint32(this.cursor, true)
    const hi = this.data.getUint32(this.cursor + 4, true)
    this.cursor += 8
    return lo + hi * 0x100000000
  }

  readString(): string {
    const len = this.readU16()
    const bytes = new Uint8Array(this.data.buffer, this.data.byteOffset + this.cursor, len)
    this.cursor += len
    return textDecoder.decode(bytes)
  }

  // Attribute map strings use u32 length prefix
  readLongString(): string {
    const len = this.readU32()
    const bytes = new Uint8Array(this.data.buffer, this.data.byteOffset + this.cursor, len)
    this.cursor += len
    return textDecoder.decode(bytes)
  }

  skip(n: number): void {
    this.cursor += n
  }
}

// ── Tree builder ────────────────────────────────────────────────────

function buildTree(raw: Uint8Array, offset: number): { node: BinaryNode; nextOffset: number } {
  // offset should be right after the NODE_START byte
  const chunks: number[] = []
  const children: BinaryNode[] = []
  let i = offset

  while (i < raw.length) {
    const byte = raw[i]

    if (byte === NODE_START) {
      i++ // skip NODE_START
      const result = buildTree(raw, i)
      children.push(result.node)
      i = result.nextOffset
    } else if (byte === NODE_END) {
      i++ // skip NODE_END
      break
    } else if (byte === ESCAPE_CHAR) {
      i++ // skip escape
      chunks.push(raw[i])
      i++
    } else {
      chunks.push(byte)
      i++
    }
  }

  const buf = new Uint8Array(chunks).buffer
  return { node: new BinaryNode(buf, children), nextOffset: i }
}

// ── Item attribute parser ───────────────────────────────────────────

function parseItemAttributes(node: BinaryNode, item: OtbmItem): void {
  while (node.canRead()) {
    const attr = node.readU8()
    switch (attr) {
      case OTBM_ATTR_COUNT:
      case OTBM_ATTR_RUNE_CHARGES:
        item.count = node.readU8()
        break
      case OTBM_ATTR_ACTION_ID:
        item.actionId = node.readU16()
        break
      case OTBM_ATTR_UNIQUE_ID:
        item.uniqueId = node.readU16()
        break
      case OTBM_ATTR_TEXT:
        item.text = node.readString()
        break
      case OTBM_ATTR_DESC:
        item.description = node.readString()
        break
      case OTBM_ATTR_TELE_DEST:
        item.teleportDestination = {
          x: node.readU16(),
          y: node.readU16(),
          z: node.readU8(),
        }
        break
      case OTBM_ATTR_DEPOT_ID:
        item.depotId = node.readU16()
        break
      case OTBM_ATTR_HOUSEDOORID:
        item.houseDoorId = node.readU8()
        break
      case OTBM_ATTR_CHARGES:
        item.charges = node.readU16()
        break
      case OTBM_ATTR_DURATION:
        item.duration = node.readU32()
        break
      case OTBM_ATTR_DECAYING_STATE:
        item.decayingState = node.readU8()
        break
      case OTBM_ATTR_WRITTENDATE:
        item.writtenDate = node.readU64()
        break
      case OTBM_ATTR_WRITTENBY:
        item.writtenBy = node.readString()
        break
      case OTBM_ATTR_SLEEPERGUID:
        item.sleeperGuid = node.readU32()
        break
      case OTBM_ATTR_SLEEPSTART:
        item.sleepStart = node.readU32()
        break
      case OTBM_ATTR_CONTAINER_ITEMS:
        node.readU32() // count hint, not stored — children are in child nodes
        break
      case OTBM_ATTR_ATTRIBUTE_MAP:
        parseAttributeMap(node, item)
        break
      default:
        // Unknown attribute — can't continue safely since we don't know its size
        return
    }
  }
}

function parseAttributeMap(node: BinaryNode, item: OtbmItem): void {
  const count = node.readU16()
  for (let i = 0; i < count; i++) {
    const key = node.readString()
    const valueType = node.readU8()
    switch (key) {
      case 'aid':
        item.actionId = readAttrMapValue(node, valueType) as number
        break
      case 'uid':
        item.uniqueId = readAttrMapValue(node, valueType) as number
        break
      case 'text':
        item.text = readAttrMapValue(node, valueType) as string
        break
      case 'desc':
        item.description = readAttrMapValue(node, valueType) as string
        break
      case 'count':
        item.count = readAttrMapValue(node, valueType) as number
        break
      case 'charges':
        item.charges = readAttrMapValue(node, valueType) as number
        break
      case 'subtype':
        item.count = readAttrMapValue(node, valueType) as number
        break
      case 'duration':
        item.duration = readAttrMapValue(node, valueType) as number
        break
      case 'depotId':
        item.depotId = readAttrMapValue(node, valueType) as number
        break
      case 'doorId':
        item.houseDoorId = readAttrMapValue(node, valueType) as number
        break
      default: {
        const value = readAttrMapValue(node, valueType)
        if (!item.customAttributes) item.customAttributes = new Map()
        item.customAttributes.set(key, { type: valueType, value })
        break
      }
    }
  }
}

export const ATTRMAP_STRING = 1
export const ATTRMAP_INTEGER = 2
export const ATTRMAP_FLOAT = 3
export const ATTRMAP_BOOLEAN = 4
export const ATTRMAP_DOUBLE = 5

function readAttrMapValue(node: BinaryNode, valueType: number): string | number | boolean {
  switch (valueType) {
    case ATTRMAP_STRING:
      return node.readLongString()
    case ATTRMAP_INTEGER:
      return node.readU32()
    case ATTRMAP_FLOAT:
      return node.readU32() // raw bits, good enough
    case ATTRMAP_BOOLEAN:
      return node.readU8() !== 0
    case ATTRMAP_DOUBLE:
      node.readU32() // read 8 bytes
      return node.readU32()
    default:
      throw new Error(`Unknown attribute map value type: ${valueType}`)
  }
}

// ── Item node parser ────────────────────────────────────────────────

function parseItem(node: BinaryNode, otbmVersion: number, itemNeedsCount?: ItemNeedsCountFn): OtbmItem {
  const id = node.readU16()
  const item: OtbmItem = { id }

  // MAP_OTBM_1 (version 0): stackable/splash/fluid items have inline u8 count
  if (otbmVersion === 0 && itemNeedsCount?.(id)) {
    item.count = node.readU8()
  }

  parseItemAttributes(node, item)

  // Container children
  if (node.children.length > 0) {
    item.items = []
    for (const child of node.children) {
      const childType = child.readU8()
      if (childType === OTBM_ITEM) {
        item.items.push(parseItem(child, otbmVersion, itemNeedsCount))
      }
    }
  }

  return item
}

// ── Tile parser ─────────────────────────────────────────────────────

function parseTile(
  node: BinaryNode,
  nodeType: number,
  baseX: number,
  baseY: number,
  baseZ: number,
  otbmVersion: number,
  itemNeedsCount?: ItemNeedsCountFn,
): OtbmTile {
  const xOff = node.readU8()
  const yOff = node.readU8()

  const tile: OtbmTile = {
    x: baseX + xOff,
    y: baseY + yOff,
    z: baseZ,
    flags: 0,
    items: [],
  }

  if (nodeType === OTBM_HOUSETILE) {
    tile.houseId = node.readU32()
  }

  // Read inline tile attributes
  let inlineCount = 0
  while (node.canRead()) {
    const attr = node.readU8()
    switch (attr) {
      case OTBM_ATTR_TILE_FLAGS:
        tile.flags = node.readU32()
        break
      case OTBM_ATTR_ITEM: {
        const itemId = node.readU16()
        const inlineItem: OtbmItem = { id: itemId }
        // Version 0: inline count for stackable/splash/fluid
        if (otbmVersion === 0 && itemNeedsCount?.(itemId)) {
          inlineItem.count = node.readU8()
        }
        tile.items.push(inlineItem)
        inlineCount++
        break
      }
      default:
        // Unknown tile attribute — stop reading inline attrs
        // The remaining data might be misaligned, but in practice
        // tiles only have TILE_FLAGS and ITEM attrs
        break
    }
  }
  tile.inlineItemCount = inlineCount

  // Read child nodes (full items with attributes)
  for (const child of node.children) {
    const childType = child.readU8()
    if (childType === OTBM_ITEM) {
      tile.items.push(parseItem(child, otbmVersion, itemNeedsCount))
    } else if (childType === OTBM_TILE_ZONE) {
      const zoneCount = child.readU16()
      const zones: number[] = []
      for (let i = 0; i < zoneCount; i++) {
        zones.push(child.readU16())
      }
      tile.zones = zones
    }
  }

  return tile
}

// ── Main parser ─────────────────────────────────────────────────────

/**
 * Synchronous parse — used when no progress reporting is needed.
 * For OTBM version 0 maps, pass an `itemNeedsCount` callback (from
 * `createItemNeedsCount()`) so inline count bytes are read correctly.
 */
export function parseOtbm(raw: Uint8Array, itemNeedsCount?: ItemNeedsCountFn): OtbmMap {
  if (raw[4] !== NODE_START) {
    throw new Error(`Expected NODE_START at byte 4, got 0x${raw[4].toString(16)}`)
  }
  const { node: root } = buildTree(raw, 5)
  return parseOtbmFromTree(root, itemNeedsCount)
}

function parseOtbmFromTree(root: BinaryNode, itemNeedsCount?: ItemNeedsCountFn): OtbmMap {
  const rootType = root.readU8()
  if (rootType !== 0) {
    throw new Error(`Unexpected root node type: ${rootType}`)
  }

  const version = root.readU32()
  const width = root.readU16()
  const height = root.readU16()
  const majorItems = root.readU32()
  const minorItems = root.readU32()

  const map: OtbmMap = {
    version,
    width,
    height,
    majorItems,
    minorItems,
    description: '',
    rawDescriptions: [],
    spawnFile: '',
    npcFile: '',
    houseFile: '',
    zoneFile: '',
    tiles: new Map(),
    towns: [],
    waypoints: [],
  }

  if (root.children.length === 0) {
    throw new Error('No MAP_DATA node found')
  }

  const mapDataNode = root.children[0]
  const mapDataType = mapDataNode.readU8()
  if (mapDataType !== OTBM_MAP_DATA) {
    throw new Error(`Expected OTBM_MAP_DATA (2), got ${mapDataType}`)
  }

  if (version === 0 && !itemNeedsCount) {
    console.warn('[OTBM] Version 0 map requires appearance data for correct parsing. Stackable/splash/fluid item counts may be incorrect.')
  }

  parseMapDataAttributes(mapDataNode, map)
  processChildren(mapDataNode, map, version, itemNeedsCount)
  return map
}

function parseMapDataAttributes(node: BinaryNode, map: OtbmMap): void {
  while (node.canRead()) {
    const attr = node.readU8()
    switch (attr) {
      case OTBM_ATTR_DESCRIPTION: {
        const desc = node.readString()
        map.rawDescriptions.push(desc)
        map.description += desc
        break
      }
      case OTBM_ATTR_SPAWN_FILE:
        map.spawnFile = node.readString()
        break
      case OTBM_ATTR_EXT_SPAWN_NPC_FILE:
        map.npcFile = node.readString()
        break
      case OTBM_ATTR_HOUSE_FILE:
        map.houseFile = node.readString()
        break
      case OTBM_ATTR_EXT_ZONE_FILE:
        map.zoneFile = node.readString()
        break
      default:
        break
    }
  }
}

function processChildren(mapDataNode: BinaryNode, map: OtbmMap, version: number, itemNeedsCount?: ItemNeedsCountFn): void {
  for (const child of mapDataNode.children) {
    const nodeType = child.readU8()

    switch (nodeType) {
      case OTBM_TILE_AREA: {
        const baseX = child.readU16()
        const baseY = child.readU16()
        const baseZ = child.readU8()

        const areaEntry = { baseX, baseY, baseZ, tileKeys: [] as string[] }
        for (const tileNode of child.children) {
          const tileType = tileNode.readU8()
          if (tileType === OTBM_TILE || tileType === OTBM_HOUSETILE) {
            const tile = parseTile(tileNode, tileType, baseX, baseY, baseZ, version, itemNeedsCount)
            const key = tileKey(tile.x, tile.y, tile.z)
            map.tiles.set(key, tile)
            areaEntry.tileKeys.push(key)
          }
        }
        if (!map._areaSequence) map._areaSequence = []
        map._areaSequence.push(areaEntry)
        break
      }

      case OTBM_TOWNS: {
        for (const townNode of child.children) {
          if (townNode.readU8() === OTBM_TOWN) {
            map.towns.push({
              id: townNode.readU32(),
              name: townNode.readString(),
              templeX: townNode.readU16(),
              templeY: townNode.readU16(),
              templeZ: townNode.readU8(),
            })
          }
        }
        break
      }

      case OTBM_WAYPOINTS: {
        for (const wpNode of child.children) {
          if (wpNode.readU8() === OTBM_WAYPOINT) {
            map.waypoints.push({
              name: wpNode.readString(),
              x: wpNode.readU16(),
              y: wpNode.readU16(),
              z: wpNode.readU8(),
            })
          }
        }
        break
      }
    }
  }
}

// ── Binary writer ─────────────────────────────────────────────────

class BinaryWriter {
  private buf: Uint8Array
  private pos = 0

  constructor(initialSize = 65536) {
    this.buf = new Uint8Array(initialSize)
  }

  private grow(needed: number): void {
    if (this.pos + needed <= this.buf.length) return
    let newSize = this.buf.length
    while (newSize < this.pos + needed) newSize *= 2
    const newBuf = new Uint8Array(newSize)
    newBuf.set(this.buf)
    this.buf = newBuf
  }

  writeRawByte(v: number): void {
    this.grow(1)
    this.buf[this.pos++] = v
  }

  private writeEscaped(v: number): void {
    if (v === 0xFD || v === 0xFE || v === 0xFF) {
      this.grow(2)
      this.buf[this.pos++] = ESCAPE_CHAR
      this.buf[this.pos++] = v
    } else {
      this.grow(1)
      this.buf[this.pos++] = v
    }
  }

  writeU8(v: number): void {
    this.writeEscaped(v & 0xFF)
  }

  writeU16(v: number): void {
    this.writeEscaped(v & 0xFF)
    this.writeEscaped((v >> 8) & 0xFF)
  }

  writeU32(v: number): void {
    this.writeEscaped(v & 0xFF)
    this.writeEscaped((v >> 8) & 0xFF)
    this.writeEscaped((v >> 16) & 0xFF)
    this.writeEscaped((v >> 24) & 0xFF)
  }

  // Write 64-bit unsigned integer from JS number (safe for values < 2^53)
  writeU64(v: number): void {
    const lo = v >>> 0
    const hi = (v / 0x100000000) >>> 0
    this.writeU32(lo)
    this.writeU32(hi)
  }

  writeString(s: string): void {
    const bytes = textEncoder.encode(s)
    this.writeU16(bytes.length)
    for (let i = 0; i < bytes.length; i++) {
      this.writeEscaped(bytes[i])
    }
  }

  writeLongString(s: string): void {
    const bytes = textEncoder.encode(s)
    this.writeU32(bytes.length)
    for (let i = 0; i < bytes.length; i++) {
      this.writeEscaped(bytes[i])
    }
  }

  startNode(nodeType: number): void {
    this.writeRawByte(NODE_START)
    this.writeEscaped(nodeType)
  }

  endNode(): void {
    this.writeRawByte(NODE_END)
  }

  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.pos)
  }
}

// ── Serializer ──────────────────────────────────────────────────────

/** Returns true if version uses attribute map format (v3 = MAP_OTBM_4, v5+ = MAP_OTBM_6+). */
function usesAttributeMap(version: number): boolean {
  return version === 3 || version >= 5
}

/**
 * Serialize attribute map entries for an item.
 * Only writes OTBM_ATTR_ATTRIBUTE_MAP if there are entries to write.
 */
function serializeAttributeMap(writer: BinaryWriter, item: OtbmItem): void {
  // Collect entries: [key, type, value]
  const entries: Array<{ key: string; type: number; value: string | number | boolean }> = []

  if (item.actionId != null) entries.push({ key: 'aid', type: ATTRMAP_INTEGER, value: item.actionId })
  if (item.uniqueId != null) entries.push({ key: 'uid', type: ATTRMAP_INTEGER, value: item.uniqueId })
  if (item.text != null) entries.push({ key: 'text', type: ATTRMAP_STRING, value: item.text })
  if (item.description != null) entries.push({ key: 'desc', type: ATTRMAP_STRING, value: item.description })
  if (item.charges != null) entries.push({ key: 'charges', type: ATTRMAP_INTEGER, value: item.charges })

  // Include custom attributes from the attribute map
  if (item.customAttributes) {
    for (const [key, { type, value }] of item.customAttributes) {
      entries.push({ key, type, value })
    }
  }

  if (entries.length === 0) return

  writer.writeU8(OTBM_ATTR_ATTRIBUTE_MAP)
  writer.writeU16(entries.length)
  for (const entry of entries) {
    writer.writeString(entry.key)
    writer.writeU8(entry.type)
    if (entry.type === ATTRMAP_STRING) {
      writer.writeLongString(entry.value as string)
    } else if (entry.type === ATTRMAP_BOOLEAN) {
      writer.writeU8((entry.value as boolean) ? 1 : 0)
    } else {
      writer.writeU32(entry.value as number)
    }
  }
}

function serializeItem(writer: BinaryWriter, item: OtbmItem, saveVersion: number): void {
  writer.startNode(OTBM_ITEM)
  writer.writeU16(item.id)

  if (usesAttributeMap(saveVersion)) {
    // Attribute map mode: count is always individual, rest goes in map
    if (item.count != null) {
      writer.writeU8(OTBM_ATTR_COUNT)
      writer.writeU8(item.count)
    }
    serializeAttributeMap(writer, item)
    if (item.teleportDestination != null) {
      writer.writeU8(OTBM_ATTR_TELE_DEST)
      writer.writeU16(item.teleportDestination.x)
      writer.writeU16(item.teleportDestination.y)
      writer.writeU8(item.teleportDestination.z)
    }
    if (item.depotId != null) {
      writer.writeU8(OTBM_ATTR_DEPOT_ID)
      writer.writeU16(item.depotId)
    }
    if (item.houseDoorId != null) {
      writer.writeU8(OTBM_ATTR_HOUSEDOORID)
      writer.writeU8(item.houseDoorId)
    }
  } else {
    // Individual attributes mode (version 4)
    if (item.count != null) {
      writer.writeU8(OTBM_ATTR_COUNT)
      writer.writeU8(item.count)
    }
    if (item.charges != null) {
      writer.writeU8(OTBM_ATTR_CHARGES)
      writer.writeU16(item.charges)
    }
    if (item.actionId != null) {
      writer.writeU8(OTBM_ATTR_ACTION_ID)
      writer.writeU16(item.actionId)
    }
    if (item.uniqueId != null) {
      writer.writeU8(OTBM_ATTR_UNIQUE_ID)
      writer.writeU16(item.uniqueId)
    }
    if (item.text != null) {
      writer.writeU8(OTBM_ATTR_TEXT)
      writer.writeString(item.text)
    }
    if (item.description != null) {
      writer.writeU8(OTBM_ATTR_DESC)
      writer.writeString(item.description)
    }
    if (item.teleportDestination != null) {
      writer.writeU8(OTBM_ATTR_TELE_DEST)
      writer.writeU16(item.teleportDestination.x)
      writer.writeU16(item.teleportDestination.y)
      writer.writeU8(item.teleportDestination.z)
    }
    if (item.depotId != null) {
      writer.writeU8(OTBM_ATTR_DEPOT_ID)
      writer.writeU16(item.depotId)
    }
    if (item.houseDoorId != null) {
      writer.writeU8(OTBM_ATTR_HOUSEDOORID)
      writer.writeU8(item.houseDoorId)
    }
  }
  // NOTE: duration, decayingState, writtenDate, writtenBy, sleeperGuid,
  // sleepStart are runtime attributes from Canary's iomapserialize (server
  // state saves). Canary's OTBM loader (BasicItem::readAttr in mapcache.cpp)
  // does NOT handle them — any unrecognized attribute stops attribute reading,
  // causing subsequent attributes to be lost. We parse them (to not corrupt
  // the read stream) and preserve them in OtbmItem, but do not write them
  // to OTBM output.

  if (item.items) {
    for (const child of item.items) {
      serializeItem(writer, child, saveVersion)
    }
  }

  writer.endNode()
}

function serializeTile(writer: BinaryWriter, tile: OtbmTile, saveVersion: number): void {
  const nodeType = tile.houseId != null ? OTBM_HOUSETILE : OTBM_TILE
  writer.startNode(nodeType)

  writer.writeU8(tile.x & 0xFF)
  writer.writeU8(tile.y & 0xFF)

  if (tile.houseId != null) {
    writer.writeU32(tile.houseId)
  }

  if (tile.flags !== 0) {
    writer.writeU8(OTBM_ATTR_TILE_FLAGS)
    writer.writeU32(tile.flags)
  }

  // Write leading attribute-less items as inline OTBM_ATTR_ITEM.
  // If inlineItemCount is set (from parsing), use it exactly.
  // Otherwise, compute: inline consecutive leading items that have no attributes.
  const inlineCount = tile.inlineItemCount ?? computeInlineCount(tile.items)
  for (let i = 0; i < inlineCount && i < tile.items.length; i++) {
    writer.writeU8(OTBM_ATTR_ITEM)
    writer.writeU16(tile.items[i].id)
  }
  for (let i = inlineCount; i < tile.items.length; i++) {
    serializeItem(writer, tile.items[i], saveVersion)
  }

  if (tile.zones && tile.zones.length > 0) {
    writer.startNode(OTBM_TILE_ZONE)
    writer.writeU16(tile.zones.length)
    for (const zoneId of tile.zones) {
      writer.writeU16(zoneId)
    }
    writer.endNode()
  }

  writer.endNode()
}


/**
 * Determine if the first item can be inlined as OTBM_ATTR_ITEM.
 * RME convention: at most 1 leading attribute-less item gets inlined.
 * Returns 0 or 1.
 */
function computeInlineCount(items: OtbmItem[]): number {
  if (items.length === 0) return 0
  const item = items[0]
  if (
    item.count != null ||
    item.charges != null ||
    item.actionId != null ||
    item.uniqueId != null ||
    item.text != null ||
    item.description != null ||
    item.teleportDestination != null ||
    item.depotId != null ||
    item.houseDoorId != null ||
    (item.items != null && item.items.length > 0) ||
    (item.customAttributes != null && item.customAttributes.size > 0)
  ) {
    return 0
  }
  return 1
}

/**
 * Serialize an OtbmMap to binary OTBM format.
 * Yields to the main thread periodically during tile serialization,
 * preventing the browser from freezing on large maps.
 */
export async function serializeOtbm(
  map: OtbmMap,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const YIELD_EVERY = 5000 // tiles between yields
  const totalTiles = map.tiles.size

  const writer = new BinaryWriter()

  // 4-byte header
  writer.writeRawByte(0)
  writer.writeRawByte(0)
  writer.writeRawByte(0)
  writer.writeRawByte(0)

  // Root node (type 0)
  // The UI only allows version 4+ to be selected.
  const saveVersion = map.version
  writer.startNode(0)
  writer.writeU32(saveVersion)
  writer.writeU16(map.width)
  writer.writeU16(map.height)
  writer.writeU32(4) // majorVersionItems (deprecated, hardcoded like RME)
  writer.writeU32(4) // minorVersionItems (deprecated, hardcoded like RME)

  // MAP_DATA node
  writer.startNode(OTBM_MAP_DATA)

  // Replace first description with our editor stamp (like RME does),
  // preserving any subsequent description entries.
  const descriptions = [...map.rawDescriptions]
  descriptions[0] = 'Saved with YATME'
  for (const desc of descriptions) {
    writer.writeU8(OTBM_ATTR_DESCRIPTION)
    writer.writeString(desc)
  }
  if (map.spawnFile) {
    writer.writeU8(OTBM_ATTR_SPAWN_FILE)
    writer.writeString(map.spawnFile)
  }
  if (map.npcFile) {
    writer.writeU8(OTBM_ATTR_EXT_SPAWN_NPC_FILE)
    writer.writeString(map.npcFile)
  }
  if (map.houseFile) {
    writer.writeU8(OTBM_ATTR_HOUSE_FILE)
    writer.writeString(map.houseFile)
  }
  if (map.zoneFile) {
    writer.writeU8(OTBM_ATTR_EXT_ZONE_FILE)
    writer.writeString(map.zoneFile)
  }

  // Tile areas — with periodic yields
  let tileCount = 0

  if (map._areaSequence) {
    for (const area of map._areaSequence) {
      writer.startNode(OTBM_TILE_AREA)
      writer.writeU16(area.baseX)
      writer.writeU16(area.baseY)
      writer.writeU8(area.baseZ)

      for (const key of area.tileKeys) {
        const tile = map.tiles.get(key)
        if (tile) {
          serializeTile(writer, tile, saveVersion)
          tileCount++
          if (tileCount % YIELD_EVERY === 0) {
            onProgress?.(tileCount, totalTiles)
            await yieldToMain()
          }
        }
      }

      writer.endNode()
    }
  } else {
    let curBaseX = -1
    let curBaseY = -1
    let curBaseZ = -1
    let areaOpen = false

    for (const tile of map.tiles.values()) {
      const baseX = tile.x & 0xFF00
      const baseY = tile.y & 0xFF00
      const baseZ = tile.z

      if (baseX !== curBaseX || baseY !== curBaseY || baseZ !== curBaseZ) {
        if (areaOpen) writer.endNode()
        writer.startNode(OTBM_TILE_AREA)
        writer.writeU16(baseX)
        writer.writeU16(baseY)
        writer.writeU8(baseZ)
        curBaseX = baseX
        curBaseY = baseY
        curBaseZ = baseZ
        areaOpen = true
      }

      serializeTile(writer, tile, saveVersion)
      tileCount++
      if (tileCount % YIELD_EVERY === 0) {
        onProgress?.(tileCount, totalTiles)
        await yieldToMain()
      }
    }

    if (areaOpen) writer.endNode()
  }

  if (totalTiles > 0) onProgress?.(totalTiles, totalTiles)

  // Towns
  writer.startNode(OTBM_TOWNS)
  for (const town of map.towns) {
    writer.startNode(OTBM_TOWN)
    writer.writeU32(town.id)
    writer.writeString(town.name)
    writer.writeU16(town.templeX)
    writer.writeU16(town.templeY)
    writer.writeU8(town.templeZ)
    writer.endNode()
  }
  writer.endNode()

  // Waypoints
  writer.startNode(OTBM_WAYPOINTS)
  for (const wp of map.waypoints) {
    writer.startNode(OTBM_WAYPOINT)
    writer.writeString(wp.name)
    writer.writeU16(wp.x)
    writer.writeU16(wp.y)
    writer.writeU8(wp.z)
    writer.endNode()
  }
  writer.endNode()

  writer.endNode() // MAP_DATA
  writer.endNode() // root

  return writer.toUint8Array()
}
