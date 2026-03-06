import { describe, it, expect } from 'vitest'
import { classifyItem } from './MapMutator'
import { makeAppearanceData } from '../test/fixtures'
import type { AppearanceFlags } from '../proto/appearances'

describe('classifyItem', () => {
  it.each<[string, Partial<AppearanceFlags>, string]>([
    ['bank flag', { bank: { waypoints: 0 } as AppearanceFlags['bank'] }, 'ground'],
    ['clip flag', { clip: true }, 'bottom'],
    ['bottom flag', { bottom: true }, 'bottom'],
    ['top flag', { top: true }, 'top'],
    ['no special flags', {}, 'common'],
  ])('classifies %s as %s', (_desc, flags, expected) => {
    const appearances = makeAppearanceData([[1, flags]])
    expect(classifyItem(1, appearances)).toBe(expected)
  })

  it('classifies unknown item as common', () => {
    const appearances = makeAppearanceData([])
    expect(classifyItem(999, appearances)).toBe('common')
  })
})
