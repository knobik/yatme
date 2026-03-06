import { describe, it, expect } from 'vitest'
import { parsePositionString } from './position'

describe('parsePositionString', () => {
  it('parses {x=123, y=456, z=7} format', () => {
    expect(parsePositionString('{x=123, y=456, z=7}')).toEqual({ x: '123', y: '456', z: '7' })
  })

  it('parses {x: 123, y: 456, z: 7} format', () => {
    expect(parsePositionString('{x: 123, y: 456, z: 7}')).toEqual({ x: '123', y: '456', z: '7' })
  })

  it('parses JSON {"x": 123} format', () => {
    expect(parsePositionString('{"x": 10, "y": 20, "z": 3}')).toEqual({ x: '10', y: '20', z: '3' })
  })

  it('parses CSV format', () => {
    expect(parsePositionString('100, 200, 7')).toEqual({ x: '100', y: '200', z: '7' })
  })

  it('trims whitespace', () => {
    expect(parsePositionString('  123,456,7  ')).toEqual({ x: '123', y: '456', z: '7' })
  })

  it('returns null for empty string', () => {
    expect(parsePositionString('')).toBeNull()
  })

  it('returns null for gibberish', () => {
    expect(parsePositionString('hello world')).toBeNull()
  })

  it('returns null for partial input', () => {
    expect(parsePositionString('x=123')).toBeNull()
  })
})
