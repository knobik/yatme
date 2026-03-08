import path from 'node:path'

export interface ServerConfig {
  port: number
  mapDir: string
  mapFile?: string
}

const root = process.cwd()

export const assetsDir = path.resolve(root, process.env['ASSETS_DIR']!)
export const dataDir = path.resolve(root, './data')
export const distDir = path.resolve(root, './dist')

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env['PORT'] ?? '8080', 10),
    mapDir: path.resolve(root, process.env['MAP_DIR']!),
    mapFile: process.env['MAP_FILE'] || undefined,
  }
}
