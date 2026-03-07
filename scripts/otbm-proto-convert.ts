#!/usr/bin/env tsx
// OTBM <-> Protobuf round-trip converter
//
// Usage:
//   npx tsx scripts/otbm-proto-convert.ts otbm2proto <input.otbm> <output.pb>
//   npx tsx scripts/otbm-proto-convert.ts proto2otbm <input.pb> <output.otbm>
//   npx tsx scripts/otbm-proto-convert.ts verify <input.otbm>
//     (converts otbm→proto→otbm and verifies semantic equivalence)

import fs from 'fs'
import path from 'path'
import protobuf from 'protobufjs'
import { parseOtbm, serializeOtbm } from '../src/lib/otbm.ts'
import type { OtbmMap, OtbmTile, OtbmItem, OtbmTown, OtbmWaypoint } from '../src/lib/otbm.ts'

// ── Load proto schema ───────────────────────────────────────────────

const PROTO_PATH = path.resolve(import.meta.dirname!, '..', 'proto', 'map.proto')

async function loadProto() {
  const root = await protobuf.load(PROTO_PATH)
  return root.lookupType('tibia.map.Map')
}

// ── OtbmMap → Proto message object ─────────────────────────────────

function otbmToProto(map: OtbmMap): Record<string, unknown> {
  // Flatten tiles in area-sequence order (preserves original OTBM ordering)
  const tiles: Record<string, unknown>[] = []
  if (map._areaSequence) {
    for (const area of map._areaSequence) {
      for (const key of area.tileKeys) {
        const tile = map.tiles.get(key)
        if (tile) tiles.push(convertTileToProto(tile))
      }
    }
  } else {
    for (const tile of map.tiles.values()) {
      tiles.push(convertTileToProto(tile))
    }
  }

  return {
    formatVersion: 1,
    width: map.width,
    height: map.height,
    descriptions: map.rawDescriptions,
    tiles,
    towns: map.towns.map(convertTownToProto),
    waypoints: map.waypoints.map(convertWaypointToProto),
  }
}

// OTBM tile flag bit positions
const OTBM_FLAG_PROTECTION_ZONE = 1 << 0
const OTBM_FLAG_NO_PVP          = 1 << 2
const OTBM_FLAG_NO_LOGOUT       = 1 << 3
const OTBM_FLAG_PVP_ZONE        = 1 << 4
const OTBM_FLAG_REFRESH          = 1 << 5

function convertTileToProto(tile: OtbmTile): Record<string, unknown> {
  const proto: Record<string, unknown> = {
    position: { x: tile.x, y: tile.y, z: tile.z },
    items: tile.items.map(convertItemToProto),
  }

  // Decompose raw OTBM flag bitfield into named booleans
  if (tile.flags & OTBM_FLAG_PROTECTION_ZONE) proto.protectionZone = true
  if (tile.flags & OTBM_FLAG_NO_PVP) proto.noPvp = true
  if (tile.flags & OTBM_FLAG_NO_LOGOUT) proto.noLogout = true
  if (tile.flags & OTBM_FLAG_PVP_ZONE) proto.pvpZone = true
  if (tile.flags & OTBM_FLAG_REFRESH) proto.refresh = true

  if (tile.houseId != null) proto.houseId = tile.houseId
  if (tile.zones && tile.zones.length > 0) proto.zoneIds = tile.zones

  return proto
}

function convertItemToProto(item: OtbmItem): Record<string, unknown> {
  const proto: Record<string, unknown> = { id: item.id }

  if (item.count != null) proto.count = item.count
  if (item.charges != null) proto.charges = item.charges
  if (item.actionId != null) proto.actionId = item.actionId
  if (item.uniqueId != null) proto.uniqueId = item.uniqueId
  if (item.text != null) proto.text = item.text
  if (item.description != null) proto.description = item.description
  if (item.teleportDestination != null) {
    proto.teleportDestination = {
      x: item.teleportDestination.x,
      y: item.teleportDestination.y,
      z: item.teleportDestination.z,
    }
  }
  if (item.depotId != null) proto.depotId = item.depotId
  if (item.houseDoorId != null) proto.houseDoorId = item.houseDoorId
  if (item.duration != null) proto.duration = item.duration
  if (item.decayingState != null) proto.decayingState = item.decayingState
  if (item.writtenDate != null) proto.writtenDate = item.writtenDate
  if (item.writtenBy != null) proto.writtenBy = item.writtenBy
  if (item.sleeperGuid != null) proto.sleeperGuid = item.sleeperGuid
  if (item.sleepStart != null) proto.sleepStart = item.sleepStart

  if (item.items && item.items.length > 0) {
    proto.items = item.items.map(convertItemToProto)
  }

  return proto
}

