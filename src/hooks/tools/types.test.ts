import { describe, it, expect } from 'vitest'
import { getTilesInBrush } from './types'

describe('getTilesInBrush', () => {
  it('size=0 returns single tile', () => {
    expect(getTilesInBrush(5, 10, 0, 'square')).toEqual([{ x: 5, y: 10 }])
  })

  it('size=0 circle returns single tile', () => {
    expect(getTilesInBrush(5, 10, 0, 'circle')).toEqual([{ x: 5, y: 10 }])
  })

  it('size=1 square returns 9 tiles', () => {
    const tiles = getTilesInBrush(0, 0, 1, 'square')
    expect(tiles).toHaveLength(9)
    expect(tiles).toContainEqual({ x: -1, y: -1 })
    expect(tiles).toContainEqual({ x: 0, y: 0 })
    expect(tiles).toContainEqual({ x: 1, y: 1 })
  })

  it('size=2 square returns 25 tiles', () => {
    const tiles = getTilesInBrush(0, 0, 2, 'square')
    expect(tiles).toHaveLength(25)
  })

  it('size=1 circle excludes corners', () => {
    const tiles = getTilesInBrush(0, 0, 1, 'circle')
    // Corners are at distance sqrt(2) ≈ 1.414 which is >= 1.005, so excluded
    expect(tiles).not.toContainEqual({ x: -1, y: -1 })
    expect(tiles).not.toContainEqual({ x: 1, y: 1 })
    // Center and cardinal directions included
    expect(tiles).toContainEqual({ x: 0, y: 0 })
    expect(tiles).toContainEqual({ x: 1, y: 0 })
    expect(tiles).toContainEqual({ x: 0, y: 1 })
  })

  it('circle is smaller than square for same size', () => {
    const square = getTilesInBrush(0, 0, 2, 'square')
    const circle = getTilesInBrush(0, 0, 2, 'circle')
    expect(circle.length).toBeLessThan(square.length)
  })
})
