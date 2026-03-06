import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock fetchWithProgress module
vi.mock('./fetchWithProgress', () => ({
  fetchTextWithProgress: vi.fn(),
}))

import { loadSpriteCatalog, findSheet, getSpriteSheetCount } from './sprites'
import { fetchTextWithProgress } from './fetchWithProgress'

const mockFetch = vi.mocked(fetchTextWithProgress)

const FAKE_CATALOG = JSON.stringify([
  { type: 'appearances', file: 'appearances.dat' },
  { type: 'sprite', file: 'sheet-a.png', spritetype: 0, firstspriteid: 1, lastspriteid: 100 },
  { type: 'sprite', file: 'sheet-b.png', spritetype: 0, firstspriteid: 200, lastspriteid: 300 },
  { type: 'sprite', file: 'sheet-c.png', spritetype: 1, firstspriteid: 500, lastspriteid: 600 },
])

describe('loadSpriteCatalog + findSheet', () => {
  beforeAll(async () => {
    mockFetch.mockResolvedValue(FAKE_CATALOG)
    await loadSpriteCatalog('/test-catalog.json')
  })

  it('findSheet returns correct sheet for ID in range', () => {
    const sheet = findSheet(50)
    expect(sheet).not.toBeNull()
    expect(sheet!.file).toBe('sheet-a.png')
    expect(sheet!.firstSpriteId).toBe(1)
    expect(sheet!.lastSpriteId).toBe(100)
  })

  it('findSheet returns null for ID below all sheets', () => {
    expect(findSheet(0)).toBeNull()
  })

  it('findSheet returns null for ID above all sheets', () => {
    expect(findSheet(1000)).toBeNull()
  })

  it('findSheet returns null for ID in gap between sheets', () => {
    expect(findSheet(150)).toBeNull() // between sheet-a (1-100) and sheet-b (200-300)
  })

  it('loadSpriteCatalog extracts appearancesFile from catalog', async () => {
    mockFetch.mockResolvedValue(FAKE_CATALOG)
    const result = await loadSpriteCatalog('/test.json')
    expect(result.appearancesFile).toBe('appearances.dat')
  })

  it('getSpriteSheetCount returns number of loaded sheets', () => {
    expect(getSpriteSheetCount()).toBe(3) // 3 sprite entries (not appearances)
  })
})