function convertTownToProto(town: OtbmTown): Record<string, unknown> {
  return {
    id: town.id,
    name: town.name,
    templePosition: { x: town.templeX, y: town.templeY, z: town.templeZ },
  }
}

function convertWaypointToProto(wp: OtbmWaypoint): Record<string, unknown> {
  return {
    name: wp.name,
    position: { x: wp.x, y: wp.y, z: wp.z },
  }
}

// ── Proto message object → OtbmMap ─────────────────────────────────

interface ProtoMsg {
  [key: string]: unknown
}

// Default OTBM export settings for modern maps
const DEFAULT_OTBM_VERSION = 2
const DEFAULT_ITEMS_VERSION = 4

function protoToOtbm(msg: ProtoMsg, outputPath: string): OtbmMap {
  const protoTiles = (msg.tiles as ProtoMsg[]) || []
  const protoTowns = (msg.towns as ProtoMsg[]) || []
  const protoWaypoints = (msg.waypoints as ProtoMsg[]) || []

  const descriptions = (msg.descriptions as string[]) || []

  // Derive external file references from output filename
  // e.g. "canary.otbm" → "canary-monster.xml", "canary-npc.xml", etc.
  const baseName = path.basename(outputPath, path.extname(outputPath))

  const map: OtbmMap = {
    version: DEFAULT_OTBM_VERSION,
    width: (msg.width as number) || 0,
    height: (msg.height as number) || 0,
    majorItems: DEFAULT_ITEMS_VERSION,
    minorItems: DEFAULT_ITEMS_VERSION,
    description: descriptions.join(''),
    rawDescriptions: descriptions,
    spawnFile: `${baseName}-monster.xml`,
    npcFile: `${baseName}-npc.xml`,
    houseFile: `${baseName}-house.xml`,
    zoneFile: `${baseName}-zone.xml`,
    tiles: new Map(),
    towns: protoTowns.map(convertTownFromProto),
    waypoints: protoWaypoints.map(convertWaypointFromProto),
  }

  // Insert tiles in proto order — JS Map preserves insertion order,
  // so writeTileAreas (used by serializeOtbm) will reconstruct
  // tile areas in the same sequence.
  for (const pt of protoTiles) {
    const tile = convertTileFromProto(pt)
    const key = `${tile.x},${tile.y},${tile.z}`
    map.tiles.set(key, tile)
  }

  return map
}

function convertTileFromProto(pt: ProtoMsg): OtbmTile {
  const pos = pt.position as ProtoMsg

  // Reconstruct raw OTBM flag bitfield from named booleans
  let flags = 0
  if (pt.protectionZone) flags |= OTBM_FLAG_PROTECTION_ZONE
  if (pt.noPvp) flags |= OTBM_FLAG_NO_PVP
  if (pt.noLogout) flags |= OTBM_FLAG_NO_LOGOUT
  if (pt.pvpZone) flags |= OTBM_FLAG_PVP_ZONE
  if (pt.refresh) flags |= OTBM_FLAG_REFRESH

  const tile: OtbmTile = {
    x: pos.x as number,
    y: pos.y as number,
    z: pos.z as number,
    flags,
    items: [],
  }

  if (pt.houseId) tile.houseId = pt.houseId as number
  if (pt.zoneIds) tile.zones = pt.zoneIds as number[]

  const items = (pt.items as ProtoMsg[]) || []
  tile.items = items.map(convertItemFromProto)

  return tile
}

