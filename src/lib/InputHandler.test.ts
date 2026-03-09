import { describe, it, expect, vi } from 'vitest'
import { setupMapInput, type InputHost } from './InputHandler'
import { makeMapData, makeTile, makeItem } from '../test/fixtures'
import { MIME_TIBIA_ITEM, MIME_TIBIA_INSPECTOR } from './dragUtils'

function makeMockCanvas() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  return {
    addEventListener: vi.fn((type: string, fn: (...args: unknown[]) => void) => {
      const list = listeners.get(type) ?? []
      list.push(fn)
      listeners.set(type, list)
    }),
    removeEventListener: vi.fn((type: string, fn: (...args: unknown[]) => void) => {
      const list = listeners.get(type) ?? []
      listeners.set(type, list.filter(f => f !== fn))
    }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
    fire(type: string, eventProps: Record<string, unknown> = {}) {
      const fns = listeners.get(type) ?? []
      const evt = { preventDefault: vi.fn(), ...eventProps }
      for (const fn of fns) fn(evt)
      return evt
    },
  }
}

function makeMockCamera() {
  return {
    x: 0,
    y: 0,
    zoom: 1,
    getTileAt: vi.fn((mx: number, my: number) => ({ x: Math.floor(mx / 32), y: Math.floor(my / 32), z: 7 })),
    zoomAt: vi.fn(),
  }
}

function makeMockHost(overrides: Partial<InputHost> = {}) {
  const camera = makeMockCamera()
  const mapData = makeMapData([makeTile(3, 3, 7, [makeItem({ id: 10 })])])
  return {
    host: {
      camera,
      mapData,
      ...overrides,
    } as unknown as InputHost,
    camera,
  }
}

