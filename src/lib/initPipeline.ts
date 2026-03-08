import { Application } from 'pixi.js'
import { loadAppearances, type AppearanceData } from './appearances'
import { loadSpriteCatalog } from './sprites'
import { parseOtbm, type OtbmMap } from './otbm'
import { parseSidecars, type MapSidecars } from './sidecars'
import type { MapStorageProvider } from './storage'
import { loadItems, type ItemRegistry } from './items'
import { loadBrushData } from './brushes/BrushLoader'
import { parseWallBrushesXml } from './brushes/WallLoader'
import { parseCarpetBrushesXml } from './brushes/CarpetLoader'
import { parseDoodadBrushesXml } from './brushes/DoodadLoader'
import type { CarpetBrush, TableBrush } from './brushes/CarpetTypes'
import type { DoodadBrush } from './brushes/DoodadTypes'
import { BrushRegistry } from './brushes/BrushRegistry'
import { loadTilesets, resolveTilesets } from './tilesets/TilesetLoader'
import type { ResolvedTileset } from './tilesets/TilesetTypes'

export interface InitProgress {
  setStatus: (msg: string) => void
  setProgress: (fraction: number) => void
}

export interface InitResult {
  app: Application
  appearances: AppearanceData
  mapData: OtbmMap
  sidecars: MapSidecars
  registry: ItemRegistry
  brushRegistry: BrushRegistry | null
  tilesets: ResolvedTileset[]
  mapFilename: string
}

/**
 * Load all assets needed by the editor (steps 1-7 of init).
 * Pure async — no React state. Returns null if aborted.
 */
