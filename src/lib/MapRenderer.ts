import { Application, Container, Sprite, Texture } from 'pixi.js'
import { getTexture, getTextureSync, preloadSheets } from './TextureManager'
import type { AppearanceData } from './appearances'
import type { Appearance } from '../proto/appearances'
import type { OtbmMap, OtbmTile, OtbmItem } from './otbm'

const TILE_SIZE = 32
const CHUNK_SIZE = 32 // tiles per chunk side
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE
const MAX_ELEVATION = 24

// Discrete zoom levels where zoom * TILE_SIZE is always an integer (no sub-pixel gaps)
const ZOOM_LEVELS = [
  0.25, 0.375, 0.5, 0.625, 0.75, 0.875,
  1, 1.25, 1.5, 1.75,
  2, 2.5, 3, 4, 5, 6, 8,
]

// ── Chunk index ─────────────────────────────────────────────────────

interface ChunkKey {
  cx: number
  cy: number
  z: number
}

function chunkKeyStr(cx: number, cy: number, z: number): string {
  return `${cx},${cy},${z}`
}

function buildChunkIndex(tiles: Map<string, OtbmTile>): Map<string, OtbmTile[]> {
  const index = new Map<string, OtbmTile[]>()
  for (const tile of tiles.values()) {
    const cx = Math.floor(tile.x / CHUNK_SIZE)
    const cy = Math.floor(tile.y / CHUNK_SIZE)
    const key = chunkKeyStr(cx, cy, tile.z)
    let arr = index.get(key)
    if (!arr) {
      arr = []
      index.set(key, arr)
    }
    arr.push(tile)
  }
  return index
}

// ── MapRenderer ─────────────────────────────────────────────────────

export class MapRenderer {
  private app: Application
  private mapContainer: Container
  private appearances: AppearanceData
  private chunkIndex: Map<string, OtbmTile[]>
  private mapData: OtbmMap

  // Camera state
  private cameraX = 0 // world pixel position
  private cameraY = 0
  private _zoom = 1
  private _floor = 7

  // Interaction state
  private dragging = false
  private dragStartX = 0
  private dragStartY = 0
  private cameraStartX = 0
  private cameraStartY = 0

  // Chunk management
  private activeChunks = new Map<string, Container>()
  private chunkPool: Container[] = []

  // Callbacks for HUD updates
  onCameraChange?: (x: number, y: number, zoom: number, floor: number) => void

  constructor(app: Application, appearances: AppearanceData, mapData: OtbmMap) {
    this.app = app
    this.appearances = appearances
    this.mapData = mapData
    this.chunkIndex = buildChunkIndex(mapData.tiles)

    this.mapContainer = new Container()
    this.app.stage.addChild(this.mapContainer)

    this.setupInput()

    // Center on first town
    if (mapData.towns.length > 0) {
      const town = mapData.towns[0]
      this.cameraX = town.templeX * TILE_SIZE - this.app.screen.width / 2
      this.cameraY = town.templeY * TILE_SIZE - this.app.screen.height / 2
      this._floor = town.templeZ
    }

    this.app.ticker.add(() => this.update())
  }

  get zoom(): number { return this._zoom }
  get floor(): number { return this._floor }
  get worldX(): number { return Math.floor(this.cameraX / TILE_SIZE) }
  get worldY(): number { return Math.floor(this.cameraY / TILE_SIZE) }

  setFloor(z: number): void {
    if (z < 0 || z > 15) return
    this._floor = z
    this.rebuildAllChunks()
    this.notifyCamera()
  }

  centerOn(x: number, y: number): void {
    this.cameraX = x * TILE_SIZE - this.app.screen.width / (2 * this._zoom)
    this.cameraY = y * TILE_SIZE - this.app.screen.height / (2 * this._zoom)
    this.notifyCamera()
  }

  // ── Input ───────────────────────────────────────────────────────

