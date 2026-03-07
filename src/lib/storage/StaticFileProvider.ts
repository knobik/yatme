import type { MapBundle, MapStorageProvider } from './MapStorageProvider'
import { fetchWithProgress } from '../fetchWithProgress'

export class StaticFileProvider implements MapStorageProvider {
  readonly canSave = true
  private url: string

  constructor(url = '/canary.otbm') {
    this.url = url
  }

  async loadMap(onProgress?: (fraction: number) => void): Promise<MapBundle> {
    const buffer = await fetchWithProgress(this.url, onProgress)
    const filename = this.url.split('/').pop() ?? 'map.otbm'
    return {
      otbm: new Uint8Array(buffer),
      sidecars: new Map(),
      filename,
    }
  }

  async saveMap(bundle: MapBundle): Promise<void> {
    const buf = bundle.otbm.buffer.slice(bundle.otbm.byteOffset, bundle.otbm.byteOffset + bundle.otbm.byteLength) as ArrayBuffer
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = bundle.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
