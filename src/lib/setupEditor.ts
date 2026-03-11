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
import { WaypointManager } from './WaypointManager'

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
  const waypointManager = new WaypointManager(mapData.waypoints)
  const renderer = new MapRenderer(app, appearances, mapData, spawnManager, waypointManager)
  if (creatureDb) {
    renderer.setCreatureDatabase(creatureDb)
  }
  const mutator = new MapMutator(mapData, appearances)
  mutator.brushRegistry = brushRegistry
  mutator.itemRegistry = itemRegistry
  mutator.sidecars = sidecars
  mutator.spawnManager = spawnManager
  mutator.creatureDb = creatureDb
  mutator.waypointManager = waypointManager

  mutator.onChunksInvalidated = (keys) => {
    renderer.invalidateChunks(keys)
  }

  mutator.onWaypointChanged = () => {
    renderer.markWaypointOverlayDirty()
  }

  return { renderer, mutator }
}
