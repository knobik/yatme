import { describe, it, expect } from 'vitest'
import { Camera } from './Camera'
import { TILE_SIZE, GROUND_LAYER, ZOOM_LEVELS } from './constants'

function makeCamera(width = 800, height = 600) {
  return new Camera({ width, height })
}

describe('Camera', () => {
  describe('constructor defaults', () => {
    it('starts at zoom 1, floor 7, position (0,0)', () => {
      const cam = makeCamera()
      expect(cam.zoom).toBe(1)
      expect(cam.floor).toBe(GROUND_LAYER)
      expect(cam.x).toBe(0)
      expect(cam.y).toBe(0)
    })

    it('defaults to single floor view mode', () => {
      const cam = makeCamera()
      expect(cam.floorViewMode).toBe('single')
      expect(cam.showTransparentUpper).toBe(false)
    })
  })

  describe('setFloor', () => {
    it('changes floor and returns true', () => {
      const cam = makeCamera()
      expect(cam.setFloor(5)).toBe(true)
      expect(cam.floor).toBe(5)
    })

    it('returns false for same floor', () => {
      const cam = makeCamera()
      expect(cam.setFloor(GROUND_LAYER)).toBe(false)
    })

    it('returns false for floor < 0', () => {
      const cam = makeCamera()
      expect(cam.setFloor(-1)).toBe(false)
      expect(cam.floor).toBe(GROUND_LAYER)
    })

    it('returns false for floor > 15', () => {
      const cam = makeCamera()
      expect(cam.setFloor(16)).toBe(false)
      expect(cam.floor).toBe(GROUND_LAYER)
    })
  })

  describe('setFloorViewMode', () => {
    it('changes mode and returns true', () => {
      const cam = makeCamera()
      expect(cam.setFloorViewMode('current-below')).toBe(true)
      expect(cam.floorViewMode).toBe('current-below')
    })

    it('returns false for same mode', () => {
      const cam = makeCamera()
      expect(cam.setFloorViewMode('single')).toBe(false)
    })
  })

  describe('setShowTransparentUpper', () => {
    it('changes value and returns true', () => {
      const cam = makeCamera()
      expect(cam.setShowTransparentUpper(true)).toBe(true)
      expect(cam.showTransparentUpper).toBe(true)
    })

    it('returns false for same value', () => {
      const cam = makeCamera()
      expect(cam.setShowTransparentUpper(false)).toBe(false)
    })
  })

  describe('getFloorOffset', () => {
    it('above ground: z=7 offset is 0', () => {
      const cam = makeCamera()
      expect(cam.getFloorOffset(7)).toBe(0)
    })

    it('above ground: z=6 offset is 32', () => {
      const cam = makeCamera()
      expect(cam.getFloorOffset(6)).toBe(TILE_SIZE)
    })

    it('above ground: z=0 offset is 224', () => {
      const cam = makeCamera()
      expect(cam.getFloorOffset(0)).toBe(GROUND_LAYER * TILE_SIZE)
    })

    it('underground: offset relative to current floor', () => {
      const cam = makeCamera()
      cam.setFloor(10)
      expect(cam.getFloorOffset(10)).toBe(0)
      expect(cam.getFloorOffset(8)).toBe(2 * TILE_SIZE)
    })
  })

  describe('centerOn', () => {
    it('centers viewport on tile coordinates', () => {
      const cam = makeCamera(800, 600)
      cam.centerOn(100, 100)
      const offset = cam.getFloorOffset(GROUND_LAYER) // 0 at floor 7
      expect(cam.x).toBe(100 * TILE_SIZE - 800 / 2 - offset)
      expect(cam.y).toBe(100 * TILE_SIZE - 600 / 2 - offset)
    })

    it('accounts for floor offset when above ground', () => {
      const cam = makeCamera(800, 600)
      cam.setFloor(5)
      cam.centerOn(100, 100)
      const offset = cam.getFloorOffset(5) // (7-5)*32 = 64
      expect(offset).toBe(64)
      expect(cam.x).toBe(100 * TILE_SIZE - 800 / 2 - offset)
      expect(cam.y).toBe(100 * TILE_SIZE - 600 / 2 - offset)
    })

    it('accounts for zoom when centering', () => {
      const cam = makeCamera(800, 600)
      cam.setZoom(2, 800, 600)
      cam.centerOn(100, 100)
      const offset = cam.getFloorOffset(GROUND_LAYER)
      // centerOn divides screen dimensions by (2 * zoom)
      expect(cam.x).toBe(100 * TILE_SIZE - 800 / (2 * 2) - offset)
      expect(cam.y).toBe(100 * TILE_SIZE - 600 / (2 * 2) - offset)
    })
  })

  describe('setZoom', () => {
    it('snaps to nearest ZOOM_LEVEL', () => {
      const cam = makeCamera()
      cam.setZoom(1.1, 800, 600)
      expect(ZOOM_LEVELS).toContain(cam.zoom)
      expect(cam.zoom).toBe(1) // 1 is closer than 1.25
    })

    it('keeps viewport center stable', () => {
      const cam = makeCamera(800, 600)
      cam.x = 1000
      cam.y = 500
      const centerBeforeX = cam.x + 800 / (2 * cam.zoom)
      const centerBeforeY = cam.y + 600 / (2 * cam.zoom)

      cam.setZoom(2, 800, 600)

      const centerAfterX = cam.x + 800 / (2 * cam.zoom)
      const centerAfterY = cam.y + 600 / (2 * cam.zoom)
      expect(centerAfterX).toBeCloseTo(centerBeforeX, 5)
      expect(centerAfterY).toBeCloseTo(centerBeforeY, 5)
    })

    it('no-op when already at that level', () => {
      const cam = makeCamera()
      cam.x = 100
      cam.setZoom(1, 800, 600)
      expect(cam.x).toBe(100) // unchanged
    })
  })

  describe('zoomAt', () => {
    it('deltaY < 0 zooms in (higher index)', () => {
      const cam = makeCamera()
      const oldZoom = cam.zoom
      cam.zoomAt(400, 300, -1)
      expect(cam.zoom).toBeGreaterThan(oldZoom)
    })

    it('deltaY > 0 zooms out (lower index)', () => {
      const cam = makeCamera()
      cam.setZoom(2, 800, 600)
      const oldZoom = cam.zoom
      cam.zoomAt(400, 300, 1)
      expect(cam.zoom).toBeLessThan(oldZoom)
    })

    it('clamps at min zoom level', () => {
      const cam = makeCamera()
      cam.setZoom(ZOOM_LEVELS[0], 800, 600)
      cam.zoomAt(400, 300, 1) // try to zoom out further
      expect(cam.zoom).toBe(ZOOM_LEVELS[0])
    })

    it('clamps at max zoom level', () => {
      const cam = makeCamera()
      cam.setZoom(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], 800, 600)
      cam.zoomAt(400, 300, -1) // try to zoom in further
      expect(cam.zoom).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 1])
    })
  })

  describe('getVisibleFloors', () => {
    it('single mode returns only current floor', () => {
      const cam = makeCamera()
      expect(cam.getVisibleFloors()).toEqual([GROUND_LAYER])
    })

    it('current-below above ground: from ground down to current', () => {
      const cam = makeCamera()
      cam.setFloor(5)
      cam.setFloorViewMode('current-below')
      expect(cam.getVisibleFloors()).toEqual([7, 6, 5])
    })

    it('all mode above ground: from ground down to 0', () => {
      const cam = makeCamera()
      cam.setFloor(5)
      cam.setFloorViewMode('all')
      expect(cam.getVisibleFloors()).toEqual([7, 6, 5, 4, 3, 2, 1, 0])
    })

    it('underground current-below: floor+2 down to current', () => {
      const cam = makeCamera()
      cam.setFloor(10)
      cam.setFloorViewMode('current-below')
      expect(cam.getVisibleFloors()).toEqual([12, 11, 10])
    })

    it('caches results until floor/mode changes', () => {
      const cam = makeCamera()
      const first = cam.getVisibleFloors()
      const second = cam.getVisibleFloors()
      expect(first).toBe(second) // same reference
    })
  })

  describe('getTileAt', () => {
    it('converts screen coords to tile coords at default zoom', () => {
      const cam = makeCamera()
      cam.x = 0
      cam.y = 0
      // At floor 7, offset=0. screenX=64, zoom=1 -> worldX = floor((0 + 0 + 64) / 32) = 2
      const tile = cam.getTileAt(64, 96)
      expect(tile.x).toBe(2)
      expect(tile.y).toBe(3)
      expect(tile.z).toBe(GROUND_LAYER)
    })

    it('correct with non-1 zoom', () => {
      const cam = makeCamera()
      cam.setZoom(2, 800, 600)
      cam.x = 0
      cam.y = 0
      // zoom=2, screenX=64 -> 64/2=32 world pixels -> tile 1
      const tile = cam.getTileAt(64, 64)
      expect(tile.x).toBe(1)
      expect(tile.y).toBe(1)
    })
  })

  describe('getVisibleRangeForFloor', () => {
    it('returns chunk range covering viewport', () => {
      const cam = makeCamera(800, 600)
      cam.x = 0
      cam.y = 0
      const range = cam.getVisibleRangeForFloor(0)
      expect(range.startX).toBeLessThanOrEqual(0)
      expect(range.startY).toBeLessThanOrEqual(0)
      expect(range.endX).toBeGreaterThan(0)
      expect(range.endY).toBeGreaterThan(0)
    })
  })

  describe('computeRangeKey', () => {
    it('returns deterministic string for same state', () => {
      const cam = makeCamera()
      const key1 = cam.computeRangeKey([7])
      const key2 = cam.computeRangeKey([7])
      expect(key1).toBe(key2)
    })

    it('changes when camera position changes', () => {
      const cam = makeCamera()
      const key1 = cam.computeRangeKey([7])
      cam.x = 500
      const key2 = cam.computeRangeKey([7])
      expect(key1).not.toBe(key2)
    })

    it('changes when floor changes', () => {
      const cam = makeCamera()
      const key1 = cam.computeRangeKey([7])
      cam.setFloor(5)
      const key2 = cam.computeRangeKey([5])
      expect(key1).not.toBe(key2)
    })

    it('changes when floor view mode changes', () => {
      const cam = makeCamera()
      const key1 = cam.computeRangeKey([7])
      cam.setFloorViewMode('current-below')
      const key2 = cam.computeRangeKey([7])
      expect(key1).not.toBe(key2)
    })
  })
})
