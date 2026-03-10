import type { Graphics } from 'pixi.js'
import type { OtbmTile } from '../otbm'
import { tileKey } from '../otbm'
import { TileOverlay, ALPHA_NONE } from '../TileOverlay'
import type { SpawnManager } from './SpawnManager'

/**
 * Parameterized overlay for spawn zones (monster or NPC).
 * Draws colored rectangles on tiles covered by spawns, with
 * darkening for overlapping zones and a brighter fill for spawn centers.
 */
export class SpawnOverlay extends TileOverlay {
  private _counts: Map<string, number>
  private _centers: Set<string>
  private _color: number
  private _centerColor: number

  constructor(spawnManager: SpawnManager, type: 'monster' | 'npc', color: number, centerColor: number) {
    super()
    this._counts = type === 'monster' ? spawnManager.monsterSpawnCounts : spawnManager.npcSpawnCounts
    this._centers = type === 'monster' ? spawnManager.monsterSpawns : spawnManager.npcSpawns
    this._color = color
    this._centerColor = centerColor
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

    const isCenter = this._centers.has(key)

    // Overlap darkening: base alpha increases with overlapping spawn zones
    const alpha = Math.min(ALPHA_NONE + (count - 1) * 0.08, 0.6)
    const color = isCenter ? this._centerColor : this._color

    this.fillRect(g, tile.x, tile.y, color, isCenter ? alpha + 0.1 : alpha)
  }
}
