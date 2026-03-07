export interface MapBundle {
  otbm: Uint8Array
  sidecars: Map<string, Uint8Array>
  filename: string
}

export interface MapStorageProvider {
  loadMap(onProgress?: (fraction: number) => void): Promise<MapBundle>
  saveMap(bundle: MapBundle): Promise<void>
  readonly canSave: boolean
}
