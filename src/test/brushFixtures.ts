// Shared brush/registry factory helpers for Tier 3 tests.
// All brush nodes use single items (chance=100) to eliminate randomness.

import { createGroundBrush, type AutoBorder, type BorderBlock, type GroundBrush, type SpecificCaseBlock } from '../lib/brushes/BrushTypes'
import { createWallBrush, type WallBrush } from '../lib/brushes/WallTypes'
import { createCarpetBrush, createTableBrush, type CarpetBrush, type TableBrush } from '../lib/brushes/CarpetTypes'
import type { DoodadBrush } from '../lib/brushes/DoodadTypes'
import { BrushRegistry } from '../lib/brushes/BrushRegistry'
import { makeMapData, makeTile, makeItem } from './fixtures'
import type { OtbmMap } from '../lib/otbm'

// ── Ground brush helpers ─────────────────────────────────────────────

export function makeGroundBrush(overrides: Partial<GroundBrush> = {}): GroundBrush {
  return { ...createGroundBrush(), ...overrides }
}

export function makeAutoBorder(id: number, group: number, tiles: (number | null)[]): AutoBorder {
  const padded = [...tiles, ...Array<null>(Math.max(0, 13 - tiles.length)).fill(null)]
  return { id, group, tiles: padded }
}

export function makeBorderBlock(overrides: Partial<BorderBlock> = {}): BorderBlock {
  return {
    outer: false,
    to: 0,
    toName: null,
    autoborder: null,
    specificCases: [],
    ...overrides,
  }
}

export function makeSpecificCase(overrides: Partial<SpecificCaseBlock> = {}): SpecificCaseBlock {
  return {
    itemsToMatch: [],
    matchGroup: 0,
    groupMatchAlignment: 0,
    toReplaceId: 0,
    withId: 0,
    deleteAll: false,
    ...overrides,
  }
}

// ── Wall brush helpers ───────────────────────────────────────────────

export function makeWallBrush(overrides: Partial<WallBrush> = {}): WallBrush {
  return { ...createWallBrush(), ...overrides }
}

/** Create a WallBrush with single items at specified alignments. */
export function makeWallBrushWithItems(
  id: number,
  name: string,
  itemMap: Record<number, number>,
): WallBrush {
  const brush = createWallBrush()
  brush.id = id
  brush.name = name
  for (const [alignment, itemId] of Object.entries(itemMap)) {
    const a = Number(alignment)
    brush.wallItems[a].items.push({ id: itemId, chance: 100 })
    brush.wallItems[a].totalChance = 100
  }
  return brush
}

// ── Carpet / Table brush helpers ─────────────────────────────────────

/** Create a CarpetBrush with single items at specified alignments. */
export function makeCarpetBrushWithItems(
  id: number,
  name: string,
  itemMap: Record<number, number>,
): CarpetBrush {
  const brush = createCarpetBrush()
  brush.id = id
  brush.name = name
  for (const [alignment, itemId] of Object.entries(itemMap)) {
    const a = Number(alignment)
    brush.carpetItems[a].items.push({ id: itemId, chance: 100 })
    brush.carpetItems[a].totalChance = 100
  }
  return brush
}

/** Create a TableBrush with single items at specified alignments. */
export function makeTableBrushWithItems(
  id: number,
  name: string,
  itemMap: Record<number, number>,
): TableBrush {
  const brush = createTableBrush()
  brush.id = id
  brush.name = name
  for (const [alignment, itemId] of Object.entries(itemMap)) {
    const a = Number(alignment)
    brush.tableItems[a].items.push({ id: itemId, chance: 100 })
    brush.tableItems[a].totalChance = 100
  }
  return brush
}

// ── Doodad brush helpers ─────────────────────────────────────────────

export function makeDoodadBrush(overrides: Partial<DoodadBrush> = {}): DoodadBrush {
  return {
    id: 0,
    name: '',
    lookId: 0,
    draggable: false,
    onBlocking: false,
    onDuplicate: false,
    thickness: 0,
    thicknessCeiling: 100,
    alternatives: [],
    ...overrides,
  }
}

// ── Registry helper ──────────────────────────────────────────────────

export interface MinimalRegistryOptions {
  groundBrushes?: GroundBrush[]
  borders?: Map<number, AutoBorder>
  wallBrushes?: WallBrush[]
  carpetBrushes?: CarpetBrush[]
  tableBrushes?: TableBrush[]
  doodadBrushes?: DoodadBrush[]
}

export function makeMinimalRegistry(options: MinimalRegistryOptions = {}): BrushRegistry {
  return new BrushRegistry(
    options.groundBrushes ?? [],
    options.borders ?? new Map(),
    options.wallBrushes ?? [],
    options.carpetBrushes ?? [],
    options.tableBrushes ?? [],
    options.doodadBrushes ?? [],
  )
}

// ── Map helper ───────────────────────────────────────────────────────

/** Create a map with uniform ground tiles covering a rectangular area. */
export function makeGridMap(
  groundItemId: number,
  x1: number, y1: number,
  x2: number, y2: number,
  z: number,
): OtbmMap {
  const tiles = []
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      tiles.push(makeTile(x, y, z, [makeItem({ id: groundItemId })]))
    }
  }
  return makeMapData(tiles)
}
