import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pixi.js
vi.mock('pixi.js', () => {
  class MockGraphics {
    clear = vi.fn().mockReturnThis()
    rect = vi.fn().mockReturnThis()
    fill = vi.fn().mockReturnThis()
    stroke = vi.fn().mockReturnThis()
    destroy = vi.fn()
  }
  class MockContainer {
    children: unknown[] = []
    position = { set: vi.fn() }
    addChild = vi.fn((child: unknown) => { this.children.push(child); return child })
    destroy = vi.fn()
  }
  return { Container: MockContainer, Graphics: MockGraphics }
})

import { ClientBoxOverlay } from './ClientBoxOverlay'

function makeCamera(x = 0, y = 0, zoom = 1, floor = 7) {
  return {
    x,
    y,
    zoom,
    floor,
    getFloorOffset: vi.fn().mockReturnValue(0),
  } as unknown as import('./Camera').Camera
}

describe('ClientBoxOverlay', () => {
  let overlay: ClientBoxOverlay

  beforeEach(() => {
    overlay = new ClientBoxOverlay()
  })

  it('starts invisible and does not draw', () => {
    const camera = makeCamera()
    overlay.update(camera, 0, 800, 600)
    expect(overlay.visible).toBe(false)
  })

  it('draws when visible', () => {
    overlay.setVisible(true)
    const camera = makeCamera(100, 100)
    overlay.update(camera, 0, 800, 600)

    const boxGfx = (overlay as any)._boxGraphics
    expect(boxGfx.rect).toHaveBeenCalled()
    expect(boxGfx.stroke).toHaveBeenCalled()
  })

  it('visibility toggle clears graphics', () => {
    overlay.setVisible(true)
    const camera = makeCamera()
    overlay.update(camera, 0, 800, 600)

    overlay.setVisible(false)
    expect(overlay.visible).toBe(false)
    expect((overlay as any)._darkGraphics.clear).toHaveBeenCalled()
    expect((overlay as any)._boxGraphics.clear).toHaveBeenCalled()
  })

  it('dirty-key optimization skips redundant redraws', () => {
    overlay.setVisible(true)
    const camera = makeCamera(100, 100)

    overlay.update(camera, 0, 800, 600)
    const boxGfx = (overlay as any)._boxGraphics
    const clearCount = boxGfx.clear.mock.calls.length

    // Second draw with same state — should skip
    overlay.update(camera, 0, 800, 600)
    expect(boxGfx.clear.mock.calls.length).toBe(clearCount)
  })

  it('redraws when camera moves', () => {
    overlay.setVisible(true)
    const camera1 = makeCamera(100, 100)
    overlay.update(camera1, 0, 800, 600)

    const boxGfx = (overlay as any)._boxGraphics
    const clearCount = boxGfx.clear.mock.calls.length

    const camera2 = makeCamera(200, 100)
    overlay.update(camera2, 0, 800, 600)
    expect(boxGfx.clear.mock.calls.length).toBeGreaterThan(clearCount)
  })

  it('container offset is applied correctly', () => {
    overlay.updateContainerOffset(64)
    expect(overlay.container.position.set).toHaveBeenCalledWith(-64, -64)
  })

  it('container offset skips if unchanged', () => {
    overlay.updateContainerOffset(64)
    const setCalls = (overlay.container.position.set as any).mock.calls.length
    overlay.updateContainerOffset(64)
    expect((overlay.container.position.set as any).mock.calls.length).toBe(setCalls)
  })

  it('destroy cleans up graphics and container', () => {
    overlay.destroy()
    expect((overlay as any)._darkGraphics.destroy).toHaveBeenCalled()
    expect((overlay as any)._boxGraphics.destroy).toHaveBeenCalled()
    expect(overlay.container.destroy).toHaveBeenCalled()
  })
})
