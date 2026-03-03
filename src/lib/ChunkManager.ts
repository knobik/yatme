import { Container } from 'pixi.js'
import { CHUNK_SIZE } from './constants'
import type { AppearanceData } from './appearances'
import type { OtbmTile } from './otbm'

// ── Chunk key ───────────────────────────────────────────────────────

export function chunkKeyStr(cx: number, cy: number, z: number): string {
  return `${cx},${cy},${z}`
}

/** Chunk key from tile world coordinates (divides by CHUNK_SIZE internally). */
export function chunkKeyForTile(x: number, y: number, z: number): string {
  return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)},${z}`
}

// ── Chunk index ─────────────────────────────────────────────────────

export function buildChunkIndex(
  tiles: Map<string, OtbmTile>,
  appearances: AppearanceData,
): { index: Map<string, OtbmTile[]>, animatedKeys: Set<string> } {
  const index = new Map<string, OtbmTile[]>()
  const animatedKeys = new Set<string>()

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

    // Detect animated items for this chunk
    if (!animatedKeys.has(key)) {
      for (const item of tile.items) {
        const appearance = appearances.objects.get(item.id)
        const info = appearance?.frameGroup?.[0]?.spriteInfo
        if (info?.animation && info.animation.spritePhase.length > 1) {
          animatedKeys.add(key)
          break
        }
      }
    }
  }

  // Pre-sort each chunk's tiles by draw order (Y ascending, then X ascending)
  for (const arr of index.values()) {
    arr.sort((a, b) => a.y - b.y || a.x - b.x)
  }
  return { index, animatedKeys }
}

// ── Container cleanup ────────────────────────────────────────────────

function destroyContainer(container: Container): void {
  if (container.isCachedAsTexture) container.cacheAsTexture(false)
  container.removeChildren()
  container.destroy()
}

// ── LRU chunk cache ─────────────────────────────────────────────────

export class ChunkCache {
  private cache = new Map<string, Container>() // insertion-order = LRU order
  private maxSize: number
  onEvict?: (key: string) => void

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  /** Remove from cache and return it (without destroying). Used to restore to screen. */
  take(key: string): Container | undefined {
    const container = this.cache.get(key)
    if (container) {
      this.cache.delete(key)
    }
    return container
  }

  /** Store a container in the cache. Evicts oldest if over capacity. */
  set(key: string, container: Container): void {
    const existing = this.cache.get(key)
    if (existing) {
      destroyContainer(existing)
      this.cache.delete(key)
      this.onEvict?.(key)
    }
    this.cache.set(key, container)
    this.evict()
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  /** Evict and destroy a specific entry. */
  delete(key: string): void {
    const container = this.cache.get(key)
    if (container) {
      destroyContainer(container)
      this.cache.delete(key)
      this.onEvict?.(key)
    }
  }

  clear(): void {
    for (const container of this.cache.values()) {
      destroyContainer(container)
    }
    this.cache.clear()
  }

  private evict(): void {
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value!
      destroyContainer(this.cache.get(firstKey)!)
      this.cache.delete(firstKey)
      this.onEvict?.(firstKey)
    }
  }
}
