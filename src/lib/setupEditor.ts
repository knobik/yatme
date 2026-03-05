import type { Application } from 'pixi.js'
import type { AppearanceData } from './appearances'
import type { OtbmMap } from './otbm'
import type { BrushRegistry } from './brushes/BrushRegistry'
import { MapRenderer } from './MapRenderer'
import { MapMutator } from './MapMutator'

export interface EditorInstances {
  renderer: MapRenderer
  mutator: MapMutator
}

/**
 * Build the MapRenderer and MapMutator, wire mutator chunk invalidation,
 * and expose debug globals.
 */
export function setupEditor(
  app: Application,
  appearances: AppearanceData,
  mapData: OtbmMap,
  brushRegistry: BrushRegistry | null,
): EditorInstances {
  const renderer = new MapRenderer(app, appearances, mapData)
  ;(window as any).__renderer = renderer

  const mutator = new MapMutator(mapData, appearances)
  mutator.brushRegistry = brushRegistry
  ;(window as any).__brushRegistry = brushRegistry

  mutator.onChunksInvalidated = (keys) => {
    renderer.invalidateChunks(keys)
  }

  return { renderer, mutator }
}
