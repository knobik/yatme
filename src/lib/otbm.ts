// ── OTBM binary map parser ──────────────────────────────────────────

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
const OTBM_ATTR_ATTRIBUTE_MAP = 128

// ── Data types ──────────────────────────────────────────────────────

export interface OtbmMap {
  version: number
  width: number
  height: number
  description: string
  spawnFile: string
  houseFile: string
  tiles: Map<string, OtbmTile>
  towns: OtbmTown[]
  waypoints: OtbmWaypoint[]
}

export interface OtbmTile {
  x: number
  y: number
  z: number
  flags: number
  houseId?: number
  items: OtbmItem[]
}

export interface OtbmItem {
  id: number
  count?: number
  actionId?: number
  uniqueId?: number
  text?: string
  description?: string
  teleportDestination?: { x: number; y: number; z: number }
  depotId?: number
  houseDoorId?: number
  charges?: number
  duration?: number
  items?: OtbmItem[]
}

export function deepCloneItem(item: OtbmItem): OtbmItem {
  const clone: OtbmItem = { id: item.id }
  if (item.count != null) clone.count = item.count
  if (item.actionId != null) clone.actionId = item.actionId
  if (item.uniqueId != null) clone.uniqueId = item.uniqueId
  if (item.text != null) clone.text = item.text
  if (item.description != null) clone.description = item.description
  if (item.teleportDestination) clone.teleportDestination = { ...item.teleportDestination }
  if (item.depotId != null) clone.depotId = item.depotId
  if (item.houseDoorId != null) clone.houseDoorId = item.houseDoorId
  if (item.charges != null) clone.charges = item.charges
  if (item.duration != null) clone.duration = item.duration
  if (item.items && item.items.length > 0) clone.items = item.items.map(deepCloneItem)
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

  readString(): string {
    const len = this.readU16()
    const bytes = new Uint8Array(this.data.buffer, this.data.byteOffset + this.cursor, len)
    this.cursor += len
    return new TextDecoder().decode(bytes)
  }

  // Attribute map strings use u32 length prefix
  readLongString(): string {
    const len = this.readU32()
    const bytes = new Uint8Array(this.data.buffer, this.data.byteOffset + this.cursor, len)
    this.cursor += len
    return new TextDecoder().decode(bytes)
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
        node.readU8() // ignored
        break
      case OTBM_ATTR_WRITTENDATE:
        node.readU32() // ignored
        break
      case OTBM_ATTR_WRITTENBY:
        node.readString() // ignored
        break
      case OTBM_ATTR_SLEEPERGUID:
        node.readU32() // ignored
        break
      case OTBM_ATTR_SLEEPSTART:
        node.readU32() // ignored
        break
      case OTBM_ATTR_CONTAINER_ITEMS:
        node.readU32() // ignored
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
      case 'duration':
        item.duration = readAttrMapValue(node, valueType) as number
        break
      case 'depotId':
        item.depotId = readAttrMapValue(node, valueType) as number
        break
      case 'doorId':
        item.houseDoorId = readAttrMapValue(node, valueType) as number
        break
      default:
        // Skip unknown keys
        skipAttrMapValue(node, valueType)
        break
    }
  }
}

const ATTRMAP_STRING = 1
const ATTRMAP_INTEGER = 2
const ATTRMAP_FLOAT = 3
const ATTRMAP_BOOLEAN = 4
const ATTRMAP_DOUBLE = 5

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

function skipAttrMapValue(node: BinaryNode, valueType: number): void {
  switch (valueType) {
    case ATTRMAP_STRING: {
      const len = node.readU32()
      node.skip(len)
      break
    }
    case ATTRMAP_INTEGER:
    case ATTRMAP_FLOAT:
      node.skip(4)
      break
    case ATTRMAP_BOOLEAN:
      node.skip(1)
      break
    case ATTRMAP_DOUBLE:
      node.skip(8)
      break
    default:
      throw new Error(`Unknown attribute map value type: ${valueType}`)
  }
}

// ── Item node parser ────────────────────────────────────────────────