export async function loadAssets(
  container: HTMLElement,
  progress: InitProgress,
  signal: { destroyed: boolean },
  provider: MapStorageProvider,
): Promise<InitResult | null> {
  // Weights: pixi, catalog, appearances, items, brushes, tilesets, map data, editor setup
  const stepWeights = [2, 15, 3, 12, 8, 3, 50, 5]
  const totalWeight = stepWeights.reduce((a, b) => a + b, 0)
  let currentStep = 0
  const stepStarts: number[] = []
  let acc = 0
  for (const w of stepWeights) {
    stepStarts.push(acc / totalWeight)
    acc += w
  }

  function stepProgress(fraction: number) {
    const start = stepStarts[currentStep]
    const weight = stepWeights[currentStep] / totalWeight
    progress.setProgress(Math.min(start + fraction * weight, 1))
  }

  function nextStep() {
    currentStep++
    if (currentStep < stepWeights.length) {
      progress.setProgress(stepStarts[currentStep])
    }
  }

  // Step 1: Init PixiJS
  progress.setStatus('Starting renderer...')
  stepProgress(0)
  const app = new Application()
  await app.init({
    resizeTo: container,
    backgroundColor: 0x07070a,
    antialias: false,
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  })

  if (signal.destroyed) { app.destroy(true); return null }
  container.appendChild(app.canvas as HTMLCanvasElement)
  nextStep()

  // Step 2: Sprite catalog
  progress.setStatus('Loading sprite catalog...')
  const catalog = await loadSpriteCatalog(undefined, stepProgress)
  if (signal.destroyed) return null
  nextStep()

  // Step 3: Appearances
  progress.setStatus('Loading appearances...')
  const appearancesUrl = catalog.appearancesFile
    ? `/sprites-png/${catalog.appearancesFile}`
    : '/appearances.dat'
  const appearances = await loadAppearances(appearancesUrl, stepProgress)
  if (signal.destroyed) return null
  nextStep()

  // Step 4: Item registry
  progress.setStatus('Loading item data...')
  const registry = await loadItems(undefined, stepProgress)
  if (signal.destroyed) return null
  nextStep()

  // Step 5: Brushes
  progress.setStatus('Loading brush data...')
  let brushRegistry: BrushRegistry | null = null
  try {
    const brushData = await loadBrushData(stepProgress)
    const nextId = { value: brushData.brushes.length + 1 }

    const wallsXml = await fetch('/data/materials/brushs/walls.xml').then(r => r.text())
    const wallBrushes = parseWallBrushesXml(wallsXml, nextId)
    console.log(`[WallLoader] Loaded ${wallBrushes.length} wall brushes`)

    const doodadFiles = ['doodads.xml', 'tiny_borders.xml', 'trees.xml']
    const allCarpets: CarpetBrush[] = []
    const allTables: TableBrush[] = []
    const allDoodads: DoodadBrush[] = []
    for (const file of doodadFiles) {
      try {
        const xml = await fetch(`/data/materials/brushs/${file}`).then(r => r.text())
        const { carpets, tables } = parseCarpetBrushesXml(xml, nextId)
        const doodads = parseDoodadBrushesXml(xml, nextId)
        allCarpets.push(...carpets)
        allTables.push(...tables)
        allDoodads.push(...doodads)
      } catch (e) {
        console.warn(`[BrushLoader] Failed to load ${file}:`, e)
      }
    }
    console.log(`[CarpetLoader] Loaded ${allCarpets.length} carpet brushes, ${allTables.length} table brushes`)
    console.log(`[DoodadLoader] Loaded ${allDoodads.length} doodad brushes`)

    brushRegistry = new BrushRegistry(brushData.brushes, brushData.borders, wallBrushes, allCarpets, allTables, allDoodads)
  } catch (e) {
    console.warn('[App] Failed to load brush data, smart brushes disabled:', e)
  }
  if (signal.destroyed) return null
  nextStep()

  // Step 6: Tilesets
  progress.setStatus('Loading tilesets...')
  let tilesets: ResolvedTileset[] = []
  try {
    const rawTilesets = await loadTilesets()
    if (brushRegistry) {
      tilesets = resolveTilesets(rawTilesets, brushRegistry, appearances, registry)
      console.log(`[TilesetLoader] Loaded ${tilesets.length} tilesets`)
    }
  } catch (e) {
    console.warn('[App] Failed to load tilesets:', e)
  }
  if (signal.destroyed) return null
  nextStep()

  // Step 7: Map data (heaviest step)
  progress.setStatus('Loading map data...')
  const bundle = await provider.loadMap((f) => stepProgress(f * 0.4))
  stepProgress(0.4)
  progress.setStatus('Processing map data...')
  await new Promise(r => setTimeout(r, 0))
  const mapData = parseOtbm(bundle.otbm)
  stepProgress(0.6)

  // Load sidecars if not already in bundle (e.g. StaticFileProvider)
  const sidecarFiles = [mapData.houseFile, mapData.spawnFile, mapData.npcFile, mapData.zoneFile].filter(Boolean)
  if (sidecarFiles.length > 0 && bundle.sidecars.size === 0) {
    progress.setStatus('Loading sidecar files...')
    const loaded = await provider.loadSidecars(sidecarFiles)
    for (const [k, v] of loaded) bundle.sidecars.set(k, v)
  }
  stepProgress(0.8)

  progress.setStatus('Parsing sidecar data...')
  const sidecars = parseSidecars(bundle, mapData)
  const sidecarCounts = [
    sidecars.houses.length && `${sidecars.houses.length} houses`,
    sidecars.monsterSpawns.length && `${sidecars.monsterSpawns.length} monster spawns`,
    sidecars.npcSpawns.length && `${sidecars.npcSpawns.length} NPC spawns`,
    sidecars.zones.length && `${sidecars.zones.length} zones`,
  ].filter(Boolean)
  if (sidecarCounts.length > 0) {
    console.log(`[Sidecars] Loaded: ${sidecarCounts.join(', ')}`)
  }

  if (signal.destroyed) return null
  nextStep()

  // Step 8: Signal editor setup phase
  progress.setStatus('Initializing editor...')
  // Yield so the UI can paint the status update before setupEditor blocks
  await new Promise(r => setTimeout(r, 0))

  return { app, appearances, mapData, sidecars, registry, brushRegistry, tilesets, mapFilename: bundle.filename }
}
