import { describe, it, expect } from 'vitest'
import { deepCloneItem, type OtbmItem } from './otbm'

describe('deepCloneItem', () => {
  it('clones a minimal item', () => {
    const item: OtbmItem = { id: 42 }
    const clone = deepCloneItem(item)
    expect(clone).toEqual({ id: 42 })
    expect(clone).not.toBe(item)
  })

  it('clones all scalar properties', () => {
    const item: OtbmItem = {
      id: 100,
      count: 5,
      actionId: 1000,
      uniqueId: 2000,
      text: 'hello',
      description: 'desc',
      depotId: 3,
      houseDoorId: 7,
      duration: 999,
    }
    const clone = deepCloneItem(item)
    expect(clone).toEqual(item)
  })

  it('deep-clones teleportDestination', () => {
    const item: OtbmItem = {
      id: 1,
      teleportDestination: { x: 10, y: 20, z: 7 },
    }
    const clone = deepCloneItem(item)
    expect(clone.teleportDestination).toEqual({ x: 10, y: 20, z: 7 })
    expect(clone.teleportDestination).not.toBe(item.teleportDestination)
  })

  it('deep-clones nested items', () => {
    const item: OtbmItem = {
      id: 1,
      items: [{ id: 2 }, { id: 3, count: 10 }],
    }
    const clone = deepCloneItem(item)
    expect(clone.items).toEqual([{ id: 2 }, { id: 3, count: 10 }])
    expect(clone.items).not.toBe(item.items)
    expect(clone.items![0]).not.toBe(item.items![0])
  })

  it('mutating clone does not affect original', () => {
    const item: OtbmItem = {
      id: 1,
      count: 5,
      items: [{ id: 2, text: 'original' }],
    }
    const clone = deepCloneItem(item)
    clone.count = 99
    clone.items![0].text = 'modified'
    expect(item.count).toBe(5)
    expect(item.items![0].text).toBe('original')
  })
})
