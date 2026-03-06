// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeXml, parseBordersXml, parseGroundBrushesXml } from './BrushLoader'
import type { AutoBorder } from './BrushTypes'
import {
  NORTH_HORIZONTAL, EAST_HORIZONTAL, SOUTH_HORIZONTAL, WEST_HORIZONTAL,
  NORTHWEST_CORNER, NORTHEAST_CORNER, SOUTHWEST_CORNER, SOUTHEAST_CORNER,
  NORTHWEST_DIAGONAL, NORTHEAST_DIAGONAL, SOUTHEAST_DIAGONAL, SOUTHWEST_DIAGONAL,
} from './BorderTable'

describe('sanitizeXml', () => {
  it('escapes bare & into &amp;', () => {
    expect(sanitizeXml('rock & soil')).toBe('rock &amp; soil')
  })

  it('preserves existing entity references', () => {
    const input = '&amp; &lt; &gt; &quot; &apos;'
    expect(sanitizeXml(input)).toBe(input)
  })

  it('preserves numeric character references', () => {
    expect(sanitizeXml('&#123;')).toBe('&#123;')
  })

  it('passes through clean XML unchanged', () => {
    const xml = '<root><item id="1" name="test"/></root>'
    expect(sanitizeXml(xml)).toBe(xml)
  })
})

describe('parseBordersXml', () => {
  it('parses a single border with all 12 edges populated', () => {
    const xml = `<borders>
      <border id="1" group="5">
        <borderitem edge="n" item="100"/>
        <borderitem edge="e" item="101"/>
        <borderitem edge="s" item="102"/>
        <borderitem edge="w" item="103"/>
        <borderitem edge="cnw" item="104"/>
        <borderitem edge="cne" item="105"/>
        <borderitem edge="csw" item="106"/>
        <borderitem edge="cse" item="107"/>
        <borderitem edge="dnw" item="108"/>
        <borderitem edge="dne" item="109"/>
        <borderitem edge="dsw" item="110"/>
        <borderitem edge="dse" item="111"/>
      </border>
    </borders>`
    const map = parseBordersXml(xml)
    const border = map.get(1)!
    expect(border).toBeDefined()
    expect(border.tiles[NORTH_HORIZONTAL]).toBe(100)
    expect(border.tiles[EAST_HORIZONTAL]).toBe(101)
    expect(border.tiles[SOUTH_HORIZONTAL]).toBe(102)
    expect(border.tiles[WEST_HORIZONTAL]).toBe(103)
    expect(border.tiles[NORTHWEST_CORNER]).toBe(104)
    expect(border.tiles[NORTHEAST_CORNER]).toBe(105)
    expect(border.tiles[SOUTHWEST_CORNER]).toBe(106)
    expect(border.tiles[SOUTHEAST_CORNER]).toBe(107)
    expect(border.tiles[NORTHWEST_DIAGONAL]).toBe(108)
    expect(border.tiles[NORTHEAST_DIAGONAL]).toBe(109)
    expect(border.tiles[SOUTHWEST_DIAGONAL]).toBe(110)
    expect(border.tiles[SOUTHEAST_DIAGONAL]).toBe(111)
  })

  it('fills missing edges with null', () => {
    const xml = `<borders>
      <border id="2" group="0">
        <borderitem edge="n" item="200"/>
        <borderitem edge="s" item="201"/>
      </border>
    </borders>`
    const map = parseBordersXml(xml)
    const border = map.get(2)!
    expect(border.tiles[NORTH_HORIZONTAL]).toBe(200)
    expect(border.tiles[SOUTH_HORIZONTAL]).toBe(201)
    expect(border.tiles[EAST_HORIZONTAL]).toBeNull()
    expect(border.tiles[WEST_HORIZONTAL]).toBeNull()
    expect(border.tiles[0]).toBeNull() // index 0 unused
  })

  it('returns empty map for empty XML', () => {
    const map = parseBordersXml('<borders></borders>')
    expect(map.size).toBe(0)
  })

  it('skips borders with missing or zero id', () => {
    const xml = `<borders>
      <border id="0"><borderitem edge="n" item="1"/></border>
      <border><borderitem edge="n" item="2"/></border>
    </borders>`
    const map = parseBordersXml(xml)
    expect(map.size).toBe(0)
  })

  it('parses group attribute', () => {
    const xml = `<borders><border id="10" group="3"></border></borders>`
    const map = parseBordersXml(xml)
    expect(map.get(10)!.group).toBe(3)
  })

  it('tiles array has exactly 13 elements', () => {
    const xml = `<borders><border id="5" group="0"></border></borders>`
    const map = parseBordersXml(xml)
    expect(map.get(5)!.tiles).toHaveLength(13)
  })

  it('parses multiple borders in the same XML', () => {
    const xml = `<borders>
      <border id="1" group="0"><borderitem edge="n" item="10"/></border>
      <border id="2" group="1"><borderitem edge="s" item="20"/></border>
      <border id="3" group="2"><borderitem edge="e" item="30"/></border>
    </borders>`
    const map = parseBordersXml(xml)
    expect(map.size).toBe(3)
    expect(map.get(1)!.tiles[NORTH_HORIZONTAL]).toBe(10)
    expect(map.get(2)!.tiles[SOUTH_HORIZONTAL]).toBe(20)
    expect(map.get(3)!.tiles[EAST_HORIZONTAL]).toBe(30)
  })
})

