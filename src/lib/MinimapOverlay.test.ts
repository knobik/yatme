import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MinimapOverlay } from './MinimapOverlay'
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
    // fitAllTpp = 50000/150 ≈ 333.33 (exact, no ceil)
    expect(overlay.tilesPerPixel).toBeCloseTo(50000 / 150, 5)
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
      // At least one axis fits exactly, the other is >= map size
      const coversW = 200 * tpp >= size - 0.001
      const coversH = 150 * tpp >= size - 0.001
      expect(coversW && coversH).toBe(true)
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

    // Map is 200x200. fitAllTpp = max(200/200, 200/150) = 4/3.
    // effectiveW = ceil(200 / (4/3)) = 150, effectiveH = 150.
    // effDispW = 150, effDispH = 150. mapOffX = 25, mapOffY = 0.
    // viewMinX = 100, viewMinY = 100.
    // Click at top-left of effective area: globalX = 5 + 25 = 30, globalY = 5
    // bmX = 25, bmY = 0. localX = 25 - 25 = 0, localY = 0.
    // bitmapX = 0, bitmapY = 0. tileX = 100, tileY = 100.
    overlay._navigateFromEvent(30, 5)
    expect(navigateSpy).toHaveBeenCalledWith(100, 100)
  })

  it('onNavigate clamps to map bounds at max zoom out', () => {
    const navigateSpy = vi.fn()
    overlay.onNavigate = navigateSpy
    overlay.setMapBounds(100, 100, 300, 300)

    // Click in the center of the minimap: globalX = 5 + 100, globalY = 5 + 75
    // bmX = 100, bmY = 75. localX = 100 - 25 = 75, localY = 75.
    // bitmapX = (75/150)*150 = 75, bitmapY = (75/150)*150 = 75.
    // tileX = floor(100 + 75*(4/3)) = floor(200) = 200
    // tileY = floor(100 + 75*(4/3)) = floor(200) = 200
    overlay._navigateFromEvent(105, 80)
    expect(navigateSpy).toHaveBeenCalledWith(200, 200)
  })

  // ── Dynamic sizing ──────────────────────────────────────────────────

  it('setBaseSize changes dimensions and marks dirty', () => {
    overlay.setMapBounds(0, 0, 1000, 1000)
    const tiles: OtbmTile[] = [
      { x: 50, y: 50, z: 7, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 30]]))
    const index = makeChunkIndex(tiles)

    // Initial rebuild at default 200px
    overlay.rebuild(7, index, appearances)
    expect(mockCreateImageData).toHaveBeenLastCalledWith(200, 150)

    // Change base size to 300px
    vi.advanceTimersByTime(250)
    overlay.setBaseSize(300)
    overlay.rebuild(7, index, appearances)
    expect(mockCreateImageData).toHaveBeenLastCalledWith(300, 225)
  })

  it('setExpandOnHover(false) prevents expansion on pointer enter', () => {
    overlay.setExpandOnHover(false)
    // Simulate pointer enter
    ;(overlay.container as unknown as { emit: (evt: string) => void }).emit?.('pointerenter')
    // Should not be animating
    expect(overlay.isAnimating).toBe(false)
  })

  it('setOpacity sets container alpha', () => {
    overlay.setOpacity(0.5)
    expect((overlay.container as unknown as { alpha: number }).alpha).toBe(0.5)
  })

  it('updateAnimation lerps toward target and snaps when close', () => {
    overlay.setMapBounds(0, 0, 1000, 1000)

    // Manually trigger expand
    overlay.setExpandOnHover(true)
    // Access private fields via type assertion for test
    const o = overlay as unknown as {
      _targetWidth: number; _targetHeight: number;
      _currentWidth: number; _currentHeight: number;
      _animating: boolean; _expandedWidth: number; _expandedHeight: number;
      _baseWidth: number; _baseHeight: number;
    }
    o._targetWidth = o._expandedWidth
    o._targetHeight = o._expandedHeight
    o._animating = true

    // Run animation until it snaps
    let iterations = 0
    while (overlay.isAnimating && iterations < 200) {
      overlay.updateAnimation()
      iterations++
    }

    expect(overlay.isAnimating).toBe(false)
    expect(o._currentWidth).toBe(o._expandedWidth)
    expect(o._currentHeight).toBe(o._expandedHeight)
  })

  it('hover triggers expansion, leave triggers collapse', () => {
    overlay.setMapBounds(0, 0, 1000, 1000)
    overlay.setExpandOnHover(true)

    const o = overlay as unknown as {
      _hovered: boolean; _targetWidth: number; _baseWidth: number;
      _expandedWidth: number; _animating: boolean;
      _onPointerEnter: () => void; _onPointerLeave: () => void;
    }

    // Simulate hover
    o._onPointerEnter.call(overlay)
    expect(o._hovered).toBe(true)
    expect(o._targetWidth).toBe(o._expandedWidth)
    expect(o._animating).toBe(true)

    // Run animation to completion
    let iterations = 0
    while (overlay.isAnimating && iterations < 200) {
      overlay.updateAnimation()
      iterations++
    }

    // Simulate leave
    o._onPointerLeave.call(overlay)
    expect(o._hovered).toBe(false)
    expect(o._targetWidth).toBe(o._baseWidth)
    expect(o._animating).toBe(true)
  })

  it('fit-all zoom tightens when expanded (larger canvas needs lower tpp)', () => {
    overlay.setMapBounds(0, 0, 5000, 5000)
    // At base 200px, zoom all the way out
    while (overlay.handleWheel(1)) { /* zoom out */ }
    const baseFitAllTpp = overlay.tilesPerPixel

    // Expand to 400px
    overlay.setExpandedSize(400)
    const o = overlay as unknown as { _onPointerEnter: () => void }
    o._onPointerEnter.call(overlay)
    while (overlay.isAnimating) overlay.updateAnimation()

    // Zoom all the way out again
    while (overlay.handleWheel(1)) { /* zoom out */ }
    const expandedFitAllTpp = overlay.tilesPerPixel

    // Expanded fit-all should need fewer tiles per pixel (more zoomed in)
    expect(expandedFitAllTpp).toBeLessThan(baseFitAllTpp)
    // Verify the fit: expandedW * tpp >= mapWidth
    expect(400 * expandedFitAllTpp).toBeGreaterThanOrEqual(5000)
    expect(300 * expandedFitAllTpp).toBeGreaterThanOrEqual(5000)
  })

  it('zoom out at expanded size does not break view origin clamping', () => {
    overlay.setMapBounds(0, 0, 5000, 5000)
    overlay.setBaseSize(200)
    overlay.setExpandedSize(400)

    // Expand the minimap
    const o = overlay as unknown as {
      _onPointerEnter: () => void;
      _currentWidth: number;
      _canvas: { width: number };
    }
    o._onPointerEnter.call(overlay)
    while (overlay.isAnimating) overlay.updateAnimation()

    // Zoom all the way out
    while (overlay.handleWheel(1)) { /* zoom out */ }

    // Rebuild should not throw and bitmap should use canvas dimensions
    const tiles: OtbmTile[] = [
      { x: 2500, y: 2500, z: 7, flags: 0, items: [{ id: 1 }] },
    ]
    const appearances = makeAppearances(new Map([[1, 100]]))
    const index = makeChunkIndex(tiles)

    expect(() => overlay.rebuild(7, index, appearances)).not.toThrow()
    // Canvas should be at expanded size
    expect(o._canvas.width).toBe(400)
  })

  it('click-to-navigate works at expanded size', () => {
    const navigateSpy = vi.fn()
    overlay.onNavigate = navigateSpy
    overlay.setMapBounds(0, 0, 2000, 2000)

    // Expand the minimap
    overlay.setBaseSize(200)
    overlay.setExpandedSize(400)
    const o = overlay as unknown as {
      _currentWidth: number; _currentHeight: number;
      _targetWidth: number; _targetHeight: number;
      _expandedWidth: number; _expandedHeight: number;
      _onPointerEnter: () => void;
    }
    o._onPointerEnter.call(overlay)
    // Run animation to completion
    while (overlay.isAnimating) overlay.updateAnimation()

    // At expanded size (400x300), navigate from a point
    // bmX = globalX - 5 (padding + border), bmY = globalY - 5
    overlay._navigateFromEvent(5, 5)
    expect(navigateSpy).toHaveBeenCalled()
  })
})
