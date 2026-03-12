import { Assets, Container, Graphics as PixiGraphics, Sprite, Texture, type Graphics } from 'pixi.js'
import type { OtbmTile } from '../otbm'
import { tileKey } from '../otbm'
import { TILE_SIZE } from '../constants'
import { floorFromChunkKey } from '../ChunkManager'
import { TileOverlay, ALPHA_NONE } from '../TileOverlay'
import type { SpawnManager } from './SpawnManager'
import { TILE_CENTER, svgToDataUrl, createIconBadge } from '../overlayUtils'

// Phosphor Bug Beetle icon (256x256 viewBox, fill white for tinting)
const BUG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="white" viewBox="0 0 256 256"><path d="M208,152h16a8,8,0,0,0,0-16H208V120h16a8,8,0,0,0,0-16H207.6a79.76,79.76,0,0,0-21.44-46.85l19.5-19.49a8,8,0,0,0-11.32-11.32l-20.29,20.3a79.74,79.74,0,0,0-92.1,0L61.66,26.34A8,8,0,0,0,50.34,37.66l19.5,19.49A79.76,79.76,0,0,0,48.4,104H32a8,8,0,0,0,0,16H48v16H32a8,8,0,0,0,0,16H48v8c0,2.7.14,5.37.4,8H32a8,8,0,0,0,0,16H51.68a80,80,0,0,0,152.64,0H224a8,8,0,0,0,0-16H207.6c.26-2.63.4-5.3.4-8ZM128,48a64.07,64.07,0,0,1,63.48,56h-127A64.07,64.07,0,0,1,128,48Zm8,175.48V144a8,8,0,0,0-16,0v79.48A64.07,64.07,0,0,1,64,160V120H192v40A64.07,64.07,0,0,1,136,223.48Z"/></svg>`

// Phosphor Chat Circle Text icon (256x256 viewBox, fill white for tinting)
const CHAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="white" viewBox="0 0 256 256"><path d="M168,112a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,112Zm-8,24H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm72-8A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"/></svg>`

/** Shared texture cache — loaded once, reused across overlays. */
let monsterIconTexture: Texture | null = null
let npcIconTexture: Texture | null = null
let loadingPromise: Promise<boolean> | null = null

function ensureIconTextures(): Promise<boolean> {
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    try {
      const [monster, npc] = await Promise.all([
        Assets.load<Texture>(svgToDataUrl(BUG_SVG)),
        Assets.load<Texture>(svgToDataUrl(CHAT_SVG)),
      ])
      monsterIconTexture = monster
      npcIconTexture = npc
      return true
    } catch (err) {
      console.error('[SpawnOverlay] Failed to load icon textures:', err)
      loadingPromise = null
      return false
    }
  })()
  return loadingPromise
}

/**
 * Parameterized overlay for spawn zones (monster or NPC).
 * Draws colored rectangles on tiles covered by spawns, with
 * a Phosphor icon (bug beetle / chat bubble) at spawn centers.
 */
export class SpawnOverlay extends TileOverlay {
  private _counts: Map<string, number>
  private _centers: Set<string>
  private _color: number
  private _centerColor: number
  private _type: 'monster' | 'npc'

  /** Container for center-tile icon sprites. */
  private _iconContainer = new Container()
  private _iconSprites = new Map<string, Sprite>()
  private _lastIconFloor = -1
  private _iconsDirtyFull = true
  private _iconsDirtyChunks = new Set<string>()
  private _iconsReady = false
  private _emptyIconChunks = new Set<string>()
  private _ghostContainer = new Container()
  private _ghostPos: { x: number; y: number; z: number; radius: number } | null = null

  constructor(spawnManager: SpawnManager, type: 'monster' | 'npc', color: number, centerColor: number) {
    super()
    this._counts = type === 'monster' ? spawnManager.monsterSpawnCounts : spawnManager.npcSpawnCounts
    this._centers = type === 'monster' ? spawnManager.monsterSpawns : spawnManager.npcSpawns
    this._color = color
    this._centerColor = centerColor
    this._type = type

    this.container.addChild(this._iconContainer)

    this._ghostContainer.alpha = 0.5
    this._ghostContainer.visible = false
    this.container.addChild(this._ghostContainer)

    // Load icon textures asynchronously
    ensureIconTextures().then((ok) => {
      if (!ok) return
      this._iconsReady = true
      this.markDirty()
    })
  }

  setDragGhost(x: number, y: number, z: number, radius: number): void {
    this._ghostPos = { x, y, z, radius }
    this._rebuildGhost()
  }

  clearDragGhost(): void {
    if (this._ghostPos) {
      this._ghostPos = null
      this._ghostContainer.removeChildren().forEach(c => c.destroy())
      this._ghostContainer.visible = false
    }
  }

  private _rebuildGhost(): void {
    this._ghostContainer.removeChildren().forEach(c => c.destroy())
    if (!this._ghostPos) {
      this._ghostContainer.visible = false
      return
    }

    const { x: gx, y: gy, radius } = this._ghostPos

    // Draw zone tiles covering the spawn radius
    const zoneGfx = new PixiGraphics()
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        zoneGfx.rect((gx + dx) * TILE_SIZE, (gy + dy) * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        zoneGfx.fill({ color: this._color, alpha: ALPHA_NONE })
      }
    }
    this._ghostContainer.addChild(zoneGfx)

