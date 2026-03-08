import type { MapBundle, MapStorageProvider } from './MapStorageProvider'
import { toArrayBuffer } from '../triggerDownload'

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
      await Promise.all(names.map(async (name) => {
        const res = await fetch(`${this.baseUrl}/map/sidecars/${encodeURIComponent(name)}`)
        if (res.ok) {
          sidecars.set(name, new Uint8Array(await res.arrayBuffer()))
        }
      }))
    }

    return { otbm, sidecars, filename }
  }

  async loadSidecars(_filenames: string[]): Promise<Map<string, Uint8Array>> {
    // Sidecars are already loaded during loadMap via X-Map-Sidecars header
    return new Map()
  }

  async saveMap(bundle: MapBundle, onProgress?: (fraction: number) => void): Promise<void> {
    await this.uploadWithProgress(
      `${this.baseUrl}/map`,
      toArrayBuffer(bundle.otbm),
      { 'Content-Type': 'application/octet-stream', 'X-Map-Filename': bundle.filename },
      onProgress,
    )

    // Save sidecar files
    for (const [name, data] of bundle.sidecars) {
      const sidecarRes = await fetch(`${this.baseUrl}/map/sidecars/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: toArrayBuffer(data),
      })
      if (!sidecarRes.ok) {
        console.error(`[Save] Failed to save sidecar ${name}: ${sidecarRes.status}`)
      }
    }
  }

  private uploadWithProgress(
    url: string,
    body: ArrayBuffer,
    headers: Record<string, string>,
    onProgress?: (fraction: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value)
      }
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.min(e.loaded / e.total, 0.99))
          }
        })
      }
      xhr.addEventListener('load', () => {
        onProgress?.(1)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Failed to save map: ${xhr.status} ${xhr.statusText}`))
        }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error while saving map')))
      xhr.send(body)
    })
  }
}
