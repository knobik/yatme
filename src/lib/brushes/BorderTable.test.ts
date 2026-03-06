import { describe, it, expect } from 'vitest'
import {
  unpackDirections,
  BORDER_TYPES,
  NORTH_HORIZONTAL,
  NORTHWEST_CORNER,
  NORTHEAST_CORNER,
  SOUTHEAST_DIAGONAL,
} from './BorderTable'

describe('unpackDirections', () => {
  it('returns empty array for 0', () => {
    expect(unpackDirections(0)).toEqual([])
  })

  it('unpacks single direction from byte 0', () => {
    expect(unpackDirections(NORTHWEST_CORNER)).toEqual([NORTHWEST_CORNER])
  })

  it('unpacks two directions', () => {
    // 0x00000605 = byte0=5, byte1=6
    const packed = NORTHWEST_CORNER | (NORTHEAST_CORNER << 8)
    expect(unpackDirections(packed)).toEqual([NORTHWEST_CORNER, NORTHEAST_CORNER])
  })

  it('unpacks three directions', () => {
    const packed = NORTH_HORIZONTAL | (NORTHWEST_CORNER << 8) | (NORTHEAST_CORNER << 16)
    expect(unpackDirections(packed)).toEqual([NORTH_HORIZONTAL, NORTHWEST_CORNER, NORTHEAST_CORNER])
  })

  it('unpacks four directions', () => {
    const packed = 0x01020403
    expect(unpackDirections(packed)).toEqual([3, 4, 2, 1])
  })

  it('stops at zero byte', () => {
    // 0x00000901 = byte0=1, byte1=9, byte2=0 → stops at 2
    const packed = NORTH_HORIZONTAL | (SOUTHEAST_DIAGONAL << 8)
    expect(unpackDirections(packed)).toEqual([NORTH_HORIZONTAL, SOUTHEAST_DIAGONAL])
  })
})

describe('BORDER_TYPES', () => {
  it('has 256 entries', () => {
    expect(BORDER_TYPES.length).toBe(256)
  })

  it('index 0 is 0 (no neighbors = no borders)', () => {
    expect(BORDER_TYPES[0]).toBe(0)
  })

  it('spot-check known value at index 1 (NW only)', () => {
    // BORDER_TYPES[1] = 0x00000005 = NORTHWEST_CORNER
    expect(unpackDirections(BORDER_TYPES[1])).toEqual([NORTHWEST_CORNER])
  })
})
