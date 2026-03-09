import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from './constants'
import { SpawnIndex } from './SpawnIndex'
import { spawnColorHex } from './spawnColors'
import { resolveCreatureSpriteId } from './creatureSprites'
import { getTextureSync, preloadSheets } from './TextureManager'
import type { AppearanceData } from './appearances'
import type { CreatureDatabase } from './creatures'
import { getCreature } from './creatures'
import type { SpawnPoint } from './sidecars'

const ALPHA_ACTIVE = 0.35
const ALPHA_INACTIVE = 0.20
const ALPHA_NONE = 0.25
const CENTER_ALPHA_BOOST = 0.15
const CREATURE_RADIUS = 4

/**
 * Overlay for spawn areas. Does NOT extend TileOverlay because spawn data
 * lives in sidecars, not on tiles. Manages its own rendering from SpawnPoint[].
 */
export class SpawnOverlay {
  readonly container: Container
  private _graphics: Graphics
  private _spriteContainer: Container
  private _visible = false
  private _dirty = true
  private _lastFloor = -1
  private _lastFloorOffset = NaN

  private _spawns: SpawnPoint[] = []
  private _index = new SpawnIndex()
  private _activeSpawnIdx: number | null = null

  // Dependencies for sprite rendering (optional — falls back to dots)
  private _appearances: AppearanceData | null = null
  private _creatureDb: CreatureDatabase | null = null

  // Sprite pool to avoid GC pressure
  private _spritePool: Sprite[] = []
  private _poolIndex = 0
  private _preloadPending = false
  private _destroyed = false

  constructor() {
    this.container = new Container()
    this._graphics = new Graphics()
    this._spriteContainer = new Container()
    this.container.addChild(this._graphics)
    this.container.addChild(this._spriteContainer)
    this.container.visible = false
  }

  get index(): SpawnIndex {
    return this._index
  }

  /** Set appearance data and creature database for sprite rendering. */
  setDependencies(appearances: AppearanceData, creatureDb: CreatureDatabase): void {
    this._appearances = appearances
    this._creatureDb = creatureDb
    this._dirty = true
  }

  setSpawns(spawns: SpawnPoint[]): void {
    this._spawns = spawns
    this._index.rebuild(spawns)
    this._dirty = true
  }

  setActiveSpawn(spawnIdx: number | null): void {
    if (spawnIdx === this._activeSpawnIdx) return
    this._activeSpawnIdx = spawnIdx
    this._dirty = true
  }

  setVisible(visible: boolean): void {
    this._visible = visible
    this.container.visible = visible
    if (visible) this._dirty = true
  }

  get visible(): boolean {
    return this._visible
  }

  markDirty(): void {
    this._dirty = true
  }

  updateContainerOffset(floorOffset: number): void {
    if (floorOffset !== this._lastFloorOffset) {
      this.container.position.set(-floorOffset, -floorOffset)
      this._lastFloorOffset = floorOffset
    }
  }

  rebuild(floor: number): void {
    if (!this._visible) return

    if (floor !== this._lastFloor) {
      this._dirty = true
      this._lastFloor = floor
    }

    if (!this._dirty) return
    this._dirty = false

    const g = this._graphics
    g.clear()

    // Reset sprite pool
    this._poolIndex = 0

    const hasActive = this._activeSpawnIdx != null
    const missingSheets: number[] = []

    for (let i = 0; i < this._spawns.length; i++) {
      const sp = this._spawns[i]
      if (sp.centerZ !== floor) continue

      const isActive = this._activeSpawnIdx === i
      const baseAlpha = hasActive ? (isActive ? ALPHA_ACTIVE : ALPHA_INACTIVE) : ALPHA_NONE
      const color = spawnColorHex(i)

      // Draw area fill
      const r = sp.radius
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = sp.centerX + dx
          const ty = sp.centerY + dy
          const isCenter = dx === 0 && dy === 0
          g.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          g.fill({ color, alpha: isCenter ? baseAlpha + CENTER_ALPHA_BOOST : baseAlpha })
        }
      }

      // Draw creatures
      for (const c of sp.creatures) {
        if (c.z !== floor) continue

        const rendered = this._tryRenderCreatureSprite(c.name, c.direction, c.x, c.y, missingSheets)
        if (!rendered) {
          // Fallback: colored dot
          const cx = c.x * TILE_SIZE + TILE_SIZE / 2
          const cy = c.y * TILE_SIZE + TILE_SIZE / 2
          g.circle(cx, cy, CREATURE_RADIUS)
          g.fill({ color, alpha: Math.min(baseAlpha + 0.3, 0.8) })
        }
      }
    }

    // Hide unused sprites from the pool
    for (let i = this._poolIndex; i < this._spritePool.length; i++) {
      this._spritePool[i].visible = false
    }

    // Batch-preload any missing sprite sheets, then re-render
    if (missingSheets.length > 0 && !this._preloadPending) {
      const unique = [...new Set(missingSheets)]
      this._preloadPending = true
      preloadSheets(unique).then(() => {
        if (this._destroyed) return
        this._preloadPending = false
        this._dirty = true
      })
    }
  }

  /** Try to render a creature as a sprite. Returns true if successful. */
  private _tryRenderCreatureSprite(
    name: string,
    direction: number,
    tileX: number,
    tileY: number,
    missingSheets: number[],
  ): boolean {
    if (!this._appearances || !this._creatureDb) return false

    const info = getCreature(this._creatureDb, name)
    if (!info) return false

    const spriteId = resolveCreatureSpriteId(info.outfit, this._appearances, direction)
    if (!spriteId) return false

    const texture = getTextureSync(spriteId)
    if (!texture) {
      missingSheets.push(spriteId)
      return false
    }

    const sprite = this._acquireSprite()
    sprite.texture = texture
    sprite.visible = true

    // Position: bottom-center anchored on the tile
    const tw = texture.width
    const th = texture.height
    sprite.x = tileX * TILE_SIZE + (TILE_SIZE - tw) / 2
    sprite.y = tileY * TILE_SIZE + TILE_SIZE - th

    return true
  }

  /** Get a sprite from the pool, creating one if needed. */
  private _acquireSprite(): Sprite {
    if (this._poolIndex < this._spritePool.length) {
      return this._spritePool[this._poolIndex++]
    }
    const sprite = new Sprite(Texture.EMPTY)
    sprite.visible = false
    this._spriteContainer.addChild(sprite)
    this._spritePool.push(sprite)
    this._poolIndex++
    return sprite
  }

  destroy(): void {
    this._destroyed = true
    for (const s of this._spritePool) s.destroy()
    this._spritePool.length = 0
    this._graphics.destroy()
    this._spriteContainer.destroy({ children: true })
    this.container.destroy()
  }
}