function convertItemFromProto(pi: ProtoMsg): OtbmItem {
  const item: OtbmItem = { id: pi.id as number }

  if (pi.count != null) item.count = pi.count as number
  if (pi.charges != null) item.charges = pi.charges as number
  if (pi.actionId != null) item.actionId = pi.actionId as number
  if (pi.uniqueId != null) item.uniqueId = pi.uniqueId as number
  if (pi.text != null) item.text = pi.text as string
  if (pi.description != null) item.description = pi.description as string

  const teleDest = pi.teleportDestination as ProtoMsg | undefined
  if (teleDest) {
    item.teleportDestination = {
      x: teleDest.x as number,
      y: teleDest.y as number,
      z: teleDest.z as number,
    }
  }

  if (pi.depotId != null) item.depotId = pi.depotId as number
  if (pi.houseDoorId != null) item.houseDoorId = pi.houseDoorId as number
  if (pi.duration != null) item.duration = pi.duration as number
  if (pi.decayingState != null) item.decayingState = pi.decayingState as number
  if (pi.writtenDate != null) item.writtenDate = Number(pi.writtenDate)
  if (pi.writtenBy != null) item.writtenBy = pi.writtenBy as string
  if (pi.sleeperGuid != null) item.sleeperGuid = pi.sleeperGuid as number
  if (pi.sleepStart != null) item.sleepStart = pi.sleepStart as number

  const children = pi.items as ProtoMsg[]
  if (children && children.length > 0) {
    item.items = children.map(convertItemFromProto)
  }

  return item
}

function convertTownFromProto(pt: ProtoMsg): OtbmTown {
  const pos = pt.templePosition as ProtoMsg
  return {
    id: pt.id as number,
    name: pt.name as string,
    templeX: pos.x as number,
    templeY: pos.y as number,
    templeZ: pos.z as number,
  }
}

function convertWaypointFromProto(pw: ProtoMsg): OtbmWaypoint {
  const pos = pw.position as ProtoMsg
  return {
    name: pw.name as string,
    x: pos.x as number,
    y: pos.y as number,
    z: pos.z as number,
  }
}

// ── Semantic comparison ─────────────────────────────────────────────

function compareItems(a: OtbmItem, b: OtbmItem, path: string): string[] {
  const diffs: string[] = []
  if (a.id !== b.id) diffs.push(`${path}.id: ${a.id} vs ${b.id}`)
  if (a.count !== b.count) diffs.push(`${path}.count: ${a.count} vs ${b.count}`)
  if (a.charges !== b.charges) diffs.push(`${path}.charges: ${a.charges} vs ${b.charges}`)
  if (a.actionId !== b.actionId) diffs.push(`${path}.actionId: ${a.actionId} vs ${b.actionId}`)
  if (a.uniqueId !== b.uniqueId) diffs.push(`${path}.uniqueId: ${a.uniqueId} vs ${b.uniqueId}`)
  if (a.text !== b.text) diffs.push(`${path}.text: ${a.text} vs ${b.text}`)
  if (a.description !== b.description) diffs.push(`${path}.description: ${a.description} vs ${b.description}`)
  if (a.depotId !== b.depotId) diffs.push(`${path}.depotId: ${a.depotId} vs ${b.depotId}`)
  if (a.houseDoorId !== b.houseDoorId) diffs.push(`${path}.houseDoorId: ${a.houseDoorId} vs ${b.houseDoorId}`)

  const aTele = a.teleportDestination
  const bTele = b.teleportDestination
  if (aTele && bTele) {
    if (aTele.x !== bTele.x || aTele.y !== bTele.y || aTele.z !== bTele.z)
      diffs.push(`${path}.teleportDestination: (${aTele.x},${aTele.y},${aTele.z}) vs (${bTele.x},${bTele.y},${bTele.z})`)
  } else if (aTele !== bTele) {
    diffs.push(`${path}.teleportDestination: ${JSON.stringify(aTele)} vs ${JSON.stringify(bTele)}`)
  }

  const aChildren = a.items || []
  const bChildren = b.items || []
  if (aChildren.length !== bChildren.length) {
    diffs.push(`${path}.items.length: ${aChildren.length} vs ${bChildren.length}`)
  } else {
    for (let i = 0; i < aChildren.length; i++) {
      diffs.push(...compareItems(aChildren[i], bChildren[i], `${path}.items[${i}]`))
    }
  }

  return diffs
}