    // Center icon (only if textures are ready)
    if (this._iconsReady) {
      const texture = this._type === 'monster' ? monsterIconTexture : npcIconTexture
      if (texture) {
        const cx = gx * TILE_SIZE + TILE_CENTER
        const cy = gy * TILE_SIZE + TILE_CENTER
        this._ghostContainer.addChild(createIconBadge(cx, cy, texture, this._centerColor))
      }
    }

    this._ghostContainer.visible = true
  }

  protected hasActiveSelection(): boolean {
    return false
  }

  protected shouldDrawTile(tile: OtbmTile): boolean {
    return (this._counts.get(tileKey(tile.x, tile.y, tile.z)) ?? 0) > 0
  }

  protected drawTile(g: Graphics, tile: OtbmTile): void {
    const key = tileKey(tile.x, tile.y, tile.z)
    const count = this._counts.get(key) ?? 0
    if (count <= 0) return

    // Overlap darkening: base alpha increases with overlapping spawn zones
    const alpha = Math.min(ALPHA_NONE + (count - 1) * 0.08, 0.6)

    this.fillRect(g, tile.x, tile.y, this._color, alpha)
  }

  rebuild(
    floor: number,
    chunkIndex: Map<string, OtbmTile[]>,
    floorKeys?: Set<string>,
    visibleKeys?: Set<string>,
  ): void {
    super.rebuild(floor, chunkIndex, floorKeys, visibleKeys)
    if (!this.visible || !this._iconsReady) return
    this.rebuildIcons(floor, chunkIndex, floorKeys, visibleKeys)
  }

  private rebuildIcons(
    floor: number,
    chunkIndex: Map<string, OtbmTile[]>,
    floorKeys?: Set<string>,
    visibleKeys?: Set<string>,
  ): void {
    // Floor changed — need full icon rebuild
    if (floor !== this._lastIconFloor) {
      this._iconsDirtyFull = true
      this._lastIconFloor = floor
    }

    const texture = this._type === 'monster' ? monsterIconTexture : npcIconTexture
    if (!texture) return

    if (this._iconsDirtyFull) {
      this._iconsDirtyFull = false
      this._iconsDirtyChunks.clear()
      this._emptyIconChunks.clear()
      // Full rebuild: destroy all and recreate
      for (const s of this._iconSprites.values()) s.destroy()
      this._iconSprites.clear()
      this._iconContainer.removeChildren()

      if (floorKeys) {
        for (const key of floorKeys) {
          if (visibleKeys && !visibleKeys.has(key)) continue
          const tiles = chunkIndex.get(key)
          if (tiles) this.rebuildIconsForChunk(tiles, floor, texture)
        }
      } else {
        for (const [key, tiles] of chunkIndex) {
          if (floorFromChunkKey(key) !== floor) continue
          this.rebuildIconsForChunk(tiles, floor, texture)
        }
      }
      return
    }

    if (this._iconsDirtyChunks.size > 0) {
      const dirty = this._iconsDirtyChunks
      this._iconsDirtyChunks = new Set()
      // Incremental: only update sprites for dirty chunks
      for (const chunkKey of dirty) {
        if (floorFromChunkKey(chunkKey) !== floor) continue
        // Remove existing sprites for tiles in this chunk
        const tiles = chunkIndex.get(chunkKey)
        if (tiles) {
          for (const tile of tiles) {
            const key = tileKey(tile.x, tile.y, tile.z)
            const existing = this._iconSprites.get(key)
            if (existing) {
              existing.destroy()
              this._iconSprites.delete(key)
            }
          }
          this.rebuildIconsForChunk(tiles, floor, texture)
        }
      }
    }

    // Expand icons to newly-visible chunks
    if (floorKeys && visibleKeys) {
      for (const key of visibleKeys) {
        if (this._emptyIconChunks.has(key)) continue
        if (!floorKeys.has(key)) continue
        const tiles = chunkIndex.get(key)
        if (!tiles) { this._emptyIconChunks.add(key); continue }
        let found = false
        for (const tile of tiles) {
          if (tile.z !== floor) continue
          const tk = tileKey(tile.x, tile.y, tile.z)
          if (!this._centers.has(tk)) continue
          if (this._iconSprites.has(tk)) continue
          // Missing icon for a visible center — rebuild chunk icons
          this.rebuildIconsForChunk(tiles, floor, texture)
          found = true
          break
        }
        if (!found) this._emptyIconChunks.add(key)
      }
    }
  }

  private rebuildIconsForChunk(tiles: OtbmTile[], floor: number, texture: Texture): void {
    for (const tile of tiles) {
      if (tile.z !== floor) continue
      const key = tileKey(tile.x, tile.y, tile.z)
      if (!this._centers.has(key)) continue

      const cx = tile.x * TILE_SIZE + TILE_CENTER
      const cy = tile.y * TILE_SIZE + TILE_CENTER

      const group = createIconBadge(cx, cy, texture, this._centerColor)
      this._iconContainer.addChild(group)
      this._iconSprites.set(key, group as unknown as Sprite)
    }
  }

  invalidateChunks(keys: Iterable<string>): void {
    super.invalidateChunks(keys)
    for (const key of keys) {
      this._iconsDirtyChunks.add(key)
      this._emptyIconChunks.delete(key)
    }
  }

  markDirty(): void {
    super.markDirty()
    this._iconsDirtyFull = true
    this._emptyIconChunks.clear()
  }

  destroy(): void {
    for (const s of this._iconSprites.values()) s.destroy()
    this._iconSprites.clear()
    this._iconContainer.destroy()
    this._ghostContainer.destroy({ children: true })
    super.destroy()
  }
}
