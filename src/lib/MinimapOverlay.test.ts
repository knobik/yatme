import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MinimapOverlay, BASE_ZOOM_LEVELS } from './MinimapOverlay'
import type { AppearanceData } from './appearances'
import type { OtbmTile } from './otbm'
import { CHUNK_SIZE } from './constants'
import { chunkKeyStr } from './ChunkManager'

// Stub PixiJS
vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = []
    visible = true
    eventMode = ''
    cursor = ''
    sortableChildren = false
    x = 0
    y = 0
    zIndex = 0
    addChild(child: unknown) { this.children.push(child) }
    on() {}
    off() {}
    destroy() {}
  }
  class MockSprite {
    texture: unknown = null
    x = 0
    y = 0
    width = 0
    height = 0
    zIndex = 0
    destroy() {}
  }
  class MockGraphics {
    zIndex = 0
    clear() { return this }
    setStrokeStyle() { return this }
    setFillStyle() { return this }
    rect() { return this }
    roundRect() { return this }
    stroke() { return this }
    fill() { return this }
    destroy() {}
  }
  class MockTexture {
    source: unknown
    constructor(opts: { source: unknown }) { this.source = opts.source }
    destroy() {}
  }
  class MockImageSource {
    width: number
    height: number
    resource: unknown
    constructor(opts: { resource: { width: number; height: number }; scaleMode?: string }) {
      this.resource = opts.resource
      this.width = opts.resource.width
      this.height = opts.resource.height
    }
    update() {}
  }
  class MockTextureSource {
    static defaultOptions = { scaleMode: 'nearest' }
  }
  return {
    Container: MockContainer, Sprite: MockSprite, Graphics: MockGraphics,
    Texture: MockTexture, ImageSource: MockImageSource, TextureSource: MockTextureSource,
  }
})

// Stub HTMLCanvasElement.getContext
const mockPutImageData = vi.fn()
const mockCreateImageData = vi.fn((w: number, h: number) => ({
  data: new Uint8ClampedArray(w * h * 4),
  width: w,
  height: h,
}))

vi.stubGlobal('document', {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          putImageData: mockPutImageData,
          createImageData: mockCreateImageData,
        }),
      }
    }
    return {}
  },
})

function makeAppearances(automapColors: Map<number, number>): AppearanceData {
  const objects = new Map<number, { id: number; flags: { automap?: { color: number } } }>()
  for (const [id, color] of automapColors) {
    objects.set(id, { id, flags: { automap: { color } } })
  }
  return { objects, outfits: new Map(), effects: new Map(), missiles: new Map() } as unknown as AppearanceData
}

function makeChunkIndex(tiles: OtbmTile[]): Map<string, OtbmTile[]> {
  const index = new Map<string, OtbmTile[]>()
  for (const tile of tiles) {
    const cx = Math.floor(tile.x / CHUNK_SIZE)
    const cy = Math.floor(tile.y / CHUNK_SIZE)
    const key = chunkKeyStr(cx, cy, tile.z)
    const bucket = index.get(key) ?? []
    bucket.push(tile)
    index.set(key, bucket)
  }
  return index
}