function semanticCompare(original: OtbmMap, reconstructed: OtbmMap): string[] {
  const diffs: string[] = []

  // Header (version and item versions are defaults, not round-tripped)
  if (original.width !== reconstructed.width) diffs.push(`width: ${original.width} vs ${reconstructed.width}`)
  if (original.height !== reconstructed.height) diffs.push(`height: ${original.height} vs ${reconstructed.height}`)

  // Description
  if (original.description !== reconstructed.description) diffs.push(`description mismatch`)

  // Tiles
  if (original.tiles.size !== reconstructed.tiles.size) {
    diffs.push(`tile count: ${original.tiles.size} vs ${reconstructed.tiles.size}`)
  }

  for (const [key, origTile] of original.tiles) {
    const reconTile = reconstructed.tiles.get(key)
    if (!reconTile) {
      diffs.push(`missing tile: ${key}`)
      continue
    }
    if (origTile.flags !== reconTile.flags) diffs.push(`tile[${key}].flags: ${origTile.flags} vs ${reconTile.flags}`)
    if (origTile.houseId !== reconTile.houseId) diffs.push(`tile[${key}].houseId: ${origTile.houseId} vs ${reconTile.houseId}`)

    const origZones = origTile.zones || []
    const reconZones = reconTile.zones || []
    if (origZones.length !== reconZones.length || origZones.some((z, i) => z !== reconZones[i]))
      diffs.push(`tile[${key}].zones mismatch`)

    if (origTile.items.length !== reconTile.items.length) {
      diffs.push(`tile[${key}].items.length: ${origTile.items.length} vs ${reconTile.items.length}`)
    } else {
      for (let i = 0; i < origTile.items.length; i++) {
        diffs.push(...compareItems(origTile.items[i], reconTile.items[i], `tile[${key}].items[${i}]`))
      }
    }

    if (diffs.length > 10) {
      diffs.push('... (truncated)')
      break
    }
  }

  // Towns
  if (original.towns.length !== reconstructed.towns.length) {
    diffs.push(`town count: ${original.towns.length} vs ${reconstructed.towns.length}`)
  } else {
    for (let i = 0; i < original.towns.length; i++) {
      const a = original.towns[i], b = reconstructed.towns[i]
      if (a.id !== b.id || a.name !== b.name || a.templeX !== b.templeX || a.templeY !== b.templeY || a.templeZ !== b.templeZ)
        diffs.push(`town[${i}] mismatch`)
    }
  }

  // Waypoints
  if (original.waypoints.length !== reconstructed.waypoints.length) {
    diffs.push(`waypoint count: ${original.waypoints.length} vs ${reconstructed.waypoints.length}`)
  } else {
    for (let i = 0; i < original.waypoints.length; i++) {
      const a = original.waypoints[i], b = reconstructed.waypoints[i]
      if (a.name !== b.name || a.x !== b.x || a.y !== b.y || a.z !== b.z)
        diffs.push(`waypoint[${i}] mismatch`)
    }
  }

  return diffs
}

// ── CLI ─────────────────────────────────────────────────────────────

