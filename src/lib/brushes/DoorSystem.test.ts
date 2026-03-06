import { describe, it, expect } from 'vitest'
import { findDoorForAlignment, switchDoor } from './DoorSystem'
import { makeMinimalRegistry } from '../../test/brushFixtures'
import { createWallBrush, WALL_HORIZONTAL, WALL_VERTICAL, DOOR_NORMAL, DOOR_QUEST } from './WallTypes'

function makeWallWithDoors() {
  const brush = createWallBrush()
  brush.id = 1
  brush.name = 'stone_wall'
  brush.wallItems[WALL_HORIZONTAL].items.push({ id: 100, chance: 100 })
  brush.wallItems[WALL_HORIZONTAL].totalChance = 100
  brush.wallItems[WALL_VERTICAL].items.push({ id: 101, chance: 100 })
  brush.wallItems[WALL_VERTICAL].totalChance = 100
  brush.doorItems[WALL_HORIZONTAL] = [
    { id: 200, type: DOOR_NORMAL, open: false },
    { id: 201, type: DOOR_NORMAL, open: true },
    { id: 210, type: DOOR_QUEST, open: false },
  ]
  brush.doorItems[WALL_VERTICAL] = [
    { id: 300, type: DOOR_NORMAL, open: false },
    { id: 301, type: DOOR_NORMAL, open: true },
  ]
  return brush
}

describe('findDoorForAlignment', () => {
  it('finds exact match (type + open state)', () => {
    const brush = makeWallWithDoors()
    expect(findDoorForAlignment(brush, WALL_HORIZONTAL, DOOR_NORMAL, false)).toBe(200)
  })

  it('prefers matching open state', () => {
    const brush = makeWallWithDoors()
    expect(findDoorForAlignment(brush, WALL_HORIZONTAL, DOOR_NORMAL, true)).toBe(201)
  })

  it('falls back to wrong open state when preferred unavailable', () => {
    const brush = makeWallWithDoors()
    // DOOR_QUEST only has closed (210), requesting open
    expect(findDoorForAlignment(brush, WALL_HORIZONTAL, DOOR_QUEST, true)).toBe(210)
  })

  it('returns 0 when no doors at alignment', () => {
    const brush = makeWallWithDoors()
    // WALL_POLE (0) has no doors
    expect(findDoorForAlignment(brush, 0, DOOR_NORMAL, false)).toBe(0)
  })

  it('walks redirect chain to find door', () => {
    const primary = createWallBrush()
    primary.id = 1
    primary.name = 'primary'

    const redirect = createWallBrush()
    redirect.id = 2
    redirect.name = 'redirect'
    redirect.doorItems[WALL_HORIZONTAL] = [
      { id: 500, type: DOOR_NORMAL, open: false },
    ]

    primary.redirectTo = redirect

    expect(findDoorForAlignment(primary, WALL_HORIZONTAL, DOOR_NORMAL, false)).toBe(500)
  })

  it('prevents redirect loop', () => {
    const a = createWallBrush()
    a.id = 1
    a.name = 'a'
    const b = createWallBrush()
    b.id = 2
    b.name = 'b'

    a.redirectTo = b
    b.redirectTo = a

    // Should not hang, returns 0
    expect(findDoorForAlignment(a, WALL_HORIZONTAL, DOOR_NORMAL, false)).toBe(0)
  })
})

describe('switchDoor', () => {
  it('toggles closed to open', () => {
    const brush = makeWallWithDoors()
    const registry = makeMinimalRegistry({ wallBrushes: [brush] })
    expect(switchDoor(200, registry)).toBe(201) // closed → open
  })

  it('toggles open to closed', () => {
    const brush = makeWallWithDoors()
    const registry = makeMinimalRegistry({ wallBrushes: [brush] })
    expect(switchDoor(201, registry)).toBe(200) // open → closed
  })

  it('returns 0 for non-door wall item', () => {
    const brush = makeWallWithDoors()
    const registry = makeMinimalRegistry({ wallBrushes: [brush] })
    // 100 is a regular wall item, not a door
    expect(switchDoor(100, registry)).toBe(0)
  })

  it('returns 0 for unknown item', () => {
    const brush = makeWallWithDoors()
    const registry = makeMinimalRegistry({ wallBrushes: [brush] })
    expect(switchDoor(9999, registry)).toBe(0)
  })
})
