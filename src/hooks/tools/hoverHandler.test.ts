import { describe, it, expect, vi } from 'vitest'
import { createHoverHandler } from './hoverHandler'
import { makeToolContext, makeMockRenderer } from '../../test/toolFixtures'
import { makeGroundBrush, makeMinimalRegistry } from '../../test/brushFixtures'

// Mock types module — control getSelectionPreviewId and getTilesInBrush
vi.mock('./types', async (importOriginal) => {
  const original = await importOriginal<typeof import('./types')>()
  return {
    ...original,
    getSelectionPreviewId: vi.fn(() => 0),
  }
})

import { getSelectionPreviewId } from './types'
const mockGetSelectionPreviewId = vi.mocked(getSelectionPreviewId)

describe('hoverHandler', () => {
  describe('onHover', () => {
    it('updates hoverPosRef.current to given position', () => {
      const { ctx } = makeToolContext({ activeTool: 'draw' })
      const { onHover } = createHoverHandler(ctx)
      onHover({ x: 10, y: 20, z: 7 })

      expect(ctx.hoverPosRef.current).toEqual({ x: 10, y: 20, z: 7 })
    })

    it('calls updateBrushCursor with brush footprint tiles', () => {
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ activeTool: 'draw', brushSize: 0, renderer })
      const { onHover } = createHoverHandler(ctx)
      onHover({ x: 5, y: 5, z: 7 })

      expect(renderer.updateBrushCursor).toHaveBeenCalledWith([{ x: 5, y: 5, z: 7 }])
    })

    it('calls updateGhostPreview with preview item id for draw tool', () => {
      const renderer = makeMockRenderer()
      const brush = makeGroundBrush({ name: 'grass', lookId: 55 })
      const registry = makeMinimalRegistry({ groundBrushes: [brush] })
      mockGetSelectionPreviewId.mockReturnValue(55)

      const { ctx } = makeToolContext({
        activeTool: 'draw',
        selectedBrush: { mode: 'brush', brushType: 'ground', brushName: 'grass' },
        registry,
        renderer,
      })
      const { onHover } = createHoverHandler(ctx)
      onHover({ x: 5, y: 5, z: 7 })

      expect(renderer.updateGhostPreview).toHaveBeenCalledWith(55, [{ x: 5, y: 5, z: 7 }])
    })

    it('clears ghost preview when no brush selected', () => {
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ activeTool: 'draw', selectedBrush: null, renderer })
      const { onHover } = createHoverHandler(ctx)
      onHover({ x: 5, y: 5, z: 7 })

      expect(renderer.clearGhostPreview).toHaveBeenCalled()
    })

    it('paste mode: calls updatePastePreview and skips ghost preview', () => {
      const renderer = makeMockRenderer()
      const mockBuffer = {
        canPaste: () => true,
        getTiles: () => [{ dx: 0, dy: 0, dz: 0, items: [] }],
      }
      const { ctx } = makeToolContext({
        activeTool: 'draw',
        isPasting: true,
        copyBuffer: mockBuffer,
        renderer,
      })
      const { onHover } = createHoverHandler(ctx)
      onHover({ x: 5, y: 5, z: 7 })

      expect(renderer.updatePastePreview).toHaveBeenCalledWith(mockBuffer, 5, 5, 7)
      expect(renderer.clearGhostPreview).toHaveBeenCalled()
      expect(renderer.updateGhostPreview).not.toHaveBeenCalled()
    })

    it('uses fill-specific size (0) for fill tool', () => {
      const renderer = makeMockRenderer()
      const { ctx } = makeToolContext({ activeTool: 'fill', brushSize: 2, renderer })
      const { onHover } = createHoverHandler(ctx)
      onHover({ x: 5, y: 5, z: 7 })

      // Fill tool ignores brushSize; uses size 0 → single tile cursor
      expect(renderer.updateBrushCursor).toHaveBeenCalledWith([{ x: 5, y: 5, z: 7 }])
    })
  })
})
