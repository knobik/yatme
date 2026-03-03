// Data structures for the ground brush / auto-border system.
// Ported from RME's ground_brush.h

export interface AutoBorder {
  id: number
  group: number
  tiles: (number | null)[]  // 13 entries, indexed by BorderType enum
}

export interface SpecificCaseBlock {
  itemsToMatch: number[]       // resolved item IDs to match on the tile
  matchGroup: number           // border group to match (0 = disabled)
  groupMatchAlignment: number  // required alignment for group match (BorderType enum)
  toReplaceId: number          // item ID to replace (0 = unused)
  withId: number               // replacement item ID (0 = unused)
  deleteAll: boolean           // if true, delete all matched items instead of replacing
}

export interface BorderBlock {
  outer: boolean
  to: number  // brush ID. 0 = "none" (zilch), 0xFFFFFFFF = "all"
  toName: string | null  // unresolved brush name (resolved in BrushRegistry)
  autoborder: AutoBorder | null
  specificCases: SpecificCaseBlock[]
}

export interface GroundBrush {
  id: number               // unique brush ID (assigned at load time)
  name: string
  lookId: number           // preview sprite
  zOrder: number
  items: { id: number; chance: number }[]
  totalChance: number
  borders: BorderBlock[]
  friends: Set<string>     // friend brush names
  friendIds: Set<number>   // resolved friend brush IDs
  optionalBorder: AutoBorder | null
  // Derived flags (set during loading)
  hasOuterBorder: boolean
  hasInnerBorder: boolean
  hasOuterZilchBorder: boolean
  hasInnerZilchBorder: boolean
}

export function createGroundBrush(): GroundBrush {
  return {
    id: 0,
    name: '',
    lookId: 0,
    zOrder: 0,
    items: [],
    totalChance: 0,
    borders: [],
    friends: new Set(),
    friendIds: new Set(),
    optionalBorder: null,
    hasOuterBorder: false,
    hasInnerBorder: false,
    hasOuterZilchBorder: false,
    hasInnerZilchBorder: false,
  }
}
