import type { AppearanceData } from './appearances'

export interface ItemInfo {
  id: number
  name: string
  article?: string
  primaryType?: string
  weight?: number
  containerSize?: number
  description?: string
}

export type ItemRegistry = Map<number, ItemInfo>

export async function loadItems(
  url = '/data/items.xml',
  onProgress?: (fraction: number) => void,
): Promise<ItemRegistry> {
  const { fetchTextWithProgress } = await import('./fetchWithProgress')
  const text = await fetchTextWithProgress(url, onProgress)
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const registry: ItemRegistry = new Map()

  const itemElements = doc.querySelectorAll('item')
  for (const el of itemElements) {
    const idStr = el.getAttribute('id')
    const fromIdStr = el.getAttribute('fromid')
    const toIdStr = el.getAttribute('toid')
    const name = el.getAttribute('name') || ''
    const article = el.getAttribute('article') || undefined

    // Extract top-level <attribute> children (skip nested sub-attributes)
    let primaryType: string | undefined
    let weight: number | undefined
    let containerSize: number | undefined
    let description: string | undefined

    for (const attr of el.children) {
      if (attr.tagName !== 'attribute') continue
      const key = attr.getAttribute('key')?.toLowerCase()
      const value = attr.getAttribute('value')
      if (!key || value == null) continue

      switch (key) {
        case 'primarytype':
          primaryType = value
          break
        case 'weight':
          weight = parseInt(value, 10)
          break
        case 'containersize':
          containerSize = parseInt(value, 10)
          break
        case 'description':
          description = value
          break
      }
    }

    const info: Omit<ItemInfo, 'id'> = { name, article, primaryType, weight, containerSize, description }

    if (idStr) {
      const id = parseInt(idStr, 10)
      registry.set(id, { id, ...info })
    } else if (fromIdStr && toIdStr) {
      const from = parseInt(fromIdStr, 10)
      const to = parseInt(toIdStr, 10)
      for (let id = from; id <= to; id++) {
        registry.set(id, { id, ...info })
      }
    }
  }

  return registry
}

export function getItemDisplayName(
  id: number,
  registry: ItemRegistry,
  appearances: AppearanceData,
): string {
  // 1. items.xml name
  const itemInfo = registry.get(id)
  if (itemInfo?.name) return itemInfo.name

  // 2. appearance.name
  const appearance = appearances.objects.get(id)
  if (appearance?.name) return appearance.name

  // 3. market.name
  const marketName = appearance?.flags?.market?.name
  if (marketName) return marketName

  // 4. fallback
  return `Item #${id}`
}