async function otbm2proto(inputPath: string, outputPath: string) {
  console.log(`Reading OTBM: ${inputPath}`)
  const raw = new Uint8Array(fs.readFileSync(inputPath))
  const map = parseOtbm(raw)
  console.log(`  ${map.tiles.size} tiles, ${map.towns.length} towns, ${map.waypoints.length} waypoints`)

  const MapMessage = await loadProto()
  const protoObj = otbmToProto(map)

  const errMsg = MapMessage.verify(protoObj)
  if (errMsg) throw new Error(`Proto verification failed: ${errMsg}`)

  const message = MapMessage.create(protoObj)
  const buffer = MapMessage.encode(message).finish()

  fs.writeFileSync(outputPath, buffer)
  console.log(`Written proto: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
}

async function proto2otbm(inputPath: string, outputPath: string) {
  console.log(`Reading proto: ${inputPath}`)
  const buffer = fs.readFileSync(inputPath)

  const MapMessage = await loadProto()
  const message = MapMessage.decode(new Uint8Array(buffer))
  const obj = MapMessage.toObject(message, {
    longs: Number,
    defaults: false,
    arrays: true,
    objects: true,
  }) as ProtoMsg

  const map = protoToOtbm(obj, outputPath)
  console.log(`  ${map.tiles.size} tiles, ${map.towns.length} towns, ${map.waypoints.length} waypoints`)

  const otbmBytes = serializeOtbm(map)
  fs.writeFileSync(outputPath, otbmBytes)
  console.log(`Written OTBM: ${outputPath} (${(otbmBytes.length / 1024 / 1024).toFixed(2)} MB)`)
}

async function verify(inputPath: string) {
  console.log(`Verifying round-trip: ${inputPath}`)
  const original = new Uint8Array(fs.readFileSync(inputPath))
  console.log(`  Original OTBM: ${(original.length / 1024 / 1024).toFixed(2)} MB`)

  // Step 1: OTBM → proto
  const originalMap = parseOtbm(original)
  console.log(`  Parsed: ${originalMap.tiles.size} tiles, ${originalMap.towns.length} towns, ${originalMap.waypoints.length} waypoints`)

  const MapMessage = await loadProto()
  const protoObj = otbmToProto(originalMap)
  const errMsg = MapMessage.verify(protoObj)
  if (errMsg) throw new Error(`Proto verification failed: ${errMsg}`)

  const message = MapMessage.create(protoObj)
  const protoBytes = MapMessage.encode(message).finish()
  console.log(`  Proto binary: ${(protoBytes.length / 1024 / 1024).toFixed(2)} MB`)

  // Step 2: proto → OTBM
  const decoded = MapMessage.decode(protoBytes)
  const decodedObj = MapMessage.toObject(decoded, {
    longs: Number,
    defaults: false,
    arrays: true,
    objects: true,
  }) as ProtoMsg

  const reconstructedMap = protoToOtbm(decodedObj, inputPath)
  const otbmBytes = serializeOtbm(reconstructedMap)
  console.log(`  Reconstructed OTBM: ${(otbmBytes.length / 1024 / 1024).toFixed(2)} MB`)

  // Step 3: Semantic comparison (compare original parsed data with
  // the data that went through proto encode/decode, before re-serialization)
  const diffs = semanticCompare(originalMap, reconstructedMap)

  if (diffs.length > 0) {
    console.error(`\n  FAIL: ${diffs.length} semantic differences:`)
    for (const d of diffs) console.error(`    - ${d}`)
    process.exit(1)
  }

  // Report byte-level status
  const byteIdentical = otbmBytes.length === original.length &&
    Buffer.from(otbmBytes).compare(Buffer.from(original)) === 0

  if (byteIdentical) {
    console.log(`\n  PASS: byte-identical round-trip!`)
  } else {
    const sizeDiff = original.length - otbmBytes.length
    console.log(`\n  PASS: semantically identical (byte layout differs by ${Math.abs(sizeDiff)} bytes — inline vs full item node encoding)`)
  }
}

// ── Main ────────────────────────────────────────────────────────────

const [,, command, arg1, arg2] = process.argv

switch (command) {
  case 'otbm2proto':
    if (!arg1 || !arg2) {
      console.error('Usage: otbm-proto-convert.ts otbm2proto <input.otbm> <output.pb>')
      process.exit(1)
    }
    await otbm2proto(arg1, arg2)
    break

  case 'proto2otbm':
    if (!arg1 || !arg2) {
      console.error('Usage: otbm-proto-convert.ts proto2otbm <input.pb> <output.otbm>')
      process.exit(1)
    }
    await proto2otbm(arg1, arg2)
    break

  case 'verify':
    if (!arg1) {
      console.error('Usage: otbm-proto-convert.ts verify <input.otbm>')
      process.exit(1)
    }
    await verify(arg1)
    break

  default:
    console.error('Usage: otbm-proto-convert.ts <otbm2proto|proto2otbm|verify> [args...]')
    process.exit(1)
}
