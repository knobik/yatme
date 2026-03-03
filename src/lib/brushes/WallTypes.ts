// Data structures for the wall brush / auto-alignment system.
// Ported from RME's wall_brush.h and brush_enums.h

// 17 wall alignment types
export const WALL_POLE = 0
export const WALL_SOUTH_END = 1
export const WALL_EAST_END = 2
export const WALL_NORTHWEST_DIAGONAL = 3
export const WALL_WEST_END = 4
export const WALL_NORTHEAST_DIAGONAL = 5
export const WALL_HORIZONTAL = 6
export const WALL_SOUTH_T = 7
export const WALL_NORTH_END = 8
export const WALL_VERTICAL = 9
export const WALL_SOUTHWEST_DIAGONAL = 10
export const WALL_EAST_T = 11
export const WALL_SOUTHEAST_DIAGONAL = 12
export const WALL_WEST_T = 13
export const WALL_NORTH_T = 14
export const WALL_INTERSECTION = 15
export const WALL_UNTOUCHABLE = 16

// Neighbor bits for 4-directional wall detection
export const WALLTILE_NORTH = 1
export const WALLTILE_WEST = 2
export const WALLTILE_EAST = 4
export const WALLTILE_SOUTH = 8

export interface WallItem {
  id: number
  chance: number  // cumulative chance (running total)
}

export interface WallNode {
  totalChance: number
  items: WallItem[]
}

export const DOOR_UNDEFINED = 0
export const DOOR_ARCHWAY = 1
export const DOOR_NORMAL = 2
export const DOOR_LOCKED = 3
export const DOOR_QUEST = 4
export const DOOR_MAGIC = 5
export const DOOR_WINDOW = 6
export const DOOR_HATCH_WINDOW = 7

export interface WallDoor {
  id: number
  type: number   // DOOR_* constant
  open: boolean
}

export interface WallBrush {
  id: number
  name: string
  lookId: number
  wallItems: WallNode[]      // 17 entries indexed by wall alignment
  doorItems: WallDoor[][]    // 17 entries indexed by wall alignment
  friends: Set<string>       // friend brush names (resolved later)
  friendIds: Set<number>     // resolved friend brush IDs
  redirectName: string | null
  redirectTo: WallBrush | null
}

export function createWallBrush(): WallBrush {
  const wallItems: WallNode[] = []
  const doorItems: WallDoor[][] = []
  for (let i = 0; i < 17; i++) {
    wallItems.push({ totalChance: 0, items: [] })
    doorItems.push([])
  }
  return {
    id: 0,
    name: '',
    lookId: 0,
    wallItems,
    doorItems,
    friends: new Set(),
    friendIds: new Set(),
    redirectName: null,
    redirectTo: null,
  }
}

// Wall alignment lookup tables (from brush_tables.cpp)
// Maps 4-bit neighbor bitmask (N=1,W=2,E=4,S=8) → wall alignment

// Primary table: exact alignment for each neighbor pattern
// prettier-ignore
export const WALL_FULL_TYPES: number[] = [
  WALL_POLE,                 // 0b0000 — isolated
  WALL_SOUTH_END,            // 0b0001 — N only
  WALL_EAST_END,             // 0b0010 — W only
  WALL_NORTHWEST_DIAGONAL,   // 0b0011 — N+W
  WALL_WEST_END,             // 0b0100 — E only
  WALL_NORTHEAST_DIAGONAL,   // 0b0101 — N+E
  WALL_HORIZONTAL,           // 0b0110 — W+E
  WALL_SOUTH_T,              // 0b0111 — N+W+E
  WALL_NORTH_END,            // 0b1000 — S only
  WALL_VERTICAL,             // 0b1001 — N+S
  WALL_SOUTHWEST_DIAGONAL,   // 0b1010 — W+S
  WALL_EAST_T,               // 0b1011 — N+W+S
  WALL_SOUTHEAST_DIAGONAL,   // 0b1100 — E+S
  WALL_WEST_T,               // 0b1101 — N+E+S
  WALL_NORTH_T,              // 0b1110 — W+E+S
  WALL_INTERSECTION,         // 0b1111 — N+W+E+S
]

// Fallback table: simplified shapes when exact alignment has no items
// prettier-ignore
export const WALL_HALF_TYPES: number[] = [
  WALL_POLE,                 // 0b0000
  WALL_VERTICAL,             // 0b0001 — N → vertical
  WALL_HORIZONTAL,           // 0b0010 — W → horizontal
  WALL_NORTHWEST_DIAGONAL,   // 0b0011 — N+W → NW diagonal
  WALL_POLE,                 // 0b0100 — E → pole
  WALL_VERTICAL,             // 0b0101 — N+E → vertical
  WALL_HORIZONTAL,           // 0b0110 — W+E → horizontal
  WALL_NORTHWEST_DIAGONAL,   // 0b0111 — N+W+E → NW diagonal
  WALL_POLE,                 // 0b1000 — S → pole
  WALL_VERTICAL,             // 0b1001 — N+S → vertical
  WALL_HORIZONTAL,           // 0b1010 — W+S → horizontal
  WALL_NORTHWEST_DIAGONAL,   // 0b1011 — N+W+S → NW diagonal
  WALL_POLE,                 // 0b1100 — E+S → pole
  WALL_VERTICAL,             // 0b1101 — N+E+S → vertical
  WALL_HORIZONTAL,           // 0b1110 — W+E+S → horizontal
  WALL_NORTHWEST_DIAGONAL,   // 0b1111 — all → NW diagonal
]

// Wall type name → alignment mapping (for XML parsing)
export const WALL_TYPE_MAP: Record<string, number> = {
  'pole': WALL_POLE,
  'south end': WALL_SOUTH_END,
  'east end': WALL_EAST_END,
  'northwest diagonal': WALL_NORTHWEST_DIAGONAL,
  'corner': WALL_NORTHWEST_DIAGONAL,  // alias
  'west end': WALL_WEST_END,
  'northeast diagonal': WALL_NORTHEAST_DIAGONAL,
  'horizontal': WALL_HORIZONTAL,
  'south T': WALL_SOUTH_T,
  'north end': WALL_NORTH_END,
  'vertical': WALL_VERTICAL,
  'southwest diagonal': WALL_SOUTHWEST_DIAGONAL,
  'east T': WALL_EAST_T,
  'southeast diagonal': WALL_SOUTHEAST_DIAGONAL,
  'west T': WALL_WEST_T,
  'north T': WALL_NORTH_T,
  'intersection': WALL_INTERSECTION,
  'untouchable': WALL_UNTOUCHABLE,
}
