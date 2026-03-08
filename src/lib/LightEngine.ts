import { Sprite, Texture, ImageSource } from 'pixi.js'
import { TILE_SIZE, CHUNK_SIZE, GROUND_LAYER, MAX_LIGHT_INTENSITY } from './constants'
import type { Camera } from './Camera'
import type { AppearanceData } from './appearances'
import type { OtbmTile } from './otbm'
import { chunkKeyStr } from './ChunkManager'

// ── Color palette ───────────────────────────────────────────────────

/** RME 6×6×6 RGB cube (216 colors). Index 0 and ≥216 → black. */
function colorFromEightBit(color: number): [number, number, number] {
  if (color <= 0 || color >= 216) return [0, 0, 0]
  const r = Math.floor(color / 36) % 6 * 51
  const g = Math.floor(color / 6) % 6 * 51
  const b = color % 6 * 51
  return [r, g, b]
}

// ── Types ───────────────────────────────────────────────────────────

interface LightSource {
  mapX: number
  mapY: number
  color: number
  intensity: number
}

// ── LightEngine ─────────────────────────────────────────────────────

export class LightEngine {
  private _sprite: Sprite
  private _canvas: HTMLCanvasElement
  private _ctx: CanvasRenderingContext2D
  private _source: ImageSource | null = null
  private _texture: Texture | null = null
  private _enabled = false
  private _dirty = true

  private _globalColor: [number, number, number] = [50, 50, 50]
  private _lights: LightSource[] = []
  private _lastRangeKey = ''


