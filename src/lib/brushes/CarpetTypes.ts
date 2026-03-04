// Data structures, constants, and lookup tables for carpet & table brushes.
// Port of RME's CarpetBrush / TableBrush enums and brush_tables.cpp.

// --- Carpet alignment indices (reuse BorderType values from BorderTable.ts) ---
export const CARPET_BORDER_NONE = 0
export const CARPET_NORTH = 1
export const CARPET_EAST = 2
export const CARPET_SOUTH = 3
export const CARPET_WEST = 4
export const CARPET_CORNER_NW = 5
export const CARPET_CORNER_NE = 6
export const CARPET_CORNER_SW = 7
export const CARPET_CORNER_SE = 8
export const CARPET_DIAGONAL_NW = 9
export const CARPET_DIAGONAL_NE = 10
export const CARPET_DIAGONAL_SE = 11
export const CARPET_DIAGONAL_SW = 12
export const CARPET_CENTER = 13

export const CARPET_ALIGNMENT_COUNT = 14

// --- Table alignment indices ---
export const TABLE_NORTH_END = 0
export const TABLE_SOUTH_END = 1
export const TABLE_EAST_END = 2
export const TABLE_WEST_END = 3
export const TABLE_HORIZONTAL = 4
export const TABLE_VERTICAL = 5
export const TABLE_ALONE = 6

export const TABLE_ALIGNMENT_COUNT = 7

// --- 8-directional neighbor bitmask flags ---
export const TILE_NORTHWEST = 1
export const TILE_NORTH = 2
export const TILE_NORTHEAST = 4
export const TILE_WEST = 8
export const TILE_EAST = 16
export const TILE_SOUTHWEST = 32
export const TILE_SOUTH = 64
export const TILE_SOUTHEAST = 128

// --- Interfaces ---

export interface CarpetItem {
  id: number
  chance: number // cumulative chance (like WallItem)
}

export interface CarpetNode {
  items: CarpetItem[]
  totalChance: number
}

export interface CarpetBrush {
  id: number
  name: string
  lookId: number
  carpetItems: CarpetNode[] // [14] — indexed by carpet alignment
}

export interface TableItem {
  id: number
  chance: number // cumulative chance
}

export interface TableNode {
  items: TableItem[]
  totalChance: number
}

export interface TableBrush {
  id: number
  name: string
  lookId: number
  tableItems: TableNode[] // [7] — indexed by table alignment
}

// --- Factory functions ---

export function createCarpetBrush(): CarpetBrush {
  const carpetItems: CarpetNode[] = []
  for (let i = 0; i < CARPET_ALIGNMENT_COUNT; i++) {
    carpetItems.push({ items: [], totalChance: 0 })
  }
  return { id: 0, name: '', lookId: 0, carpetItems }
}

export function createTableBrush(): TableBrush {
  const tableItems: TableNode[] = []
  for (let i = 0; i < TABLE_ALIGNMENT_COUNT; i++) {
    tableItems.push({ items: [], totalChance: 0 })
  }
  return { id: 0, name: '', lookId: 0, tableItems }
}

// --- Carpet alignment name → index map (matches RME AutoBorder::edgeNameToID) ---
export const CARPET_ALIGN_MAP: Record<string, number> = {
  n: CARPET_NORTH,
  e: CARPET_EAST,
  s: CARPET_SOUTH,
  w: CARPET_WEST,
  cnw: CARPET_CORNER_NW,
  cne: CARPET_CORNER_NE,
  csw: CARPET_CORNER_SW,
  cse: CARPET_CORNER_SE,
  dnw: CARPET_DIAGONAL_NW,
  dne: CARPET_DIAGONAL_NE,
  dse: CARPET_DIAGONAL_SE,
  dsw: CARPET_DIAGONAL_SW,
  center: CARPET_CENTER,
}

// --- Table alignment name → index map ---
export const TABLE_ALIGN_MAP: Record<string, number> = {
  north: TABLE_NORTH_END,
  south: TABLE_SOUTH_END,
  east: TABLE_EAST_END,
  west: TABLE_WEST_END,
  horizontal: TABLE_HORIZONTAL,
  vertical: TABLE_VERTICAL,
  alone: TABLE_ALONE,
}

// --- 256-entry lookup tables (ported from RME brush_tables.cpp) ---

// prettier-ignore
export const TABLE_TYPES: number[] = [
  6,6,1,6,6,6,6,6,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
  6,6,1,6,6,6,6,6,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
  0,0,5,0,0,0,0,0,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
  6,6,1,6,6,6,6,6,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
  6,6,1,6,6,6,6,6,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
  6,6,1,6,6,6,6,6,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
  6,6,1,6,6,6,6,6,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
  6,6,1,6,6,6,6,6,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,
]

// prettier-ignore
export const CARPET_TYPES: number[] = [
  13,13,13,5,6,1,6,1,13,4,5,5,13,13,5,5,
  13,6,6,6,6,6,6,6,13,1,1,1,1,1,1,1,
  7,4,7,6,6,5,6,1,7,7,5,5,7,13,5,5,
  13,13,6,6,13,6,6,6,7,13,13,13,13,13,13,1,
  7,5,13,5,6,1,6,1,7,4,4,5,7,5,5,1,
  8,8,2,2,8,8,2,2,3,3,13,13,3,3,13,1,
  7,7,7,4,7,13,13,4,7,7,4,4,7,7,4,4,
  8,8,2,13,8,8,2,2,3,3,13,13,3,3,13,9,
  8,5,8,5,2,1,6,1,3,5,5,5,2,1,5,5,
  3,8,6,6,2,2,6,6,3,3,1,1,2,1,1,1,
  3,13,3,4,13,13,6,1,7,4,5,5,7,4,5,5,
  8,8,6,6,2,2,6,6,3,3,1,1,3,13,13,1,
  8,8,2,13,8,8,2,2,7,7,4,4,7,7,4,4,
  8,8,2,2,8,8,2,2,3,3,13,13,3,3,13,10,
  3,3,13,4,3,13,2,13,7,7,4,4,7,7,4,4,
  8,8,2,2,8,8,2,2,3,3,13,12,3,3,11,13,
]