  private setupInput(): void {
    const canvas = this.app.canvas as HTMLCanvasElement

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0 || e.button === 1) {
        this.dragging = true
        this.dragStartX = e.clientX
        this.dragStartY = e.clientY
        this.cameraStartX = this.cameraX
        this.cameraStartY = this.cameraY
        canvas.setPointerCapture(e.pointerId)
      }
    })

    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      const dx = e.clientX - this.dragStartX
      const dy = e.clientY - this.dragStartY
      this.cameraX = this.cameraStartX - dx / this._zoom
      this.cameraY = this.cameraStartY - dy / this._zoom
      this.notifyCamera()
    })

    canvas.addEventListener('pointerup', (e) => {
      if (this.dragging) {
        this.dragging = false
        canvas.releasePointerCapture(e.pointerId)
      }
    })

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // World position under cursor before zoom
      const worldBeforeX = this.cameraX + mouseX / this._zoom
      const worldBeforeY = this.cameraY + mouseY / this._zoom

      // Snap to discrete zoom levels to avoid sub-pixel tile gaps
      const currentIdx = ZOOM_LEVELS.indexOf(this._zoom)
      let nextIdx: number
      if (currentIdx === -1) {
        // Find nearest level
        nextIdx = ZOOM_LEVELS.findIndex((z) => z >= this._zoom)
        if (nextIdx === -1) nextIdx = ZOOM_LEVELS.length - 1
      } else {
        nextIdx = e.deltaY < 0
          ? Math.min(currentIdx + 1, ZOOM_LEVELS.length - 1)
          : Math.max(currentIdx - 1, 0)
      }
      this._zoom = ZOOM_LEVELS[nextIdx]

      // Adjust camera so world position under cursor stays the same
      this.cameraX = worldBeforeX - mouseX / this._zoom
      this.cameraY = worldBeforeY - mouseY / this._zoom

      this.notifyCamera()
    }, { passive: false })
  }

  private notifyCamera(): void {
    this.onCameraChange?.(this.worldX, this.worldY, this._zoom, this._floor)
  }

  // ── Update loop ─────────────────────────────────────────────────

  private update(): void {
    // Apply camera transform — round to avoid sub-pixel gaps between tiles
    this.mapContainer.position.set(
      Math.round(-this.cameraX * this._zoom),
      Math.round(-this.cameraY * this._zoom),
    )
    this.mapContainer.scale.set(this._zoom)

    // Determine visible chunk range
    const screenW = this.app.screen.width
    const screenH = this.app.screen.height

    const startX = Math.floor(this.cameraX / CHUNK_PX) - 1
    const startY = Math.floor(this.cameraY / CHUNK_PX) - 1
    const endX = Math.floor((this.cameraX + screenW / this._zoom) / CHUNK_PX) + 1
    const endY = Math.floor((this.cameraY + screenH / this._zoom) / CHUNK_PX) + 1

    // Collect keys for visible chunks
    const visibleKeys = new Set<string>()
    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        visibleKeys.add(chunkKeyStr(cx, cy, this._floor))
      }
    }

    // Remove chunks that are no longer visible
    for (const [key, container] of this.activeChunks) {
      if (!visibleKeys.has(key)) {
        this.mapContainer.removeChild(container)
        container.removeChildren()
        this.chunkPool.push(container)
        this.activeChunks.delete(key)
      }
    }

    // Create chunks that are newly visible
    for (const key of visibleKeys) {
      if (this.activeChunks.has(key)) continue

      const tiles = this.chunkIndex.get(key)
      if (!tiles || tiles.length === 0) continue

      const container = this.chunkPool.pop() || new Container()
      this.buildChunk(container, tiles, key)
      this.mapContainer.addChild(container)
      this.activeChunks.set(key, container)
    }
  }

  private rebuildAllChunks(): void {
    for (const [key, container] of this.activeChunks) {
      this.mapContainer.removeChild(container)
      container.removeChildren()
      this.chunkPool.push(container)
    }
    this.activeChunks.clear()
  }

  // ── Chunk building ──────────────────────────────────────────────

  private buildChunk(container: Container, tiles: OtbmTile[], _key: string): void {
    // Collect sprite IDs for preloading
    const spriteIds: number[] = []
    for (const tile of tiles) {
      for (const item of tile.items) {
        const appearance = this.appearances.objects.get(item.id)
        const sid = appearance?.frameGroup?.[0]?.spriteInfo?.spriteId?.[0]
        if (sid != null) spriteIds.push(sid)
      }
    }

    // Try synchronous first, async-load missing sheets
    this.renderChunkTiles(container, tiles)

    // Preload any missing sheets then re-render
    if (spriteIds.length > 0) {
      preloadSheets(spriteIds).then(() => {
        container.removeChildren()
        this.renderChunkTiles(container, tiles)
      })
    }
  }

  private renderChunkTiles(container: Container, tiles: OtbmTile[]): void {
    for (const tile of tiles) {
      this.renderTile(container, tile)
    }
  }

  private renderTile(parent: Container, tile: OtbmTile): void {
    const baseX = tile.x * TILE_SIZE
    const baseY = tile.y * TILE_SIZE

    // Sort items by draw order
    const ground: OtbmItem[] = []
    const bottom: OtbmItem[] = []
    const common: OtbmItem[] = []
    const top: OtbmItem[] = []

    for (const item of tile.items) {
      const appearance = this.appearances.objects.get(item.id)
      const flags = appearance?.flags
      if (flags?.bank) {
        ground.push(item)
      } else if (flags?.clip || flags?.bottom) {
        bottom.push(item)
      } else if (flags?.top) {
        top.push(item)
      } else {
        common.push(item)
      }
    }

    let elevation = 0
    const drawOrder = [...ground, ...bottom, ...common, ...top]

    for (const item of drawOrder) {
      const appearance = this.appearances.objects.get(item.id)
      if (!appearance) continue

      const spriteId = appearance.frameGroup?.[0]?.spriteInfo?.spriteId?.[0]
      if (spriteId == null) continue

      const texture = getTextureSync(spriteId)
      if (!texture) continue

      const sprite = new Sprite(texture)
      sprite.roundPixels = true

      // Position: anchor at bottom-right of sprite, offset by elevation
      sprite.x = baseX + TILE_SIZE - texture.width
      sprite.y = baseY + TILE_SIZE - texture.height - elevation

      parent.addChild(sprite)

      // Accumulate elevation
      if (appearance.flags?.height?.elevation) {
        elevation = Math.min(elevation + appearance.flags.height.elevation, MAX_ELEVATION)
      }
    }
  }

  destroy(): void {
    this.app.ticker.remove(this.update, this)
    this.rebuildAllChunks()
    this.mapContainer.destroy({ children: true })
  }
}