  constructor() {
    this._canvas = document.createElement('canvas')
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true })!
    this._sprite = new Sprite()
    this._sprite.blendMode = 'multiply'
    this._sprite.visible = false
  }

  get container(): Sprite { return this._sprite }
  get enabled(): boolean { return this._enabled }

  setEnabled(v: boolean): void {
    this._enabled = v
    if (!v) {
      this._sprite.visible = false
      this._lastRangeKey = ''
    } else {
      this._dirty = true
    }
  }

  markDirty(): void {
    this._dirty = true
  }

  // ── Per-frame entry point ───────────────────────────────────────

  update(
    camera: Camera,
    chunkIndex: Map<string, OtbmTile[]>,
    appearances: AppearanceData,
    visibleFloors: number[],
  ): void {
    if (!this._enabled) return

    const rangeKey = camera.computeRangeKey(visibleFloors)
    if (rangeKey === this._lastRangeKey && !this._dirty) return
    this._lastRangeKey = rangeKey
    this._dirty = false

    this._collectLights(camera, chunkIndex, appearances, visibleFloors)
    this._generateTexture(camera, visibleFloors)
    this._sprite.visible = true
  }

  // ── Light collection ────────────────────────────────────────────

  private _collectLights(
    camera: Camera,
    chunkIndex: Map<string, OtbmTile[]>,
    appearances: AppearanceData,
    visibleFloors: number[],
  ): void {
    this._lights.length = 0

    for (const z of visibleFloors) {
      const offset = camera.getFloorOffset(z)
      const { startX, startY, endX, endY } = camera.getVisibleRangeForFloor(offset)

      // Iterate chunk range (same as ChunkManager + 1 extra for light bleed)
      for (let cy = startY - 1; cy <= endY + 1; cy++) {
        for (let cx = startX - 1; cx <= endX + 1; cx++) {
          const key = chunkKeyStr(cx, cy, z)
          const tiles = chunkIndex.get(key)
          if (!tiles) continue

          for (const tile of tiles) {
            for (const item of tile.items) {
              const appearance = appearances.objects.get(item.id)
              const light = appearance?.flags?.light
              if (!light || light.brightness <= 0) continue

              // Apply floor diagonal offset for above-ground (RME convention)
              let mapX = tile.x
              let mapY = tile.y
              if (z <= GROUND_LAYER) {
                mapX -= (GROUND_LAYER - z)
                mapY -= (GROUND_LAYER - z)
              }

              const intensity = Math.min(light.brightness, MAX_LIGHT_INTENSITY)

              // Merge: if last light is same position + color, take max intensity
              const len = this._lights.length
              if (len > 0) {
                const last = this._lights[len - 1]
                if (last.mapX === mapX && last.mapY === mapY && last.color === light.color) {
                  last.intensity = Math.max(last.intensity, intensity)
                  continue
                }
              }

              this._lights.push({ mapX, mapY, color: light.color, intensity })
            }
          }
        }
      }
    }
  }

  // ── Texture generation ──────────────────────────────────────────

  private _generateTexture(camera: Camera, visibleFloors: number[]): void {
    // Compute bounding box in tile coordinates across all visible floors
    let minTX = Infinity
    let minTY = Infinity
    let maxTX = -Infinity
    let maxTY = -Infinity

    for (const z of visibleFloors) {
      const offset = camera.getFloorOffset(z)
      const { startX, startY, endX, endY } = camera.getVisibleRangeForFloor(offset)
      const margin = MAX_LIGHT_INTENSITY
      const tMinX = startX * CHUNK_SIZE - margin
      const tMinY = startY * CHUNK_SIZE - margin
      const tMaxX = (endX + 1) * CHUNK_SIZE + margin
      const tMaxY = (endY + 1) * CHUNK_SIZE + margin
      if (tMinX < minTX) minTX = tMinX
      if (tMinY < minTY) minTY = tMinY
      if (tMaxX > maxTX) maxTX = tMaxX
      if (tMaxY > maxTY) maxTY = tMaxY
    }

    if (!isFinite(minTX)) {
      this._sprite.visible = false
      return
    }

    const w = maxTX - minTX
    const h = maxTY - minTY
    // Resize canvas if needed
    if (this._canvas.width !== w || this._canvas.height !== h) {
      this._canvas.width = w
      this._canvas.height = h
    }

    // Create RGBA buffer filled with global ambient color
    const imageData = this._ctx.createImageData(w, h)
    const data = imageData.data
    const [gr, gg, gb] = this._globalColor

    for (let i = 0; i < data.length; i += 4) {
      data[i] = gr
      data[i + 1] = gg
      data[i + 2] = gb
      data[i + 3] = 255
    }

    // Apply each light source with RME's linear falloff + max blending
    for (const light of this._lights) {
      const [lr, lg, lb] = colorFromEightBit(light.color)
      const reach = Math.ceil(light.intensity)

      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > MAX_LIGHT_INTENSITY) continue

          let intensity = (-dist + light.intensity) * 0.2
          if (intensity < 0.01) continue
          if (intensity > 1.0) intensity = 1.0

          const px = light.mapX + dx - minTX
          const py = light.mapY + dy - minTY
          if (px < 0 || px >= w || py < 0 || py >= h) continue

          const idx = (py * w + px) * 4
          const r = Math.round(lr * intensity)
          const g = Math.round(lg * intensity)
          const b = Math.round(lb * intensity)
          if (r > data[idx]) data[idx] = r
          if (g > data[idx + 1]) data[idx + 1] = g
          if (b > data[idx + 2]) data[idx + 2] = b
        }
      }
    }

    // Write to canvas
    this._ctx.putImageData(imageData, 0, 0)

    // Upload to PixiJS texture (reuse ImageSource when possible)
    if (this._source && this._source.width === w && this._source.height === h) {
      this._source.update()
    } else {
      if (this._texture) this._texture.destroy(true)
      this._source = new ImageSource({
        resource: this._canvas,
        scaleMode: 'linear',
      })
      this._texture = new Texture({ source: this._source })
    }

    // Position and scale sprite to cover tile range in world space
    this._sprite.texture = this._texture!
    this._sprite.x = minTX * TILE_SIZE
    this._sprite.y = minTY * TILE_SIZE
    this._sprite.width = w * TILE_SIZE
    this._sprite.height = h * TILE_SIZE
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    if (this._texture) this._texture.destroy(true)
    this._sprite.destroy()
    this._texture = null
    this._source = null
  }
}