describe('parseGroundBrushesXml', () => {
  function makeBordersMap(...borders: AutoBorder[]): Map<number, AutoBorder> {
    const map = new Map<number, AutoBorder>()
    for (const b of borders) map.set(b.id, b)
    return map
  }

  function makeBorder(id: number, group = 0): AutoBorder {
    const tiles: (number | null)[] = new Array(13).fill(null)
    // Put some items so we can verify lookups
    tiles[NORTH_HORIZONTAL] = id * 100 + 1
    tiles[EAST_HORIZONTAL] = id * 100 + 2
    return { id, group, tiles }
  }

  it('parses a minimal brush with one item', () => {
    const xml = `<brushes>
      <brush type="ground" name="Grass" lookid="100" z-order="5">
        <item id="500" chance="10"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes).toHaveLength(1)
    expect(brushes[0].items).toEqual([{ id: 500, chance: 10 }])
  })

  it('parses name, lookId, and zOrder', () => {
    const xml = `<brushes>
      <brush type="ground" name="Desert Sand" lookid="222" z-order="15">
        <item id="1" chance="1"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].name).toBe('Desert Sand')
    expect(brushes[0].lookId).toBe(222)
    expect(brushes[0].zOrder).toBe(15)
  })

  it('totalChance equals sum of item chances', () => {
    const xml = `<brushes>
      <brush type="ground" name="Mix" lookid="1" z-order="1">
        <item id="10" chance="30"/>
        <item id="11" chance="20"/>
        <item id="12" chance="50"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].totalChance).toBe(100)
  })

  it('increments nextId after each brush', () => {
    const xml = `<brushes>
      <brush type="ground" name="A" lookid="1" z-order="1"><item id="1" chance="1"/></brush>
      <brush type="ground" name="B" lookid="2" z-order="2"><item id="2" chance="1"/></brush>
    </brushes>`
    const nextId = { value: 10 }
    const brushes = parseGroundBrushesXml(xml, new Map(), nextId)
    expect(brushes[0].id).toBe(10)
    expect(brushes[1].id).toBe(11)
    expect(nextId.value).toBe(12)
  })

  it('skips non-ground types', () => {
    const xml = `<brushes>
      <brush type="wall" name="Stone Wall" lookid="1">
        <item id="1" chance="1"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes).toHaveLength(0)
  })

  it('skips forward declarations (no lookid, no items)', () => {
    const xml = `<brushes>
      <brush type="ground" name="ForwardRef" z-order="1">
        <friend name="Other"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes).toHaveLength(0)
  })

  it('parses outer border by ID reference from bordersMap', () => {
    const border = makeBorder(42)
    const bordersMap = makeBordersMap(border)
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="42" to="all"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, bordersMap, { value: 1 })
    expect(brushes[0].borders).toHaveLength(1)
    expect(brushes[0].borders[0].outer).toBe(true)
    expect(brushes[0].borders[0].autoborder).toBe(border)
    expect(brushes[0].hasOuterBorder).toBe(true)
  })

  it('parses inner border with align="inner"', () => {
    const border = makeBorder(7)
    const bordersMap = makeBordersMap(border)
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="7" align="inner" to="all"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, bordersMap, { value: 1 })
    expect(brushes[0].borders[0].outer).toBe(false)
    expect(brushes[0].hasInnerBorder).toBe(true)
  })

  it('sets to=0 for border to="none"', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="0" to="none"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].borders[0].to).toBe(0)
    expect(brushes[0].hasOuterZilchBorder).toBe(true)
  })

  it('sets to=0xFFFFFFFF for border to="all"', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="0" to="all"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].borders[0].to).toBe(0xFFFFFFFF)
  })

  it('sets to=-1 and toName for named border target', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="0" to="Mountain Brush"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].borders[0].to).toBe(-1)
    expect(brushes[0].borders[0].toName).toBe('Mountain Brush')
  })

  it('creates inline autoborder from <borderitem> children', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border to="all">
          <borderitem edge="n" item="900"/>
          <borderitem edge="s" item="901"/>
        </border>
      </brush>
    </brushes>`
    const bordersMap = new Map<number, AutoBorder>()
    const brushes = parseGroundBrushesXml(xml, bordersMap, { value: 1 })
    const ab = brushes[0].borders[0].autoborder!
    expect(ab).not.toBeNull()
    expect(ab.id).toBeLessThan(0) // synthetic negative ID
    expect(ab.tiles[NORTH_HORIZONTAL]).toBe(900)
    expect(ab.tiles[SOUTH_HORIZONTAL]).toBe(901)
    // Inline border should be registered in bordersMap
    expect(bordersMap.get(ab.id)).toBe(ab)
  })

  it('parses <friend> elements and sets hateFriends=false', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <friend name="Grass"/>
        <friend name="Dirt"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].friends.has('Grass')).toBe(true)
    expect(brushes[0].friends.has('Dirt')).toBe(true)
    expect(brushes[0].hateFriends).toBe(false)
  })

  it('parses <enemy> elements and sets hateFriends=true', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <enemy name="Water"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].friends.has('Water')).toBe(true)
    expect(brushes[0].hateFriends).toBe(true)
  })

  it('parses <optional> border', () => {
    const border = makeBorder(99)
    const bordersMap = makeBordersMap(border)
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <optional id="99"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, bordersMap, { value: 1 })
    expect(brushes[0].optionalBorder).toBe(border)
    expect(brushes[0].hasOuterZilchBorder).toBe(true)
    expect(brushes[0].hasOuterBorder).toBe(true)
  })

  it('sets isRandomizable=false when randomize="false"', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1" randomize="false">
        <item id="1" chance="10"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].isRandomizable).toBe(false)
  })

  it('sets isRandomizable=false when totalChance is 0', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="0"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].totalChance).toBe(0)
    expect(brushes[0].isRandomizable).toBe(false)
  })

  it('parses <clear_friends> to reset friends set', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <friend name="Grass"/>
        <friend name="Dirt"/>
        <clear_friends/>
        <friend name="Sand"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].friends.size).toBe(1)
    expect(brushes[0].friends.has('Sand')).toBe(true)
    expect(brushes[0].friends.has('Grass')).toBe(false)
  })

  it('parses solo_optional="true" attribute', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1" solo_optional="true">
        <item id="1" chance="1"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].useSoloOptionalBorder).toBe(true)
  })

  it('clones and overrides base autoborder when inline borderitems are added to existing border', () => {
    const baseBorder: AutoBorder = {
      id: 50,
      group: 1,
      tiles: (() => { const t: (number | null)[] = new Array(13).fill(null); t[NORTH_HORIZONTAL] = 500; t[EAST_HORIZONTAL] = 501; return t })(),
    }
    const bordersMap = makeBordersMap(baseBorder)
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="50" to="all">
          <borderitem edge="s" item="999"/>
        </border>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, bordersMap, { value: 1 })
    const ab = brushes[0].borders[0].autoborder!
    // Should be a clone, not the original
    expect(ab).not.toBe(baseBorder)
    // Original values preserved
    expect(ab.tiles[NORTH_HORIZONTAL]).toBe(500)
    expect(ab.tiles[EAST_HORIZONTAL]).toBe(501)
    expect(ab.tiles[SOUTH_HORIZONTAL]).toBe(999)
    expect(baseBorder.tiles[SOUTH_HORIZONTAL]).toBeNull()
  })

  it('sets hasInnerZilchBorder for inner border with to="none"', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="0" align="inner" to="none"/>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    expect(brushes[0].hasInnerZilchBorder).toBe(true)
  })

  it('parses <specific> cases with match_item condition and replace_item action', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="0" to="all">
          <specific>
            <conditions>
              <match_item id="777"/>
            </conditions>
            <actions>
              <replace_item id="777" with="888"/>
            </actions>
          </specific>
        </border>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    const specific = brushes[0].borders[0].specificCases
    expect(specific).toHaveLength(1)
    expect(specific[0].itemsToMatch).toEqual([777])
    expect(specific[0].toReplaceId).toBe(777)
    expect(specific[0].withId).toBe(888)
    expect(specific[0].matchGroup).toBe(0)
  })

  it('parses <specific> cases with match_border condition and replace_border action', () => {
    const border: AutoBorder = {
      id: 10,
      group: 2,
      tiles: (() => { const t: (number | null)[] = new Array(13).fill(null); t[NORTH_HORIZONTAL] = 100; t[EAST_HORIZONTAL] = 101; t[SOUTH_HORIZONTAL] = 102; t[WEST_HORIZONTAL] = 103; return t })(),
    }
    const bordersMap = makeBordersMap(border)
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="0" to="all">
          <specific>
            <conditions>
              <match_border id="10" edge="n"/>
            </conditions>
            <actions>
              <replace_border id="10" edge="e" with="999"/>
            </actions>
          </specific>
        </border>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, bordersMap, { value: 1 })
    const specific = brushes[0].borders[0].specificCases
    expect(specific).toHaveLength(1)
    // match_border resolves border 10 edge "n" → item 100
    expect(specific[0].itemsToMatch).toEqual([100])
    // replace_border resolves border 10 edge "e" → item 101
    expect(specific[0].toReplaceId).toBe(101)
    expect(specific[0].withId).toBe(999)
  })

  it('parses <specific> cases with match_group condition', () => {
    const xml = `<brushes>
      <brush type="ground" name="G" lookid="1" z-order="1">
        <item id="1" chance="1"/>
        <border id="0" to="all">
          <specific>
            <conditions>
              <match_group group="5" edge="s"/>
            </conditions>
            <actions>
              <delete_borders/>
            </actions>
          </specific>
        </border>
      </brush>
    </brushes>`
    const brushes = parseGroundBrushesXml(xml, new Map(), { value: 1 })
    const specific = brushes[0].borders[0].specificCases
    expect(specific).toHaveLength(1)
    expect(specific[0].matchGroup).toBe(5)
    expect(specific[0].groupMatchAlignment).toBe(SOUTH_HORIZONTAL)
    expect(specific[0].itemsToMatch).toEqual([5]) // group pushed as placeholder
    expect(specific[0].deleteAll).toBe(true)
  })
})
