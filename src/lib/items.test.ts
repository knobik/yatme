// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getItemDisplayName, loadItems, type ItemRegistry } from './items'
import { makeAppearance, makeAppearanceData } from '../test/fixtures'
import type { AppearanceData } from './appearances'
import type { AppearanceFlags } from '../proto/appearances'

vi.mock('./fetchWithProgress', () => ({
  fetchTextWithProgress: vi.fn(),
}))

async function mockXmlAndLoad(xml: string): Promise<ItemRegistry> {
  const { fetchTextWithProgress } = await import('./fetchWithProgress')
  vi.mocked(fetchTextWithProgress).mockResolvedValue(xml)
  return loadItems()
}

describe('getItemDisplayName', () => {
  let registry: ItemRegistry
  let appearances: AppearanceData

  beforeEach(() => {
    registry = new Map()
    appearances = makeAppearanceData([])
  })

  it('returns ItemRegistry name when available', () => {
    registry.set(100, { id: 100, name: 'Gold Coin' })
    const result = getItemDisplayName(100, registry, appearances)
    expect(result).toBe('Gold Coin')
  })

  it('falls back to appearance.name', () => {
    const app = makeAppearance(200)
    app.name = 'Magic Sword'
    appearances.objects.set(200, app)
    const result = getItemDisplayName(200, registry, appearances)
    expect(result).toBe('Magic Sword')
  })

  it('falls back to market.name', () => {
    const app = makeAppearance(300)
    app.name = ''
    app.flags = { market: { name: 'Market Plate Armor', category: 0, tradeAsObjectId: 0, showAsObjectId: 0, restrictToProfession: [], minimumLevel: 0 } } as unknown as AppearanceFlags

    appearances.objects.set(300, app)
    const result = getItemDisplayName(300, registry, appearances)
    expect(result).toBe('Market Plate Armor')
  })

  it('falls back to Item #<id> when nothing is available', () => {
    const result = getItemDisplayName(999, registry, appearances)
    expect(result).toBe('Item #999')
  })

  it('prefers items.xml name over appearance name', () => {
    registry.set(100, { id: 100, name: 'XML Name' })
    const app = makeAppearance(100)
    app.name = 'Appearance Name'
    appearances.objects.set(100, app)
    const result = getItemDisplayName(100, registry, appearances)
    expect(result).toBe('XML Name')
  })

  it('handles missing appearance entirely', () => {
    registry.set(50, { id: 50, name: '' })
    const result = getItemDisplayName(50, registry, appearances)
    expect(result).toBe('Item #50')
  })
})

describe('loadItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses single item with id and name', async () => {
    const registry = await mockXmlAndLoad(`
      <items><item id="100" name="Gold Coin"></item></items>
    `)
    expect(registry.get(100)).toMatchObject({ id: 100, name: 'Gold Coin' })
  })

  it('parses article attribute', async () => {
    const registry = await mockXmlAndLoad(`
      <items><item id="200" name="Sword" article="a"></item></items>
    `)
    expect(registry.get(200)!.article).toBe('a')
  })

  it('parses fromid/toid range', async () => {
    const registry = await mockXmlAndLoad(`
      <items><item fromid="10" toid="13" name="Range Item"></item></items>
    `)
    expect(registry.size).toBe(4)
    for (let id = 10; id <= 13; id++) {
      expect(registry.get(id)).toBeDefined()
      expect(registry.get(id)!.name).toBe('Range Item')
      expect(registry.get(id)!.id).toBe(id)
    }
  })

  it('parses weight attribute', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Heavy Stone">
          <attribute key="weight" value="5000" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.weight).toBe(5000)
  })

  it('parses itemType door', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Door">
          <attribute key="type" value="door" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.itemType).toBe('door')
  })

  it('parses writeable "1" as true', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Sign">
          <attribute key="writeable" value="1" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.writeable).toBe(true)
  })

  it('parses floorchange lowercased', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Stairs">
          <attribute key="floorchange" value="Down" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.floorChange).toBe('down')
  })

  it('parses containerSize, charges, and rotateTo', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Chest">
          <attribute key="containerSize" value="20" />
          <attribute key="charges" value="5" />
          <attribute key="rotateTo" value="101" />
        </item>
      </items>
    `)
    const item = registry.get(100)!
    expect(item.containerSize).toBe(20)
    expect(item.charges).toBe(5)
    expect(item.rotateTo).toBe(101)
  })

  it('parses description attribute', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Sign">
          <attribute key="description" value="A wooden sign." />
        </item>
      </items>
    `)
    expect(registry.get(100)!.description).toBe('A wooden sign.')
  })

  it('parses primaryType attribute', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Sword">
          <attribute key="primaryType" value="weapon" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.primaryType).toBe('weapon')
  })

  it('parses maxTextLen attribute', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Book">
          <attribute key="maxtextlen" value="255" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.maxTextLen).toBe(255)
  })

  it('parses maxTextLength as alias for maxTextLen', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Scroll">
          <attribute key="maxTextLength" value="128" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.maxTextLen).toBe(128)
  })

  it('parses writeable "true" as true', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Board">
          <attribute key="writeable" value="true" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.writeable).toBe(true)
  })

  it('rejects invalid itemType values', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item id="100" name="Thing">
          <attribute key="type" value="invalid" />
        </item>
      </items>
    `)
    expect(registry.get(100)!.itemType).toBeUndefined()
  })

  it('skips items without id or fromid/toid', async () => {
    const registry = await mockXmlAndLoad(`
      <items>
        <item name="Ghost Item"></item>
        <item id="1" name="Real Item"></item>
      </items>
    `)
    expect(registry.size).toBe(1)
    expect(registry.get(1)!.name).toBe('Real Item')
  })
})
