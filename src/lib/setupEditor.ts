import type { Application } from 'pixi.js'
import type { AppearanceData } from './appearances'
import type { OtbmMap } from './otbm'
import type { BrushRegistry } from './brushes/BrushRegistry'
import type { ItemRegistry } from './items'
import type { MapSidecars } from './sidecars'
import type { SpawnManager } from './creatures/SpawnManager'
import type { CreatureDatabase } from './creatures/CreatureDatabase'
import { MapRenderer } from './MapRenderer'
import { MapMutator } from './MapMutator'

export interface EditorInstances {
  renderer: MapRenderer
  mutator: MapMutator
}

/**
 * Build the MapRenderer and MapMutator, wire mutator chunk invalidation.
 */
export function setupEditor(
  app: Application,
  appearances: AppearanceData,
  mapData: OtbmMap,
  brushRegistry: BrushRegistry | null,
  itemRegistry: ItemRegistry | null,
  sidecars: MapSidecars | null,
  spawnManager: SpawnManager | null = null,
  creatureDb: CreatureDatabase | null = null,
): EditorInstances {
  const renderer = new MapRenderer(app, appearances, mapData)
  const mutator = new MapMutator(mapData, appearances)
  mutator.brushRegistry = brushRegistry
  mutator.itemRegistry = itemRegistry
  mutator.sidecars = sidecars
  mutator.spawnManager = spawnManager
  mutator.creatureDb = creatureDb

  mutator.onChunksInvalidated = (keys) => {
    renderer.invalidateChunks(keys)
  }

  return { renderer, mutator }
}
