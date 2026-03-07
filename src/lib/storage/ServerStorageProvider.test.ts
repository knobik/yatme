import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServerStorageProvider } from './ServerStorageProvider'

describe('ServerStorageProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('canSave is true', () => {
    expect(new ServerStorageProvider().canSave).toBe(true)
  })

  describe('loadMap', () => {
    it('fetches OTBM from GET /api/map', async () => {
      const data = new Uint8Array([10, 20, 30])
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="world.otbm"',
        }),
        arrayBuffer: vi.fn().mockResolvedValue(data.buffer),
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response)

      const provider = new ServerStorageProvider('/api')
      const bundle = await provider.loadMap()

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/map')
      expect(bundle.otbm).toEqual(data)
      expect(bundle.filename).toBe('world.otbm')
      expect(bundle.sidecars.size).toBe(0)
    })

    it('defaults filename to map.otbm when no Content-Disposition', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response)

      const provider = new ServerStorageProvider()
      const bundle = await provider.loadMap()

      expect(bundle.filename).toBe('map.otbm')
    })

    it('throws on non-OK response', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response)

      const provider = new ServerStorageProvider()
      await expect(provider.loadMap()).rejects.toThrow('Failed to load map: 500')
    })

    it('fetches sidecars when X-Map-Sidecars header present', async () => {
      const otbmData = new Uint8Array([1])
      const sidecarData = new Uint8Array([2, 3])

      const mainResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          'X-Map-Sidecars': 'spawns.xml',
        }),
        arrayBuffer: vi.fn().mockResolvedValue(otbmData.buffer),
      }
      const sidecarResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(sidecarData.buffer),
      }

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mainResponse as unknown as Response)
        .mockResolvedValueOnce(sidecarResponse as unknown as Response)

      const provider = new ServerStorageProvider('/api')
      const bundle = await provider.loadMap()

      expect(fetchSpy).toHaveBeenCalledWith('/api/map/sidecars/spawns.xml')
      expect(bundle.sidecars.get('spawns.xml')).toEqual(sidecarData)
    })
  })

  describe('saveMap', () => {
    it('POSTs OTBM to /api/map with correct headers', async () => {
      const mockResponse = { ok: true, status: 200 }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response)

      const provider = new ServerStorageProvider('/api')
      const otbm = new Uint8Array([1, 2, 3])
      await provider.saveMap({
        otbm,
        sidecars: new Map(),
        filename: 'world.otbm',
      })

      expect(fetchSpy).toHaveBeenCalledWith('/api/map', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Map-Filename': 'world.otbm',
        },
      }))
      const callBody = fetchSpy.mock.calls[0][1]?.body as ArrayBuffer
      expect(new Uint8Array(callBody)).toEqual(otbm)
    })

    it('throws on non-OK response', async () => {
      const mockResponse = { ok: false, status: 403, statusText: 'Forbidden' }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response)

      const provider = new ServerStorageProvider()
      await expect(provider.saveMap({
        otbm: new Uint8Array(),
        sidecars: new Map(),
        filename: 'test.otbm',
      })).rejects.toThrow('Failed to save map: 403')
    })
  })
})
