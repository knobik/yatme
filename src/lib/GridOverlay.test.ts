import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pixi.js
vi.mock('pixi.js', () => {
  class MockGraphics {
    clear = vi.fn().mockReturnThis()
    moveTo = vi.fn().mockReturnThis()
    lineTo = vi.fn().mockReturnThis()
    stroke = vi.fn().mockReturnThis()
    destroy = vi.fn()
  }
  class MockContainer {
    children: unknown[] = []
    visible = true
    position = { set: vi.fn() }
    addChild = vi.fn((child: unknown) => { this.children.push(child); return child })
    destroy = vi.fn()
  }
  return { Container: MockContainer, Graphics: MockGraphics }
})

import { GridOverlay } from './GridOverlay'
import { CHUNK_SIZE } from './constants'

function makeCamera(opts: { x?: number; y?: number; zoom?: number; floor?: number } = {}) {
  const { x = 0, y = 0, zoom = 1, floor = 7 } = opts
  return {
    x, y, zoom, floor,
    getFloorOffset: vi.fn().mockReturnValue(0),
    getVisibleRangeForFloor: vi.fn().mockReturnValue({
      startX: 0, startY: 0, endX: 1, endY: 1,
    }),
  } as unknown as import('./Camera').Camera
}

describe('GridOverlay', () => {
  let overlay: GridOverlay

  beforeEach(() => {
    overlay = new GridOverlay()
  })

  it('starts invisible', () => {
    expect(overlay.container.visible).toBe(false)
  })

  it('does not draw when invisible', () => {
    const camera = makeCamera()
    overlay.update(camera)
    const g = (overlay as any)._graphics
    expect(g.moveTo).not.toHaveBeenCalled()
  })

  it('draws grid lines when visible', () => {
    overlay.setVisible(true)
    const camera = makeCamera()
    overlay.update(camera)
    const g = (overlay as any)._graphics
    expect(g.moveTo).toHaveBeenCalled()
    expect(g.lineTo).toHaveBeenCalled()
    expect(g.stroke).toHaveBeenCalled()
  })

  it('draws correct number of lines for viewport', () => {
    overlay.setVisible(true)
    // Range: startX=0,startY=0,endX=1,endY=1 → tiles 0..2*CHUNK_SIZE
    const camera = makeCamera()
    overlay.update(camera)
    const g = (overlay as any)._graphics

    const tileStartX = 0 * CHUNK_SIZE
    const tileEndX = (1 + 1) * CHUNK_SIZE
    const tileStartY = 0 * CHUNK_SIZE
    const tileEndY = (1 + 1) * CHUNK_SIZE

    const expectedHorizontal = tileEndY - tileStartY + 1
    const expectedVertical = tileEndX - tileStartX + 1
    const totalLines = expectedHorizontal + expectedVertical

    // Each line = one moveTo + one lineTo
    expect(g.moveTo.mock.calls.length).toBe(totalLines)
    expect(g.lineTo.mock.calls.length).toBe(totalLines)
  })

  it('skips redraw when viewport unchanged (dirty key)', () => {
    overlay.setVisible(true)
    const camera = makeCamera()
    overlay.update(camera)

    const g = (overlay as any)._graphics
    const clearCount = g.clear.mock.calls.length

    overlay.update(camera)
    expect(g.clear.mock.calls.length).toBe(clearCount)
  })

  it('redraws when zoom changes', () => {
    overlay.setVisible(true)
    const camera1 = makeCamera({ zoom: 1 })
    overlay.update(camera1)

    const g = (overlay as any)._graphics
    const clearCount = g.clear.mock.calls.length

    const camera2 = makeCamera({ zoom: 2 })
    overlay.update(camera2)
    expect(g.clear.mock.calls.length).toBeGreaterThan(clearCount)
  })

  it('clears graphics when toggled off', () => {
    overlay.setVisible(true)
    const camera = makeCamera()
    overlay.update(camera)

    overlay.setVisible(false)
    const g = (overlay as any)._graphics
    expect(g.clear).toHaveBeenCalled()
    expect(overlay.container.visible).toBe(false)
  })

  it('container offset is applied', () => {
    overlay.updateContainerOffset(64)
    expect(overlay.container.position.set).toHaveBeenCalledWith(-64, -64)
  })

  it('destroy cleans up', () => {
    overlay.destroy()
    expect((overlay as any)._graphics.destroy).toHaveBeenCalled()
    expect(overlay.container.destroy).toHaveBeenCalled()
  })
})
