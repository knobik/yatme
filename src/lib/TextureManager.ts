import { Assets, Texture, Rectangle, TextureSource } from 'pixi.js'
import { findSheet, type SheetInfo } from './sprites'

// Pixel art: nearest-neighbor sampling, no interpolation bleeding
TextureSource.defaultOptions.scaleMode = 'nearest'

const SPRITES_BASE = '/sprites-png/'

const sheetTextureCache = new Map<string, Texture>()
const sheetLoadPromises = new Map<string, Promise<Texture>>()
const spriteTextureCache = new Map<number, Texture>()

function loadSheetTexture(file: string): Promise<Texture> {
  const cached = sheetTextureCache.get(file)
  if (cached) return Promise.resolve(cached)

  const pending = sheetLoadPromises.get(file)
  if (pending) return pending

  const url = `${SPRITES_BASE}${file}`
  const promise = Assets.load<Texture>(url).then((texture) => {
    sheetTextureCache.set(file, texture)
    sheetLoadPromises.delete(file)
    return texture
  })

  sheetLoadPromises.set(file, promise)
  return promise
}

function createSpriteTexture(sheetTexture: Texture, sheet: SheetInfo, spriteId: number): Texture {
  const offset = spriteId - sheet.firstSpriteId
  const col = offset % sheet.cols
  const row = Math.floor(offset / sheet.cols)
  const sx = col * sheet.width
  const sy = row * sheet.height

  return new Texture({
    source: sheetTexture.source,
    frame: new Rectangle(sx, sy, sheet.width, sheet.height),
  })
}

export async function getTexture(spriteId: number): Promise<Texture | null> {
  const cached = spriteTextureCache.get(spriteId)
  if (cached) return cached

  const sheet = findSheet(spriteId)
  if (!sheet) return null

  const sheetTexture = await loadSheetTexture(sheet.file)
  const texture = createSpriteTexture(sheetTexture, sheet, spriteId)
  spriteTextureCache.set(spriteId, texture)
  return texture
}

export function getTextureSync(spriteId: number): Texture | null {
  const cached = spriteTextureCache.get(spriteId)
  if (cached) return cached

  const sheet = findSheet(spriteId)
  if (!sheet) return null

  const sheetTexture = sheetTextureCache.get(sheet.file)
  if (!sheetTexture) return null

  const texture = createSpriteTexture(sheetTexture, sheet, spriteId)
  spriteTextureCache.set(spriteId, texture)
  return texture
}

export function preloadSheets(spriteIds: number[]): Promise<void> {
  const files = new Set<string>()
  for (const id of spriteIds) {
    const sheet = findSheet(id)
    if (sheet) files.add(sheet.file)
  }
  return Promise.all([...files].map(loadSheetTexture)).then(() => {})
}
