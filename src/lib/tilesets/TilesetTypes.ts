export interface TilesetEntry {
  type: 'item' | 'brush' | 'range'
  id?: number          // for type='item'
  name?: string        // for type='brush'
  fromId?: number      // for type='range'
  toId?: number        // for type='range'
}

export interface TilesetCategory {
  type: 'terrain' | 'doodad' | 'items' | 'raw'
  entries: TilesetEntry[]
}

export interface Tileset {
  name: string
  categories: TilesetCategory[]
}

// ── Resolved palette entries ────────────────────────────────────────

export interface ResolvedBrushEntry {
  type: 'brush'
  brushType: 'ground' | 'wall' | 'carpet' | 'table' | 'doodad'
  brushName: string
  lookId: number       // preview sprite ID
  displayName: string  // human-readable brush name
}

export interface ResolvedItemEntry {
  type: 'item'
  itemId: number
  displayName: string
}

export type ResolvedPaletteEntry = ResolvedBrushEntry | ResolvedItemEntry

// ── Resolved tilesets ───────────────────────────────────────────────

export interface ResolvedTilesetSection {
  type: 'terrain' | 'doodad' | 'items' | 'raw'
  entries: ResolvedPaletteEntry[]
}

export interface ResolvedTileset {
  name: string
  sections: ResolvedTilesetSection[]
  entryCount: number  // total entries across all sections (for counts)
}

// ── Palette navigation ──────────────────────────────────────────────

export type CategoryType = 'all' | 'terrain' | 'doodad' | 'items' | 'raw'

export interface PaletteLocation {
  category: CategoryType
  tilesetName: string
  entry: ResolvedPaletteEntry
}
