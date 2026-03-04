import type { AppearanceData } from './appearances'

export type ItemType = 'depot' | 'mailbox' | 'trashholder' | 'container' | 'door' | 'magicfield' | 'teleport' | 'bed' | 'key'

export interface ItemInfo {
  id: number
  name: string
  article?: string
  primaryType?: string
  itemType?: ItemType
  weight?: number
  containerSize?: number
  description?: string
  charges?: number
  rotateTo?: number
  writeable?: boolean
  maxTextLen?: number
  floorChange?: string
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
    let itemType: ItemType | undefined
    let weight: number | undefined
    let containerSize: number | undefined
    let description: string | undefined
    let charges: number | undefined
    let rotateTo: number | undefined
    let writeable: boolean | undefined
    let maxTextLen: number | undefined
    let floorChange: string | undefined

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
        case 'charges':
          charges = parseInt(value, 10)
          break
        case 'type': {
          const validTypes = ['depot', 'mailbox', 'trashholder', 'container', 'door', 'magicfield', 'teleport', 'bed', 'key']
          if (validTypes.includes(value.toLowerCase())) itemType = value.toLowerCase() as ItemType
          break
        }
        case 'rotateto':
          rotateTo = parseInt(value, 10)
          break
        case 'writeable':
          writeable = value === '1' || value.toLowerCase() === 'true'
          break
        case 'maxtextlen':
        case 'maxtextlength':
          maxTextLen = parseInt(value, 10)
          break
        case 'floorchange':
          floorChange = value.toLowerCase()
          break
      }
    }

    const info: Omit<ItemInfo, 'id'> = { name, article, primaryType, itemType, weight, containerSize, description, charges, rotateTo, writeable, maxTextLen, floorChange }

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
