// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseDoodadBrushesXml } from './DoodadLoader'

function nextId() {
  return { value: 1 }
}

describe('parseDoodadBrushesXml', () => {
  it('parses a minimal doodad with a root <item>', () => {
    const xml = `<brushes>
      <brush type="doodad" name="Campfire" server_lookid="1234">
        <item id="500" chance="5"/>
      </brush>
    </brushes>`
    const brushes = parseDoodadBrushesXml(xml, nextId())
    expect(brushes).toHaveLength(1)
    const b = brushes[0]
    expect(b.name).toBe('Campfire')
    expect(b.lookId).toBe(1234)
    expect(b.alternatives).toHaveLength(1)
    expect(b.alternatives[0].singles).toHaveLength(1)
    expect(b.alternatives[0].singles[0]).toEqual({ itemId: 500, chance: 5 })
  })

  it('parses thickness "12/100" into thickness and thicknessCeiling', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1" thickness="12/100">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.thickness).toBe(12)
    expect(b.thicknessCeiling).toBe(100)
  })

  it('defaults thickness to 10/100 when not specified', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.thickness).toBe(10)
    expect(b.thicknessCeiling).toBe(100)
  })

  it('defaults draggable to true', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.draggable).toBe(true)
  })

  it('sets draggable to false when draggable="false"', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1" draggable="false">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.draggable).toBe(false)
  })

  it('sets onBlocking to true when on_blocking="true"', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1" on_blocking="true">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.onBlocking).toBe(true)
  })

  it('sets onDuplicate to true when on_duplicate="true"', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1" on_duplicate="true">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.onDuplicate).toBe(true)
  })

  it('creates separate alternatives from <alternate> blocks', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <alternate>
          <item id="100" chance="3"/>
          <item id="101" chance="2"/>
        </alternate>
        <alternate>
          <item id="200" chance="5"/>
        </alternate>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.alternatives).toHaveLength(2)
    expect(b.alternatives[0].singles).toHaveLength(2)
    expect(b.alternatives[0].totalChance).toBe(5)
    expect(b.alternatives[1].singles).toHaveLength(1)
    expect(b.alternatives[1].totalChance).toBe(5)
  })

  it('groups root-level items into a default alternative with correct totalChance', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <item id="10" chance="4"/>
        <item id="11" chance="6"/>
        <item id="12"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.alternatives).toHaveLength(1)
    const alt = b.alternatives[0]
    expect(alt.singles).toHaveLength(3)
    // chance defaults to 1 when not specified (or "0")
    expect(alt.singles[2].chance).toBe(1)
    expect(alt.totalChance).toBe(4 + 6 + 1)
  })

  it('parses <composite> with <tile> offsets', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <composite chance="7">
          <tile x="0" y="0" z="0"><item id="300"/></tile>
          <tile x="1" y="0" z="0"><item id="301"/></tile>
          <tile x="0" y="1" z="0"><item id="302"/></tile>
        </composite>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.alternatives).toHaveLength(1)
    const comp = b.alternatives[0].composites[0]
    expect(comp.chance).toBe(7)
    expect(comp.tiles).toHaveLength(3)
    expect(comp.tiles[0]).toEqual({ dx: 0, dy: 0, dz: 0, itemIds: [300] })
    expect(comp.tiles[1]).toEqual({ dx: 1, dy: 0, dz: 0, itemIds: [301] })
    expect(comp.tiles[2]).toEqual({ dx: 0, dy: 1, dz: 0, itemIds: [302] })
  })

  it('merges tiles at the same offset within a composite', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <composite chance="1">
          <tile x="2" y="3" z="0"><item id="400"/></tile>
          <tile x="2" y="3" z="0"><item id="401"/></tile>
        </composite>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    const comp = b.alternatives[0].composites[0]
    expect(comp.tiles).toHaveLength(1)
    expect(comp.tiles[0].itemIds).toEqual([400, 401])
  })

  it('returns empty array for a doodad with no items', () => {
    const xml = `<brushes>
      <brush type="doodad" name="Empty" lookid="1">
      </brush>
    </brushes>`
    const brushes = parseDoodadBrushesXml(xml, nextId())
    expect(brushes).toHaveLength(0)
  })

  it('skips non-doodad brush types', () => {
    const xml = `<brushes>
      <brush type="ground" name="Grass" server_lookid="100">
        <item id="10"/>
      </brush>
      <brush type="wall" name="StoneWall" server_lookid="200">
        <item id="20"/>
      </brush>
      <brush type="doodad" name="Mushroom" lookid="50">
        <item id="30"/>
      </brush>
    </brushes>`
    const brushes = parseDoodadBrushesXml(xml, nextId())
    expect(brushes).toHaveLength(1)
    expect(brushes[0].name).toBe('Mushroom')
  })

  it('handles composites with multiple items per tile', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <composite chance="3">
          <tile x="0" y="0" z="0">
            <item id="600"/>
            <item id="601"/>
            <item id="602"/>
          </tile>
        </composite>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    const comp = b.alternatives[0].composites[0]
    expect(comp.tiles).toHaveLength(1)
    expect(comp.tiles[0].itemIds).toEqual([600, 601, 602])
  })

  it('prefers server_lookid over lookid for lookId', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" server_lookid="999" lookid="111">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.lookId).toBe(999)
  })

  it('assigns incremental ids from nextId counter', () => {
    const xml = `<brushes>
      <brush type="doodad" name="A" lookid="1"><item id="10"/></brush>
      <brush type="doodad" name="B" lookid="2"><item id="20"/></brush>
    </brushes>`
    const counter = { value: 42 }
    const brushes = parseDoodadBrushesXml(xml, counter)
    expect(brushes[0].id).toBe(42)
    expect(brushes[1].id).toBe(43)
    expect(counter.value).toBe(44)
  })

  it('combines root singles and composites into one default alternative', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <item id="10" chance="2"/>
        <composite chance="3">
          <tile x="0" y="0" z="0"><item id="20"/></tile>
        </composite>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.alternatives).toHaveLength(1)
    const alt = b.alternatives[0]
    expect(alt.singles).toHaveLength(1)
    expect(alt.composites).toHaveLength(1)
    expect(alt.totalChance).toBe(2 + 3)
  })

  it('defaults onBlocking and onDuplicate to false', () => {
    const xml = `<brushes>
      <brush type="doodad" name="T" lookid="1">
        <item id="10"/>
      </brush>
    </brushes>`
    const b = parseDoodadBrushesXml(xml, nextId())[0]
    expect(b.onBlocking).toBe(false)
    expect(b.onDuplicate).toBe(false)
  })
})