describe('setupMapInput', () => {
  describe('setup/cleanup', () => {
    it('attaches event listeners on init', () => {
      const canvas = makeMockCanvas()
      const { host } = makeMockHost()
      const onCameraChange = vi.fn()
      const onSelectTile = vi.fn()

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, onCameraChange, onSelectTile)

      expect(canvas.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function))
      expect(canvas.addEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function))
      expect(canvas.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function))
      expect(canvas.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false })
    })

    it('removes all listeners on cleanup', () => {
      const canvas = makeMockCanvas()
      const { host } = makeMockHost()
      const cleanup = setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())

      cleanup()

      expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function))
      expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function))
    })
  })

  describe('left click -> tool dispatch', () => {
    it('fires onTilePointerDown on pointerdown(button=0)', () => {
      const canvas = makeMockCanvas()
      const onTilePointerDown = vi.fn()
      const { host } = makeMockHost()
      host.onTilePointerDown = onTilePointerDown

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })

      expect(onTilePointerDown).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 3, z: 7 }),
        expect.anything(),
      )
    })

    it('fires onTilePointerMove on subsequent pointermove', () => {
      const canvas = makeMockCanvas()
      const onTilePointerDown = vi.fn()
      const onTilePointerMove = vi.fn()
      const { host } = makeMockHost()
      host.onTilePointerDown = onTilePointerDown
      host.onTilePointerMove = onTilePointerMove

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
      canvas.fire('pointermove', { clientX: 101, clientY: 100, pointerId: 1 })

      expect(onTilePointerMove).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 3, z: 7 }),
        expect.anything(),
      )
    })

    it('fires onTilePointerUp on pointerup', () => {
      const canvas = makeMockCanvas()
      const onTilePointerDown = vi.fn()
      const onTilePointerUp = vi.fn()
      const { host } = makeMockHost()
      host.onTilePointerDown = onTilePointerDown
      host.onTilePointerUp = onTilePointerUp

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
      canvas.fire('pointerup', { clientX: 100, clientY: 100, pointerId: 1 })

      expect(onTilePointerUp).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 3, z: 7 }),
        expect.anything(),
      )
    })
  })

  describe('middle click -> pan', () => {
    it('pans camera on middle-button drag', () => {
      const canvas = makeMockCanvas()
      const { host, camera } = makeMockHost()
      const onCameraChange = vi.fn()

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, onCameraChange, vi.fn())
      canvas.fire('pointerdown', { button: 1, clientX: 100, clientY: 100, pointerId: 1 })
      canvas.fire('pointermove', { clientX: 120, clientY: 110, pointerId: 1 })

      // Camera should have moved by delta / zoom
      expect(camera.x).toBe(-20) // cameraStartX(0) - dx(20) / zoom(1)
      expect(camera.y).toBe(-10)
      expect(onCameraChange).toHaveBeenCalled()
    })
  })

  describe('right click -> context menu', () => {
    it('fires onTileContextMenu on right-click (within 4px threshold)', () => {
      const canvas = makeMockCanvas()
      const onTileContextMenu = vi.fn()
      const { host } = makeMockHost()
      host.onTileContextMenu = onTileContextMenu

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('pointerdown', { button: 2, clientX: 100, clientY: 100, pointerId: 1 })
      canvas.fire('pointerup', { clientX: 100, clientY: 100, pointerId: 1 }) // no movement = click

      expect(onTileContextMenu).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 3, z: 7 }),
        expect.anything(),
        100,
        100,
      )
    })
  })

  describe('click vs drag detection', () => {
    it('treats movement < 4px as click (fires onSelectTile fallback)', () => {
      const canvas = makeMockCanvas()
      const { host } = makeMockHost()
      const onSelectTile = vi.fn()

      // No tool callbacks set → falls through to onSelectTile
      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), onSelectTile)
      canvas.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
      canvas.fire('pointerup', { clientX: 102, clientY: 101, pointerId: 1 }) // < 4px

      expect(onSelectTile).toHaveBeenCalled()
    })

    it('treats movement >= 4px as drag (no onSelectTile)', () => {
      const canvas = makeMockCanvas()
      const { host } = makeMockHost()
      const onSelectTile = vi.fn()

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), onSelectTile)
      canvas.fire('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
      canvas.fire('pointermove', { clientX: 110, clientY: 100, pointerId: 1 }) // 10px drag
      canvas.fire('pointerup', { clientX: 110, clientY: 100, pointerId: 1 })

      expect(onSelectTile).not.toHaveBeenCalled()
    })
  })

  describe('wheel -> zoom', () => {
    it('calls camera.zoomAt on wheel event', () => {
      const canvas = makeMockCanvas()
      const { host, camera } = makeMockHost()
      const onCameraChange = vi.fn()

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, onCameraChange, vi.fn())
      canvas.fire('wheel', { clientX: 400, clientY: 300, deltaY: -100 })

      expect(camera.zoomAt).toHaveBeenCalledWith(400, 300, -100)
      expect(onCameraChange).toHaveBeenCalled()
    })
  })

  describe('drag-and-drop', () => {
    it('fires onItemDrop with parsed itemId from custom MIME type', () => {
      const canvas = makeMockCanvas()
      const onItemDrop = vi.fn()
      const { host } = makeMockHost()
      host.onItemDrop = onItemDrop

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('drop', {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          getData: (type: string) => type === MIME_TIBIA_ITEM ? '42' : '',
        },
      })

      expect(onItemDrop).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 3, z: 7 }),
        42,
      )
    })

    it('fires onInspectorItemDrop when inspector MIME type is present', () => {
      const canvas = makeMockCanvas()
      const onInspectorItemDrop = vi.fn()
      const onItemDrop = vi.fn()
      const { host } = makeMockHost()
      host.onInspectorItemDrop = onInspectorItemDrop
      host.onItemDrop = onItemDrop

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      const source = { x: 10, y: 20, z: 7, index: 2 }
      canvas.fire('drop', {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          getData: (type: string) => {
            if (type === MIME_TIBIA_ITEM) return '42'
            if (type === MIME_TIBIA_INSPECTOR) return JSON.stringify(source)
            return ''
          },
        },
      })

      expect(onInspectorItemDrop).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 3, z: 7 }),
        42,
        source,
      )
      expect(onItemDrop).not.toHaveBeenCalled()
    })

    it('falls back to onItemDrop when inspector data is absent', () => {
      const canvas = makeMockCanvas()
      const onInspectorItemDrop = vi.fn()
      const onItemDrop = vi.fn()
      const { host } = makeMockHost()
      host.onInspectorItemDrop = onInspectorItemDrop
      host.onItemDrop = onItemDrop

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('drop', {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          getData: (type: string) => type === MIME_TIBIA_ITEM ? '42' : '',
        },
      })

      expect(onItemDrop).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 3, z: 7 }),
        42,
      )
      expect(onInspectorItemDrop).not.toHaveBeenCalled()
    })

    it('sets dropEffect to move for inspector drags', () => {
      const canvas = makeMockCanvas()
      const { host } = makeMockHost()

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      const evt = canvas.fire('dragover', {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          types: [MIME_TIBIA_ITEM, MIME_TIBIA_INSPECTOR],
          dropEffect: 'none',
        },
      })

      expect((evt as { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect).toBe('move')
    })

    it('sets dropEffect to copy for palette drags', () => {
      const canvas = makeMockCanvas()
      const { host } = makeMockHost()

      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      const evt = canvas.fire('dragover', {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          types: [MIME_TIBIA_ITEM],
          dropEffect: 'none',
        },
      })

      expect((evt as { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect).toBe('copy')
    })

    it('fires onDragHover with tile position during dragover', () => {
      // Arrange
      const canvas = makeMockCanvas()
      const onDragHover = vi.fn()
      const { host } = makeMockHost()
      host.onDragHover = onDragHover

      // Act
      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('dragover', {
        clientX: 64,
        clientY: 96,
        dataTransfer: {
          types: [MIME_TIBIA_ITEM],
          dropEffect: 'none',
        },
      })

      // Assert
      expect(onDragHover).toHaveBeenCalledWith(
        expect.objectContaining({ x: 2, y: 3, z: 7 }),
      )
    })

    it('fires onDragLeave when drag leaves the canvas', () => {
      // Arrange
      const canvas = makeMockCanvas()
      const onDragLeave = vi.fn()
      const { host } = makeMockHost()
      host.onDragLeave = onDragLeave

      // Act
      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('dragleave', { relatedTarget: null })

      // Assert
      expect(onDragLeave).toHaveBeenCalled()
    })

    it('clears ghost preview on drop by firing onDragLeave', () => {
      // Arrange
      const canvas = makeMockCanvas()
      const onDragLeave = vi.fn()
      const onItemDrop = vi.fn()
      const { host } = makeMockHost()
      host.onDragLeave = onDragLeave
      host.onItemDrop = onItemDrop

      // Act
      setupMapInput(canvas as unknown as HTMLCanvasElement, host, vi.fn(), vi.fn())
      canvas.fire('drop', {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          getData: (type: string) => type === MIME_TIBIA_ITEM ? '42' : '',
        },
      })

      // Assert
      expect(onDragLeave).toHaveBeenCalled()
      expect(onItemDrop).toHaveBeenCalled()
    })
  })
})
