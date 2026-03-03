export const TILE_SIZE = 32
export const CHUNK_SIZE = 32 // tiles per chunk side
export const CHUNK_PX = CHUNK_SIZE * TILE_SIZE
export const MAX_ELEVATION = 24
export const GROUND_LAYER = 7
export const CHUNK_CACHE_SIZE = 512 // max cached off-screen chunks
export const CHUNK_BUILD_BUDGET_MS = 4 // max ms per frame for building new chunks
export const PREFETCH_RING = 2 // extra chunks around viewport to pre-build
export const FLOOR_ABOVE_ALPHA = 0.3 // opacity for transparent floor above

export type FloorViewMode = 'single' | 'current-below' | 'all'

// Discrete zoom levels where zoom * TILE_SIZE is always an integer (no sub-pixel gaps)
export const ZOOM_LEVELS = [
  0.25, 0.375, 0.5, 0.625, 0.75, 0.875,
  1, 1.25, 1.5, 1.75,
  2, 2.5, 3, 4, 5, 6, 8,
]
