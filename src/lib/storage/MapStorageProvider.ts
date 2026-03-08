export interface MapBundle {
  otbm: Uint8Array
  sidecars: Map<string, Uint8Array>
  filename: string
}

export interface MapStorageProvider {
  loadMap(onProgress?: (fraction: number) => void): Promise<MapBundle>
  loadSidecars(filenames: string[]): Promise<Map<string, Uint8Array>>
  saveMap(bundle: MapBundle, onProgress?: (fraction: number) => void): Promise<void>
  readonly canSave: boolean
}
