import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StaticFileProvider } from './StaticFileProvider'

vi.mock('../fetchWithProgress', () => ({
  fetchWithProgress: vi.fn(),
}))

import { fetchWithProgress } from '../fetchWithProgress'

const mockFetch = vi.mocked(fetchWithProgress)

describe('StaticFileProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadMap', () => {
    it('returns a MapBundle with OTBM data and filename from URL', async () => {
      const fakeBuffer = new ArrayBuffer(4)
      new Uint8Array(fakeBuffer).set([1, 2, 3, 4])
      mockFetch.mockResolvedValue(fakeBuffer)

      const provider = new StaticFileProvider('/maps/test.otbm')
      const bundle = await provider.loadMap()

      expect(mockFetch).toHaveBeenCalledWith('/maps/test.otbm', undefined)
      expect(bundle.filename).toBe('test.otbm')
      expect(bundle.otbm).toEqual(new Uint8Array([1, 2, 3, 4]))
      expect(bundle.sidecars.size).toBe(0)
    })

    it('returns empty map bundle when no URL is provided', async () => {
      const provider = new StaticFileProvider()
      const bundle = await provider.loadMap()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(bundle.filename).toBe('untitled.otbm')
      expect(bundle.otbm.length).toBe(0)
      expect(bundle.sidecars.size).toBe(0)
    })

    it('calls onProgress(1) when no URL is provided', async () => {
      const onProgress = vi.fn()

      const provider = new StaticFileProvider()
      await provider.loadMap(onProgress)

      expect(onProgress).toHaveBeenCalledWith(1)
    })

    it('passes onProgress to fetchWithProgress', async () => {
      mockFetch.mockResolvedValue(new ArrayBuffer(0))
      const onProgress = vi.fn()

      const provider = new StaticFileProvider('/maps/canary.otbm')
      await provider.loadMap(onProgress)

      expect(mockFetch).toHaveBeenCalledWith('/maps/canary.otbm', onProgress)
    })
  })

  it('canSave is true', () => {
    expect(new StaticFileProvider().canSave).toBe(true)
  })

  describe('saveMap', () => {
    it('triggers a browser download', async () => {
      const createObjectURL = vi.fn().mockReturnValue('blob:test')
      const revokeObjectURL = vi.fn()
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

      const clickSpy = vi.fn()
      const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
      vi.stubGlobal('document', {
        createElement: vi.fn().mockReturnValue(anchor),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      })

      const provider = new StaticFileProvider()
      await provider.saveMap({
        otbm: new Uint8Array([1, 2, 3]),
        sidecars: new Map(),
        filename: 'test.otbm',
      })

      expect(createObjectURL).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
      expect(anchor.download).toBe('test.otbm')

      vi.unstubAllGlobals()
    })
  })
})
