// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseWallBrushesXml } from './WallLoader'
import {
  WALL_POLE,
  WALL_HORIZONTAL,
  WALL_VERTICAL,
  WALL_UNTOUCHABLE,
  WALL_INTERSECTION,
  DOOR_ARCHWAY,
  DOOR_NORMAL,
  DOOR_LOCKED,
  DOOR_QUEST,
  DOOR_MAGIC,
  DOOR_WINDOW,
  DOOR_HATCH_WINDOW,
} from './WallTypes'

function wrap(inner: string): string {
  return `<materials>${inner}</materials>`
}

describe('parseWallBrushesXml', () => {
  it('parses a minimal wall brush with one wall item', () => {
    const xml = wrap(`
      <brush type="wall" name="Stone Wall" server_lookid="100">
        <wall type="horizontal">
          <item id="1234" chance="10" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })

    expect(brushes).toHaveLength(1)
    expect(brushes[0].name).toBe('Stone Wall')
    expect(brushes[0].lookId).toBe(100)
    expect(brushes[0].wallItems[WALL_HORIZONTAL].items).toHaveLength(1)
    expect(brushes[0].wallItems[WALL_HORIZONTAL].items[0]).toEqual({ id: 1234, chance: 10 })
    expect(brushes[0].wallItems[WALL_HORIZONTAL].totalChance).toBe(10)
  })

  it('prefers server_lookid over lookid', () => {
    const xml = wrap(`
      <brush type="wall" name="Test" server_lookid="200" lookid="50">
        <wall type="pole">
          <item id="1" chance="1" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    expect(brushes[0].lookId).toBe(200)
  })

  it('falls back to lookid when server_lookid is absent', () => {
    const xml = wrap(`
      <brush type="wall" name="Test" lookid="77">
        <wall type="pole">
          <item id="1" chance="1" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    expect(brushes[0].lookId).toBe(77)
  })

  it('maps wall type strings to alignment constants', () => {
    const xml = wrap(`
      <brush type="wall" name="Multi" server_lookid="10">
        <wall type="pole">
          <item id="1" chance="5" />
        </wall>
        <wall type="vertical">
          <item id="2" chance="8" />
        </wall>
        <wall type="untouchable">
          <item id="3" chance="3" />
        </wall>
        <wall type="intersection">
          <item id="4" chance="7" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const b = brushes[0]

    expect(b.wallItems[WALL_POLE].items).toHaveLength(1)
    expect(b.wallItems[WALL_POLE].items[0].id).toBe(1)

    expect(b.wallItems[WALL_VERTICAL].items).toHaveLength(1)
    expect(b.wallItems[WALL_VERTICAL].items[0].id).toBe(2)

    expect(b.wallItems[WALL_UNTOUCHABLE].items).toHaveLength(1)
    expect(b.wallItems[WALL_UNTOUCHABLE].items[0].id).toBe(3)

    expect(b.wallItems[WALL_INTERSECTION].items).toHaveLength(1)
    expect(b.wallItems[WALL_INTERSECTION].items[0].id).toBe(4)
  })

  it('computes cumulative chance correctly', () => {
    const xml = wrap(`
      <brush type="wall" name="CChance" server_lookid="10">
        <wall type="horizontal">
          <item id="10" chance="5" />
          <item id="11" chance="15" />
          <item id="12" chance="30" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const node = brushes[0].wallItems[WALL_HORIZONTAL]

    expect(node.totalChance).toBe(50)
    expect(node.items).toEqual([
      { id: 10, chance: 5 },
      { id: 11, chance: 20 },
      { id: 12, chance: 50 },
    ])
  })

  it('parses door type="normal" as a single door entry', () => {
    const xml = wrap(`
      <brush type="wall" name="DoorTest" server_lookid="10">
        <wall type="vertical">
          <door id="500" type="normal" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const doors = brushes[0].doorItems[WALL_VERTICAL]

    expect(doors).toHaveLength(1)
    expect(doors[0]).toEqual({ id: 500, type: DOOR_NORMAL, open: true })
  })

  it('expands door type="any door" to 5 door types', () => {
    const xml = wrap(`
      <brush type="wall" name="AnyDoor" server_lookid="10">
        <wall type="horizontal">
          <door id="600" type="any door" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const doors = brushes[0].doorItems[WALL_HORIZONTAL]

    expect(doors).toHaveLength(5)
    const types = doors.map(d => d.type)
    expect(types).toEqual([DOOR_ARCHWAY, DOOR_NORMAL, DOOR_LOCKED, DOOR_QUEST, DOOR_MAGIC])
    expect(doors.every(d => d.id === 600)).toBe(true)
  })

  it('expands door type="any window" to 2 window types', () => {
    const xml = wrap(`
      <brush type="wall" name="AnyWin" server_lookid="10">
        <wall type="vertical">
          <door id="700" type="any window" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const doors = brushes[0].doorItems[WALL_VERTICAL]

    expect(doors).toHaveLength(2)
    const types = doors.map(d => d.type)
    expect(types).toEqual([DOOR_WINDOW, DOOR_HATCH_WINDOW])
  })

  it('expands door type="any" to all 7 types (doors + windows)', () => {
    const xml = wrap(`
      <brush type="wall" name="AnyAll" server_lookid="10">
        <wall type="pole">
          <door id="800" type="any" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const doors = brushes[0].doorItems[WALL_POLE]

    expect(doors).toHaveLength(7)
    const types = doors.map(d => d.type)
    expect(types).toEqual([
      DOOR_ARCHWAY, DOOR_NORMAL, DOOR_LOCKED, DOOR_QUEST, DOOR_MAGIC,
      DOOR_WINDOW, DOOR_HATCH_WINDOW,
    ])
  })

  it('defaults open to true when not specified', () => {
    const xml = wrap(`
      <brush type="wall" name="OpenDefault" server_lookid="10">
        <wall type="horizontal">
          <door id="900" type="archway" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const doors = brushes[0].doorItems[WALL_HORIZONTAL]

    expect(doors).toHaveLength(1)
    expect(doors[0].open).toBe(true)
  })

  it('sets open to false when open="false"', () => {
    const xml = wrap(`
      <brush type="wall" name="ClosedDoor" server_lookid="10">
        <wall type="horizontal">
          <door id="901" type="locked" open="false" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })
    const doors = brushes[0].doorItems[WALL_HORIZONTAL]

    expect(doors).toHaveLength(1)
    expect(doors[0].open).toBe(false)
  })

  it('skips non-wall brush types', () => {
    const xml = wrap(`
      <brush type="ground" name="Grass" server_lookid="10">
        <wall type="horizontal">
          <item id="1" chance="1" />
        </wall>
      </brush>
      <brush type="wall" name="Real Wall" server_lookid="20">
        <wall type="pole">
          <item id="2" chance="1" />
        </wall>
      </brush>
      <brush type="carpet" name="Red Carpet" server_lookid="30">
        <wall type="vertical">
          <item id="3" chance="1" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })

    expect(brushes).toHaveLength(1)
    expect(brushes[0].name).toBe('Real Wall')
  })

  it('skips forward declarations (no server_lookid, no lookid, no wall children)', () => {
    const xml = wrap(`
      <brush type="wall" name="ForwardOnly" />
      <brush type="wall" name="Actual" server_lookid="55">
        <wall type="pole">
          <item id="1" chance="1" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })

    expect(brushes).toHaveLength(1)
    expect(brushes[0].name).toBe('Actual')
  })

  it('parses friend elements', () => {
    const xml = wrap(`
      <brush type="wall" name="MainWall" server_lookid="10">
        <friend name="Side Wall" />
        <friend name="Corner Wall" />
        <wall type="pole">
          <item id="1" chance="1" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })

    expect(brushes[0].friends.size).toBe(2)
    expect(brushes[0].friends.has('Side Wall')).toBe(true)
    expect(brushes[0].friends.has('Corner Wall')).toBe(true)
  })

  it('sets redirectName when friend has redirect="true"', () => {
    const xml = wrap(`
      <brush type="wall" name="Redirecting" server_lookid="10">
        <friend name="Normal Friend" />
        <friend name="Target Wall" redirect="true" />
        <wall type="pole">
          <item id="1" chance="1" />
        </wall>
      </brush>
    `)
    const brushes = parseWallBrushesXml(xml, { value: 1 })

    expect(brushes[0].redirectName).toBe('Target Wall')
    expect(brushes[0].friends.has('Normal Friend')).toBe(true)
    expect(brushes[0].friends.has('Target Wall')).toBe(true)
  })

  it('increments nextId for each parsed brush', () => {
    const xml = wrap(`
      <brush type="wall" name="Wall A" server_lookid="10">
        <wall type="pole"><item id="1" chance="1" /></wall>
      </brush>
      <brush type="wall" name="Wall B" server_lookid="20">
        <wall type="pole"><item id="2" chance="1" /></wall>
      </brush>
      <brush type="wall" name="Wall C" server_lookid="30">
        <wall type="pole"><item id="3" chance="1" /></wall>
      </brush>
    `)
    const nextId = { value: 5 }
    const brushes = parseWallBrushesXml(xml, nextId)

    expect(brushes).toHaveLength(3)
    expect(brushes[0].id).toBe(5)
    expect(brushes[1].id).toBe(6)
    expect(brushes[2].id).toBe(7)
    expect(nextId.value).toBe(8)
  })
})
