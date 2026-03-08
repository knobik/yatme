import { zipSync } from 'fflate'
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

  async loadSidecars(filenames: string[]): Promise<Map<string, Uint8Array>> {
    const basePath = this.url.substring(0, this.url.lastIndexOf('/') + 1)
    const result = new Map<string, Uint8Array>()
    await Promise.all(filenames.map(async (name) => {
      try {
        const res = await fetch(`${basePath}${name}`)
        if (res.ok) {
          result.set(name, new Uint8Array(await res.arrayBuffer()))
        }
      } catch {
        // Sidecar not available in static mode — skip silently
      }
    }))
    return result
  }

  async saveMap(bundle: MapBundle): Promise<void> {
    if (bundle.sidecars.size === 0) {
      triggerDownload(bundle.otbm, bundle.filename)
      return
    }

    const files: Record<string, Uint8Array> = {
      [bundle.filename]: bundle.otbm,
    }
    for (const [name, data] of bundle.sidecars) {
      files[name] = data
    }

    const zipName = bundle.filename.replace(/\.otbm$/, '') + '.zip'
    const zipped = zipSync(files)
    triggerDownload(zipped, zipName, 'application/zip')
  }
}
