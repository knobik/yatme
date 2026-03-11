import { describe, it, expect } from 'vitest'
import { WaypointManager } from './WaypointManager'
import type { OtbmWaypoint } from './otbm'

function wp(name: string, x: number, y: number, z: number): OtbmWaypoint {
  return { name, x, y, z }
}

describe('WaypointManager', () => {
  it('initializes from waypoint array', () => {
    const mgr = new WaypointManager([wp('A', 10, 20, 7), wp('B', 30, 40, 7)])
    expect(mgr.size).toBe(2)
    expect(mgr.getByName('A')).toEqual({ name: 'A', x: 10, y: 20, z: 7 })
    expect(mgr.getByPosition(30, 40, 7)).toEqual({ name: 'B', x: 30, y: 40, z: 7 })
  })

  it('adds a waypoint', () => {
    const mgr = new WaypointManager([])
    mgr.add(wp('Test', 5, 5, 7))
    expect(mgr.getByName('Test')).toBeDefined()
    expect(mgr.hasPosition(5, 5, 7)).toBe(true)
  })

  it('rejects duplicate name', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7)])
    expect(() => mgr.add(wp('A', 2, 2, 7))).toThrow('already exists')
  })

  it('rejects duplicate position', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7)])
    expect(() => mgr.add(wp('B', 1, 1, 7))).toThrow('already exists at position')
  })

  it('removes a waypoint by name', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7)])
    const removed = mgr.remove('A')
    expect(removed?.name).toBe('A')
    expect(mgr.size).toBe(0)
    expect(mgr.hasPosition(1, 1, 7)).toBe(false)
  })

  it('returns undefined when removing nonexistent', () => {
    const mgr = new WaypointManager([])
    expect(mgr.remove('nope')).toBeUndefined()
  })

  it('renames a waypoint', () => {
    const mgr = new WaypointManager([wp('Old', 1, 1, 7)])
    mgr.rename('Old', 'New')
    expect(mgr.getByName('Old')).toBeUndefined()
    expect(mgr.getByName('New')).toBeDefined()
    expect(mgr.getByName('New')!.name).toBe('New')
  })

  it('rejects rename to existing name', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7), wp('B', 2, 2, 7)])
    expect(() => mgr.rename('A', 'B')).toThrow('already exists')
  })

  it('moves a waypoint', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7)])
    mgr.move('A', 5, 5, 6)
    expect(mgr.hasPosition(1, 1, 7)).toBe(false)
    expect(mgr.hasPosition(5, 5, 6)).toBe(true)
    expect(mgr.getByName('A')!.x).toBe(5)
  })

  it('rejects move to occupied position', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7), wp('B', 2, 2, 7)])
    expect(() => mgr.move('A', 2, 2, 7)).toThrow('already exists at position')
  })

  it('getAll returns all waypoints', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7), wp('B', 2, 2, 7)])
    expect(mgr.getAll()).toHaveLength(2)
  })

  it('generates unique names', () => {
    const mgr = new WaypointManager([wp('Waypoint 1', 1, 1, 7)])
    expect(mgr.generateUniqueName()).toBe('Waypoint 2')
    mgr.add(wp('Waypoint 2', 2, 2, 7))
    expect(mgr.generateUniqueName()).toBe('Waypoint 3')
  })

  it('generates unique names with custom base', () => {
    const mgr = new WaypointManager([])
    expect(mgr.generateUniqueName('Point')).toBe('Point 1')
  })

  it('no-ops rename to same name', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7)])
    mgr.rename('A', 'A') // should not throw
    expect(mgr.getByName('A')).toBeDefined()
  })

  it('no-ops move to same position', () => {
    const mgr = new WaypointManager([wp('A', 1, 1, 7)])
    mgr.move('A', 1, 1, 7) // should not throw
    expect(mgr.getByPosition(1, 1, 7)).toBeDefined()
  })
})
