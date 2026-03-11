import { Container, Graphics } from 'pixi.js'
import { TILE_SIZE } from './constants'
import { FloorOffsetTracker } from './overlayUtils'
import { chunkKeyForTile, floorFromChunkKey } from './ChunkManager'
import type { OtbmTile } from './otbm'

export const ALPHA_ACTIVE = 0.35
export const ALPHA_INACTIVE = 0.20
export const ALPHA_NONE = 0.25

/**
 * Base class for tile-based color overlays (zones, houses, etc.).
 *
 * Uses chunk-scoped Graphics objects so that invalidation only redraws
 * affected chunks instead of iterating every tile on the map.
 *
 * Subclasses implement:
 * - `drawTile(g, tile)` — draw a single tile onto a Graphics object
 * - `hasActiveSelection()` — whether an active item is set (affects alpha)
 * - `shouldDrawTile(tile)` — filter tiles during full rebuild
 */
export abstract class TileOverlay {
  readonly container: Container
  private _baseContainer: Container
  private _visible = false
  private _fullDirty = true
  private _dirtyChunks = new Set<string>()
  private _offsetTracker = new FloorOffsetTracker()
  private _lastFloor = -1

  // chunk key -> Graphics for that chunk
  private _chunkGraphics = new Map<string, Graphics>()

  constructor() {
    this.container = new Container()
    this._baseContainer = new Container()
    this.container.addChild(this._baseContainer)
    this.container.visible = false
  }

  setVisible(visible: boolean): void {
    this._visible = visible
    this.container.visible = visible
    if (visible) this._fullDirty = true
  }

  get visible(): boolean { return this._visible }

  /** Mark all chunks dirty — triggers a full rebuild. */
  markDirty(): void {
    this._fullDirty = true
  }

  /** Mark only specific chunks dirty (by chunk key "cx,cy,z"). */
  invalidateChunks(keys: Iterable<string>): void {
    for (const key of keys) {
      this._dirtyChunks.add(key)
    }
  }

  /** Invalidate the overlay chunk for a single tile (used by paint tools). */
  paintTile(x: number, y: number, z: number): void {
    if (!this._visible) return
    this._dirtyChunks.add(chunkKeyForTile(x, y, z))
  }

  updateContainerOffset(floorOffset: number): void {
    this._offsetTracker.updateContainerOffset(this.container, floorOffset)
  }

  rebuild(floor: number, chunkIndex: Map<string, OtbmTile[]>): void {
    if (!this._visible) return

    // Floor changed — need full rebuild
    if (floor !== this._lastFloor) {
      this._fullDirty = true
      this._lastFloor = floor
    }

    if (this._fullDirty) {
      this._fullDirty = false
      this._dirtyChunks.clear()
      this.rebuildAll(chunkIndex, floor)
      return
    }

    if (this._dirtyChunks.size > 0) {
      const dirty = this._dirtyChunks
      this._dirtyChunks = new Set()
      this.rebuildChunks(dirty, chunkIndex, floor)
    }
  }

  destroy(): void {
    for (const g of this._chunkGraphics.values()) g.destroy()
    this._chunkGraphics.clear()
    this._baseContainer.destroy()
    this.container.destroy()
  }

  // ── Helpers for subclasses ────────────────────────────────────

  protected alphaFor(isActive: boolean): number {
    if (!this.hasActiveSelection()) return ALPHA_NONE
    return isActive ? ALPHA_ACTIVE : ALPHA_INACTIVE
  }

  protected fillRect(g: Graphics, x: number, y: number, color: number, alpha: number): void {
    g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    g.fill({ color, alpha })
  }

  // ── Abstract ──────────────────────────────────────────────────

  protected abstract hasActiveSelection(): boolean
  protected abstract shouldDrawTile(tile: OtbmTile): boolean
  protected abstract drawTile(g: Graphics, tile: OtbmTile): void

  // ── Private ───────────────────────────────────────────────────

  /** Full rebuild: clear all chunk Graphics, redraw from chunkIndex. */
  private rebuildAll(chunkIndex: Map<string, OtbmTile[]>, floor: number): void {
    for (const g of this._chunkGraphics.values()) g.destroy()
    this._chunkGraphics.clear()
    this._baseContainer.removeChildren()

    for (const [key, tiles] of chunkIndex) {
      if (floorFromChunkKey(key) !== floor) continue
      this.rebuildSingleChunk(key, tiles)
    }
  }

  /** Rebuild only specific dirty chunks, reusing existing Graphics when possible. */
  private rebuildChunks(
    dirtyKeys: Set<string>,
    chunkIndex: Map<string, OtbmTile[]>,
    floor: number,
  ): void {
    for (const key of dirtyKeys) {
      if (floorFromChunkKey(key) !== floor) continue

      const tiles = chunkIndex.get(key)
      const existing = this._chunkGraphics.get(key)

      if (!tiles || !this.chunkHasOverlayTiles(tiles)) {
        // No overlay tiles in this chunk — remove Graphics if it exists
        if (existing) {
          this._baseContainer.removeChild(existing)
          existing.destroy()
          this._chunkGraphics.delete(key)
        }
        continue
      }

      if (existing) {
        // Reuse: clear and redraw
        existing.clear()
        for (const tile of tiles) {
          if (!this.shouldDrawTile(tile)) continue
          this.drawTile(existing, tile)
        }
      } else {
        this.rebuildSingleChunk(key, tiles)
      }
    }
  }

  /** Build Graphics for a single chunk from its tiles. */
  private rebuildSingleChunk(key: string, tiles: OtbmTile[]): void {
    let g: Graphics | null = null

    for (const tile of tiles) {
      if (!this.shouldDrawTile(tile)) continue
      if (!g) g = new Graphics()
      this.drawTile(g, tile)
    }

    if (g) {
      this._chunkGraphics.set(key, g)
      this._baseContainer.addChild(g)
    }
  }

  private chunkHasOverlayTiles(tiles: OtbmTile[]): boolean {
    for (const tile of tiles) {
      if (this.shouldDrawTile(tile)) return true
    }
    return false
  }
}
