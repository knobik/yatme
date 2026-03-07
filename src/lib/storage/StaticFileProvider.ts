import type { MapBundle, MapStorageProvider } from './MapStorageProvider'
import { fetchWithProgress } from '../fetchWithProgress'
import { triggerDownload } from '../triggerDownload'

export class StaticFileProvider implements MapStorageProvider {
  readonly canSave = true
  private url: string

  constructor(url = '/maps/canary.otbm') {
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
    triggerDownload(bundle.otbm, bundle.filename)
  }
}
