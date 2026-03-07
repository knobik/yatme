import fs from 'node:fs'
import path from 'node:path'

export function findOtbmFile(mapDir: string, mapFile?: string): string | null {
  if (mapFile) {
    const full = path.join(mapDir, mapFile)
    return fs.existsSync(full) ? full : null
  }

  const entries = fs.readdirSync(mapDir)
  const otbm = entries.find(e => e.endsWith('.otbm'))
  return otbm ? path.join(mapDir, otbm) : null
}

export function discoverSidecars(mapDir: string): string[] {
  try {
    return fs.readdirSync(mapDir).filter(e => e.endsWith('.xml'))
  } catch {
    return []
  }
}
