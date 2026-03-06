import { describe, it, expect, beforeAll, vi } from 'vitest'
import { findSheet, loadSpriteCatalog } from './sprites'

// Mock fetchWithProgress to return fake catalog
vi.mock('./fetchWithProgress', () => ({
  fetchTextWithProgress: vi.fn().mockResolvedValue(JSON.stringify([
    { type: 'appearances', file: 'appearances.dat' },
    { type: 'sprite', file: 'sheet1.png', spritetype: 0, firstspriteid: 1, lastspriteid: 100 },
    { type: 'sprite', file: 'sheet2.png', spritetype: 0, firstspriteid: 101, lastspriteid: 200 },
    { type: 'sprite', file: 'sheet3.png', spritetype: 1, firstspriteid: 201, lastspriteid: 300 },
  ])),
}))

describe('sprites', () => {
  beforeAll(async () => {
    await loadSpriteCatalog('/fake-catalog.json')
  })

  describe('findSheet', () => {
    it('finds sheet containing spriteId', () => {
      const sheet = findSheet(50)
      expect(sheet).not.toBeNull()
      expect(sheet!.file).toBe('sheet1.png')
      expect(sheet!.firstSpriteId).toBe(1)
      expect(sheet!.lastSpriteId).toBe(100)
    })

    it('finds sheet at boundary (first id)', () => {
      expect(findSheet(101)!.file).toBe('sheet2.png')
    })

    it('finds sheet at boundary (last id)', () => {
      expect(findSheet(200)!.file).toBe('sheet2.png')
    })

    it('returns null for id below all ranges', () => {
      expect(findSheet(0)).toBeNull()
    })

    it('returns null for id above all ranges', () => {
      expect(findSheet(999)).toBeNull()
    })
  })
})
