import type { OtbmWaypoint } from './otbm'
import { tileKey } from './otbm'

export class WaypointManager {
  private positionMap = new Map<string, OtbmWaypoint>()
  private nameMap = new Map<string, OtbmWaypoint>()

  constructor(waypoints: OtbmWaypoint[]) {
    for (const wp of waypoints) {
      this.positionMap.set(tileKey(wp.x, wp.y, wp.z), wp)
      this.nameMap.set(wp.name, wp)
    }
  }

  add(wp: OtbmWaypoint): void {
    if (this.nameMap.has(wp.name)) {
      throw new Error(`Waypoint with name "${wp.name}" already exists`)
    }
    const posKey = tileKey(wp.x, wp.y, wp.z)
    if (this.positionMap.has(posKey)) {
      throw new Error(`Waypoint already exists at position ${posKey}`)
    }
    this.positionMap.set(posKey, wp)
    this.nameMap.set(wp.name, wp)
  }

  remove(name: string): OtbmWaypoint | undefined {
    const wp = this.nameMap.get(name)
    if (!wp) return undefined
    this.nameMap.delete(name)
    this.positionMap.delete(tileKey(wp.x, wp.y, wp.z))
    return wp
  }

  rename(oldName: string, newName: string): void {
    if (oldName === newName) return
    if (this.nameMap.has(newName)) {
      throw new Error(`Waypoint with name "${newName}" already exists`)
    }
    const wp = this.nameMap.get(oldName)
    if (!wp) throw new Error(`Waypoint "${oldName}" not found`)
    this.nameMap.delete(oldName)
    wp.name = newName
    this.nameMap.set(newName, wp)
  }

  move(name: string, x: number, y: number, z: number): void {
    const wp = this.nameMap.get(name)
    if (!wp) throw new Error(`Waypoint "${name}" not found`)
    const newPosKey = tileKey(x, y, z)
    const oldPosKey = tileKey(wp.x, wp.y, wp.z)
    if (oldPosKey === newPosKey) return
    if (this.positionMap.has(newPosKey)) {
      throw new Error(`Waypoint already exists at position ${newPosKey}`)
    }
    this.positionMap.delete(oldPosKey)
    wp.x = x
    wp.y = y
    wp.z = z
    this.positionMap.set(newPosKey, wp)
  }

  getByPosition(x: number, y: number, z: number): OtbmWaypoint | undefined {
    return this.positionMap.get(tileKey(x, y, z))
  }

  getByName(name: string): OtbmWaypoint | undefined {
    return this.nameMap.get(name)
  }

  hasPosition(x: number, y: number, z: number): boolean {
    return this.positionMap.has(tileKey(x, y, z))
  }

  getAll(): OtbmWaypoint[] {
    return Array.from(this.nameMap.values())
  }

  /** Return waypoints on a specific floor, avoiding full array allocation when possible. */
  getByFloor(z: number): OtbmWaypoint[] {
    const result: OtbmWaypoint[] = []
    for (const wp of this.nameMap.values()) {
      if (wp.z === z) result.push(wp)
    }
    return result
  }

  get size(): number {
    return this.nameMap.size
  }

  generateUniqueName(base = 'Waypoint'): string {
    let i = 1
    while (this.nameMap.has(`${base} ${i}`)) i++
    return `${base} ${i}`
  }
}