function parseItem(node: BinaryNode, otbmVersion: number): OtbmItem {
  const id = node.readU16()
  const item: OtbmItem = { id }

  // MAP_OTBM_1 (version 0): stackable/splash/fluid items have inline u8 count
  // We can't know item type here, so for version 0 we'd need item type info.
  // In practice, canary maps are version 2+ so this isn't needed.
  // If needed, the caller would have to pass item type flags.

  parseItemAttributes(node, item)

  // Container children
  if (node.children.length > 0) {
    item.items = []
    for (const child of node.children) {
      const childType = child.readU8()
      if (childType === OTBM_ITEM) {
        item.items.push(parseItem(child, otbmVersion))
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
  while (node.canRead()) {
    const attr = node.readU8()
    switch (attr) {
      case OTBM_ATTR_TILE_FLAGS:
        tile.flags = node.readU32()
        break
      case OTBM_ATTR_ITEM: {
        // Simple inline item (just an id, no extra attributes)
        const itemId = node.readU16()
        tile.items.push({ id: itemId })
        break
      }
      default:
        // Unknown tile attribute — stop reading inline attrs
        // The remaining data might be misaligned, but in practice
        // tiles only have TILE_FLAGS and ITEM attrs
        break
    }
  }

  // Read child nodes (full items with attributes)
  for (const child of node.children) {
    const childType = child.readU8()
    if (childType === OTBM_ITEM) {
      tile.items.push(parseItem(child, otbmVersion))
    }
    // OTBM_TILE_ZONE (19) is ignored for now
  }

  return tile
}

// ── Main parser ─────────────────────────────────────────────────────

export async function loadOtbm(
  url = '/canary.otbm',
  onProgress?: (fraction: number) => void,
  onStatus?: (msg: string) => void,
): Promise<OtbmMap> {
  const { fetchWithProgress } = await import('./fetchWithProgress')
  // Download phase: 0 → 0.5 of this step
  const buffer = await fetchWithProgress(url, (f) => onProgress?.(f * 0.5))

  // Tree building phase: 0.5 → 0.65
  onProgress?.(0.5)
  onStatus?.('Building node tree...')
  await new Promise(r => setTimeout(r, 0))
  const raw = new Uint8Array(buffer)
  if (raw[4] !== NODE_START) {
    throw new Error(`Expected NODE_START at byte 4, got 0x${raw[4].toString(16)}`)
  }
  const { node: root } = buildTree(raw, 5)
  onProgress?.(0.65)

  // Tile processing phase: 0.65 → 1.0
  onStatus?.('Processing map data...')
  await new Promise(r => setTimeout(r, 0))
  const map = await parseOtbmAsync(root, (f) => onProgress?.(0.65 + f * 0.35))
  onProgress?.(1)
  return map
}

/**
 * Synchronous parse — used when no progress reporting is needed.
 */
export function parseOtbm(raw: Uint8Array): OtbmMap {
  if (raw[4] !== NODE_START) {
    throw new Error(`Expected NODE_START at byte 4, got 0x${raw[4].toString(16)}`)
  }
  const { node: root } = buildTree(raw, 5)
  return parseOtbmFromTree(root)
}

function parseOtbmFromTree(root: BinaryNode): OtbmMap {
  const rootType = root.readU8()
  if (rootType !== 0) {
    throw new Error(`Unexpected root node type: ${rootType}`)
  }

  const version = root.readU32()
  const width = root.readU16()
  const height = root.readU16()
  root.readU32() // majorItems
  root.readU32() // minorItems

  const map: OtbmMap = {
    version,
    width,
    height,
    description: '',
    spawnFile: '',
    houseFile: '',
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

  while (mapDataNode.canRead()) {
    const attr = mapDataNode.readU8()
    switch (attr) {
      case OTBM_ATTR_DESCRIPTION:
        map.description += mapDataNode.readString()
        break
      case OTBM_ATTR_SPAWN_FILE:
        map.spawnFile = mapDataNode.readString()
        break
      case OTBM_ATTR_HOUSE_FILE:
        map.houseFile = mapDataNode.readString()
        break
      default:
        break
    }
  }

  processChildren(mapDataNode, map, version)
  return map
}

function processChildren(mapDataNode: BinaryNode, map: OtbmMap, version: number): void {
  for (const child of mapDataNode.children) {
    const nodeType = child.readU8()

    switch (nodeType) {
      case OTBM_TILE_AREA: {
        const baseX = child.readU16()
        const baseY = child.readU16()
        const baseZ = child.readU8()

        for (const tileNode of child.children) {
          const tileType = tileNode.readU8()
          if (tileType === OTBM_TILE || tileType === OTBM_HOUSETILE) {
            const tile = parseTile(tileNode, tileType, baseX, baseY, baseZ, version)
            map.tiles.set(`${tile.x},${tile.y},${tile.z}`, tile)
          }
        }
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

/**
 * Async parse — yields to the browser every ~50ms so the progress bar can update.
 */
async function parseOtbmAsync(
  root: BinaryNode,
  onProgress?: (fraction: number) => void,
): Promise<OtbmMap> {
  const rootType = root.readU8()
  if (rootType !== 0) {
    throw new Error(`Unexpected root node type: ${rootType}`)
  }

  const version = root.readU32()
  const width = root.readU16()
  const height = root.readU16()
  root.readU32() // majorItems
  root.readU32() // minorItems

  const map: OtbmMap = {
    version,
    width,
    height,
    description: '',
    spawnFile: '',
    houseFile: '',
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

  while (mapDataNode.canRead()) {
    const attr = mapDataNode.readU8()
    switch (attr) {
      case OTBM_ATTR_DESCRIPTION:
        map.description += mapDataNode.readString()
        break
      case OTBM_ATTR_SPAWN_FILE:
        map.spawnFile = mapDataNode.readString()
        break
      case OTBM_ATTR_HOUSE_FILE:
        map.houseFile = mapDataNode.readString()
        break
      default:
        break
    }
  }

  // Process tile areas in batches, yielding periodically for UI updates
  const children = mapDataNode.children
  const total = children.length
  let lastYield = performance.now()

  for (let i = 0; i < total; i++) {
    const child = children[i]
    const nodeType = child.readU8()

    switch (nodeType) {
      case OTBM_TILE_AREA: {
        const baseX = child.readU16()
        const baseY = child.readU16()
        const baseZ = child.readU8()

        for (const tileNode of child.children) {
          const tileType = tileNode.readU8()
          if (tileType === OTBM_TILE || tileType === OTBM_HOUSETILE) {
            const tile = parseTile(tileNode, tileType, baseX, baseY, baseZ, version)
            map.tiles.set(`${tile.x},${tile.y},${tile.z}`, tile)
          }
        }
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

    // Yield every ~50ms so the browser can paint progress updates
    const now = performance.now()
    if (now - lastYield > 50) {
      onProgress?.((i + 1) / total)
      await new Promise(r => setTimeout(r, 0))
      lastYield = performance.now()
    }
  }

  onProgress?.(1)
  return map
}
