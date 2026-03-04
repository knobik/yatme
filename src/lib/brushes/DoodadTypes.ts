// Data structures for doodad brushes (multi-item decoration placement).

export interface DoodadSingleItem {
  itemId: number
  chance: number // raw weight for random selection
}

export interface DoodadCompositeTile {
  dx: number // x offset from placement origin
  dy: number // y offset from placement origin
  dz: number // z offset from placement origin
  itemIds: number[] // items to place at this position
}

export interface DoodadComposite {
  chance: number // raw weight for random selection
  tiles: DoodadCompositeTile[]
}

export interface DoodadAlternative {
  singles: DoodadSingleItem[]
  composites: DoodadComposite[]
  totalChance: number // sum of all singles + composites chances
}

export interface DoodadBrush {
  id: number
  name: string
  lookId: number
  draggable: boolean
  onBlocking: boolean
  onDuplicate: boolean
  thickness: number // numerator (e.g. 12 from "12/100")
  thicknessCeiling: number // denominator (e.g. 100 from "12/100")
  alternatives: DoodadAlternative[]
}
