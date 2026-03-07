import type { MapBundle, MapStorageProvider } from './MapStorageProvider'

export class ServerStorageProvider implements MapStorageProvider {
  readonly canSave = true
  private baseUrl: string

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
  }

  async loadMap(onProgress?: (fraction: number) => void): Promise<MapBundle> {
    const response = await fetch(`${this.baseUrl}/map`)
    if (!response.ok) {
      throw new Error(`Failed to load map: ${response.status} ${response.statusText}`)
    }

    const contentLength = response.headers.get('Content-Length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    let otbm: Uint8Array
    if (total > 0 && response.body && onProgress) {
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.byteLength
        onProgress(Math.min(loaded / total, 0.99))
      }
      otbm = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        otbm.set(chunk, offset)
        offset += chunk.byteLength
      }
      onProgress(1)
    } else {
      const buffer = await response.arrayBuffer()
      otbm = new Uint8Array(buffer)
      onProgress?.(1)
    }

    const disposition = response.headers.get('Content-Disposition')
    let filename = 'map.otbm'
    if (disposition) {
      const match = disposition.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/)
      if (match) filename = decodeURIComponent(match[1].replace(/"/g, ''))
    }

    const sidecars = new Map<string, Uint8Array>()
    const sidecarHeader = response.headers.get('X-Map-Sidecars')
    if (sidecarHeader) {
      const names = sidecarHeader.split(',').map(s => s.trim()).filter(Boolean)
      for (const name of names) {
        const res = await fetch(`${this.baseUrl}/map/sidecars/${encodeURIComponent(name)}`)
        if (res.ok) {
          sidecars.set(name, new Uint8Array(await res.arrayBuffer()))
        }
      }
    }

    return { otbm, sidecars, filename }
  }

  async saveMap(bundle: MapBundle): Promise<void> {
    const response = await fetch(`${this.baseUrl}/map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Map-Filename': bundle.filename,
      },
      body: bundle.otbm.buffer.slice(bundle.otbm.byteOffset, bundle.otbm.byteOffset + bundle.otbm.byteLength) as ArrayBuffer,
    })
    if (!response.ok) {
      throw new Error(`Failed to save map: ${response.status} ${response.statusText}`)
    }
  }
}
