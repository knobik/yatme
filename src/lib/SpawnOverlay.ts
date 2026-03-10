import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE } from './constants'
import { SpawnIndex } from './SpawnIndex'
import { spawnColorHex } from './spawnColors'
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
  private _visible = false
  private _dirty = true
  private _lastFloor = -1
  private _lastFloorOffset = NaN

  private _spawns: SpawnPoint[] = []
  private _index = new SpawnIndex()
  private _activeSpawnIdx: number | null = null

  constructor() {
    this.container = new Container()
    this._graphics = new Graphics()
    this.container.addChild(this._graphics)
    this.container.visible = false
  }

  get index(): SpawnIndex {
    return this._index
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

    const hasActive = this._activeSpawnIdx != null

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

      // Draw creature dots
      for (const c of sp.creatures) {
        if (c.z !== floor) continue
        const cx = c.x * TILE_SIZE + TILE_SIZE / 2
        const cy = c.y * TILE_SIZE + TILE_SIZE / 2
        g.circle(cx, cy, CREATURE_RADIUS)
        g.fill({ color, alpha: Math.min(baseAlpha + 0.3, 0.8) })
      }
    }
  }

  destroy(): void {
    this._graphics.destroy()
    this.container.destroy()
  }
}
