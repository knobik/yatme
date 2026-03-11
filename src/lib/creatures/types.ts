export interface Position {
  x: number
  y: number
  z: number
}

export const Direction = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3,
} as const

export type Direction = (typeof Direction)[keyof typeof Direction]

export function nextDirection(d: Direction): Direction {
  return ((d + 1) % 4) as Direction
}

export interface TileCreature {
  name: string
  direction: Direction
  spawnTime: number
  weight?: number
  isNpc: boolean
}

export interface CreatureType {
  name: string
  lookType: number
  lookItem?: number
  lookMount?: number
  lookAddon?: number
  lookHead?: number
  lookBody?: number
  lookLegs?: number
  lookFeet?: number
  isNpc: boolean
}