describe('MinimapOverlay', () => {
  let overlay: MinimapOverlay

  beforeEach(() => {
    vi.useFakeTimers()
    mockPutImageData.mockClear()
    mockCreateImageData.mockClear()
    overlay = new MinimapOverlay()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a container', () => {
    expect(overlay.container).toBeDefined()
  })

  it('setVisible toggles visibility', () => {
    overlay.setVisible(false)
    expect(overlay.container.visible).toBe(false)
    overlay.setVisible(true)
    expect(overlay.container.visible).toBe(true)
  })

  it('rebuild generates bitmap with fixed 200x150 dimensions', () => {
    overlay.setMapBounds(0, 0, 100, 100)
    const tiles: OtbmTile[] = [
      { x: 50, y: 50, z: 7, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 30]]))
    const index = makeChunkIndex(tiles)

    overlay.rebuild(7, index, appearances)
    expect(mockCreateImageData).toHaveBeenCalledWith(200, 150)
  })

  it('does not rebuild when not dirty, floor unchanged, and view unchanged', () => {
    overlay.setMapBounds(0, 0, 50, 50)
    const tiles: OtbmTile[] = [
      { x: 10, y: 10, z: 7, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 100]]))
    const index = makeChunkIndex(tiles)

    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(1)

    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(1)
  })

  it('rebuilds when floor changes', () => {
    overlay.setMapBounds(0, 0, 50, 50)
    const tiles: OtbmTile[] = [
      { x: 10, y: 10, z: 7, flags: 0, items: [{ id: 1 }] },
      { x: 10, y: 10, z: 6, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 100]]))
    const index = makeChunkIndex(tiles)

    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(250)
    overlay.rebuild(6, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(2)
  })

  it('rebuilds after markDirty is called', () => {
    overlay.setMapBounds(0, 0, 50, 50)
    const tiles: OtbmTile[] = [
      { x: 10, y: 10, z: 7, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 100]]))
    const index = makeChunkIndex(tiles)

    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(250)
    overlay.markDirty()
    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(2)
  })

  it('does not rebuild when hidden', () => {
    overlay.setMapBounds(0, 0, 50, 50)
    overlay.setVisible(false)
    const tiles: OtbmTile[] = [
      { x: 10, y: 10, z: 7, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 100]]))
    const index = makeChunkIndex(tiles)

    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).not.toHaveBeenCalled()
  })

  it('uses last non-zero automap color from tile items (reverse scan)', () => {
    overlay.setMapBounds(0, 0, 50, 50)
    const tiles: OtbmTile[] = [
      { x: 10, y: 10, z: 7, flags: 0, items: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    ]
    const objects = new Map<number, { id: number; flags: { automap?: { color: number } } }>()
    objects.set(1, { id: 1, flags: {} })
    objects.set(2, { id: 2, flags: { automap: { color: 100 } } })
    objects.set(3, { id: 3, flags: { automap: { color: 50 } } })
    const appearances = { objects, outfits: new Map(), effects: new Map(), missiles: new Map() } as unknown as AppearanceData
    const index = makeChunkIndex(tiles)

    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(1)
  })

  it('destroy cleans up without errors', () => {
    overlay.setMapBounds(0, 0, 50, 50)
    expect(() => overlay.destroy()).not.toThrow()
  })

  // ── Zoom ──────────────────────────────────────────────────────────

  it('starts at fit-all zoom level for small maps', () => {
    overlay.setMapBounds(0, 0, 100, 100)
    // fitAllTpp = ceil(max(100/200, 100/150, 1)) = 1
    expect(overlay.tilesPerPixel).toBe(1)
  })

  it('starts at zoom index 2 for large maps (not fit-all)', () => {
    overlay.setMapBounds(0, 0, 5000, 5000)
    // Zoom levels: [1, 2, 4, 8, 16, 32, 34]. Starts at index 2 → tpp=4.
    expect(overlay.tilesPerPixel).toBe(4)
  })

  it('handleWheel zooms in (negative deltaY)', () => {
    overlay.setMapBounds(0, 0, 5000, 5000)
    const initialTpp = overlay.tilesPerPixel

    overlay.handleWheel(-1) // zoom in
    expect(overlay.tilesPerPixel).toBeLessThan(initialTpp)
  })

  it('handleWheel zooms out (positive deltaY)', () => {
    overlay.setMapBounds(0, 0, 5000, 5000)
    // Zoom in first
    overlay.handleWheel(-1)
    const afterZoomIn = overlay.tilesPerPixel

    overlay.handleWheel(1) // zoom out
    expect(overlay.tilesPerPixel).toBeGreaterThan(afterZoomIn)
  })

  it('handleWheel returns false when already at min/max zoom', () => {
    overlay.setMapBounds(0, 0, 100, 100)
    // At tpp=1 (min), zooming in should return false
    expect(overlay.tilesPerPixel).toBe(1)
    expect(overlay.handleWheel(-1)).toBe(false)
  })

  it('handleWheel returns true when zoom changes', () => {
    overlay.setMapBounds(0, 0, 5000, 5000)
    expect(overlay.handleWheel(-1)).toBe(true)
  })

  it('rebuilds after zoom change', () => {
    overlay.setMapBounds(0, 0, 5000, 5000)
    const tiles: OtbmTile[] = [
      { x: 2500, y: 2500, z: 7, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 100]]))
    const index = makeChunkIndex(tiles)

    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(250)
    overlay.handleWheel(-1)
    overlay.rebuild(7, index, appearances)
    expect(mockPutImageData).toHaveBeenCalledTimes(2)
  })

  it('does not zoom out past fit-all level', () => {
    overlay.setMapBounds(0, 0, 50000, 50000)
    // Zoom all the way out to fit-all
    while (overlay.handleWheel(1)) { /* zoom out */ }
    // fitAllTpp = ceil(50000/150) = 334
    expect(overlay.tilesPerPixel).toBe(334)
    expect(overlay.handleWheel(1)).toBe(false)
  })

  it('max zoom out always fits the entire map', () => {
    // For any map size, the fit-all tpp should cover the whole map in 200x150 pixels
    for (const size of [100, 500, 2000, 10000, 50000]) {
      const o = new MinimapOverlay()
      o.setMapBounds(0, 0, size, size)
      // Zoom all the way out
      while (o.handleWheel(1)) { /* zoom out */ }
      const tpp = o.tilesPerPixel
      expect(200 * tpp).toBeGreaterThanOrEqual(size)
      expect(150 * tpp).toBeGreaterThanOrEqual(size)
    }
  })

  // ── Hit test ──────────────────────────────────────────────────────

  it('hitTest returns false when hidden', () => {
    overlay.setMapBounds(0, 0, 100, 100)
    overlay.setVisible(false)
    expect(overlay.hitTest(0, 0)).toBe(false)
  })

  it('hitTest returns true for point inside minimap bounds', () => {
    overlay.setMapBounds(0, 0, 100, 100)
    // Container positioned by updateViewport, default x/y = 0
    expect(overlay.hitTest(5, 5)).toBe(true)
  })

  // ── Navigation ────────────────────────────────────────────────────

  it('onNavigate fires with correct tile coordinates', () => {
    const navigateSpy = vi.fn()
    overlay.onNavigate = navigateSpy
    overlay.setMapBounds(100, 100, 300, 300)

    // Map is 200x200. Auto-fit needs tpp=2 (200 > 150*1).
    // Center = (200, 200). At tpp=2: viewTilesW=400, viewTilesH=300.
    // viewMinX = 200 - 200 = 0, viewMinY = 200 - 150 = 50.
    // _navigateFromEvent: bmX = globalX - padding(4) - border(1) = globalX - 5
    // globalX=5, globalY=5 -> bmX=0, bmY=0 -> tile (0, 50)
    overlay._navigateFromEvent(5, 5)
    expect(navigateSpy).toHaveBeenCalledWith(0, 50)
  })
})
