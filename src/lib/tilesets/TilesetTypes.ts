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

export interface ResolvedTilesetSection {
  type: 'terrain' | 'doodad' | 'items' | 'raw'
  itemIds: number[]
}

export interface ResolvedTileset {
  name: string
  sections: ResolvedTilesetSection[]
  itemIds: number[]  // flat list of all item IDs (for search/count)
}
