// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseCarpetBrushesXml } from './CarpetLoader'
import {
  CARPET_NORTH,
  CARPET_EAST,
  CARPET_SOUTH,
  CARPET_WEST,
  CARPET_CORNER_NW,
  CARPET_CORNER_NE,
  CARPET_CORNER_SW,
  CARPET_CORNER_SE,
  CARPET_DIAGONAL_NW,
  CARPET_DIAGONAL_NE,
  CARPET_DIAGONAL_SE,
  CARPET_DIAGONAL_SW,
  CARPET_CENTER,
  TABLE_NORTH_END,
  TABLE_SOUTH_END,
  TABLE_EAST_END,
  TABLE_WEST_END,
  TABLE_HORIZONTAL,
  TABLE_VERTICAL,
  TABLE_ALONE,
} from './CarpetTypes'

describe('parseCarpetBrushesXml — carpet brushes', () => {
  it('parses inline id on <carpet> element', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="Red Carpet" server_lookid="100">
          <carpet align="n" id="101" />
          <carpet align="s" id="102" />
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(1)
    expect(carpets[0].name).toBe('Red Carpet')
    expect(carpets[0].carpetItems[CARPET_NORTH].items).toEqual([
      { id: 101, chance: 1 },
    ])
    expect(carpets[0].carpetItems[CARPET_SOUTH].items).toEqual([
      { id: 102, chance: 1 },
    ])
  })

  it('parses child <item> elements', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="Blue Carpet" server_lookid="200">
          <carpet align="e">
            <item id="201" />
            <item id="202" />
          </carpet>
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(1)
    const node = carpets[0].carpetItems[CARPET_EAST]
    expect(node.items).toHaveLength(2)
    expect(node.items[0]).toEqual({ id: 201, chance: 1 })
    expect(node.items[1]).toEqual({ id: 202, chance: 2 })
    expect(node.totalChance).toBe(2)
  })

  it('maps all alignment strings correctly', () => {
    const alignments = [
      { align: 'n', index: CARPET_NORTH },
      { align: 'e', index: CARPET_EAST },
      { align: 's', index: CARPET_SOUTH },
      { align: 'w', index: CARPET_WEST },
      { align: 'cnw', index: CARPET_CORNER_NW },
      { align: 'cne', index: CARPET_CORNER_NE },
      { align: 'csw', index: CARPET_CORNER_SW },
      { align: 'cse', index: CARPET_CORNER_SE },
      { align: 'dnw', index: CARPET_DIAGONAL_NW },
      { align: 'dne', index: CARPET_DIAGONAL_NE },
      { align: 'dse', index: CARPET_DIAGONAL_SE },
      { align: 'dsw', index: CARPET_DIAGONAL_SW },
      { align: 'center', index: CARPET_CENTER },
    ]

    const carpetEntries = alignments
      .map((a, i) => `<carpet align="${a.align}" id="${300 + i}" />`)
      .join('\n')

    const xml = `
      <materials>
        <brush type="carpet" name="All Aligns" server_lookid="299">
          ${carpetEntries}
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(1)
    for (let i = 0; i < alignments.length; i++) {
      const node = carpets[0].carpetItems[alignments[i].index]
      expect(node.items).toHaveLength(1)
      expect(node.items[0].id).toBe(300 + i)
    }
  })

  it('accumulates cumulative chance correctly', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="Chance Carpet" server_lookid="400">
          <carpet align="n">
            <item id="401" chance="5" />
            <item id="402" chance="3" />
            <item id="403" chance="2" />
          </carpet>
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    const node = carpets[0].carpetItems[CARPET_NORTH]
    expect(node.totalChance).toBe(10)
    expect(node.items).toEqual([
      { id: 401, chance: 5 },
      { id: 402, chance: 8 },
      { id: 403, chance: 10 },
    ])
  })

  it('falls back to lookId for center when no center defined', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="No Center" server_lookid="500">
          <carpet align="n" id="501" />
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(1)
    const centerNode = carpets[0].carpetItems[CARPET_CENTER]
    expect(centerNode.items).toHaveLength(1)
    expect(centerNode.items[0]).toEqual({ id: 500, chance: 1 })
    expect(centerNode.totalChance).toBe(1)
  })

  it('skips brush with no items (returns null)', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="Empty Carpet" server_lookid="600">
          <carpet align="invalid_alignment" id="601" />
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(0)
  })

  it('prefers server_lookid over lookid', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="Pref Test" server_lookid="700" lookid="999">
          <carpet align="n" id="701" />
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets[0].lookId).toBe(700)
  })

  it('skips forward declarations (no server_lookid, no lookid, no carpet children)', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="Forward Decl" />
      </materials>
    `
    const nextId = { value: 10 }
    const { carpets } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(0)
    // nextId should NOT be incremented since the brush was skipped before id assignment
    expect(nextId.value).toBe(10)
  })
})

describe('parseCarpetBrushesXml — table brushes', () => {
  it('parses a minimal table with one item', () => {
    const xml = `
      <materials>
        <brush type="table" name="Wood Table" server_lookid="800">
          <table align="alone">
            <item id="801" />
          </table>
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { tables } = parseCarpetBrushesXml(xml, nextId)

    expect(tables).toHaveLength(1)
    expect(tables[0].name).toBe('Wood Table')
    expect(tables[0].lookId).toBe(800)
    const node = tables[0].tableItems[TABLE_ALONE]
    expect(node.items).toEqual([{ id: 801, chance: 1 }])
    expect(node.totalChance).toBe(1)
  })

  it('maps all table alignment strings correctly', () => {
    const alignments = [
      { align: 'north', index: TABLE_NORTH_END },
      { align: 'south', index: TABLE_SOUTH_END },
      { align: 'east', index: TABLE_EAST_END },
      { align: 'west', index: TABLE_WEST_END },
      { align: 'horizontal', index: TABLE_HORIZONTAL },
      { align: 'vertical', index: TABLE_VERTICAL },
      { align: 'alone', index: TABLE_ALONE },
    ]

    const tableEntries = alignments
      .map((a, i) => `<table align="${a.align}"><item id="${900 + i}" /></table>`)
      .join('\n')

    const xml = `
      <materials>
        <brush type="table" name="All Table Aligns" server_lookid="899">
          ${tableEntries}
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { tables } = parseCarpetBrushesXml(xml, nextId)

    expect(tables).toHaveLength(1)
    for (let i = 0; i < alignments.length; i++) {
      const node = tables[0].tableItems[alignments[i].index]
      expect(node.items).toHaveLength(1)
      expect(node.items[0].id).toBe(900 + i)
    }
  })

  it('accumulates cumulative chance for table items', () => {
    const xml = `
      <materials>
        <brush type="table" name="Chance Table" server_lookid="1000">
          <table align="north">
            <item id="1001" chance="4" />
            <item id="1002" chance="6" />
          </table>
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { tables } = parseCarpetBrushesXml(xml, nextId)

    const node = tables[0].tableItems[TABLE_NORTH_END]
    expect(node.totalChance).toBe(10)
    expect(node.items).toEqual([
      { id: 1001, chance: 4 },
      { id: 1002, chance: 10 },
    ])
  })

  it('skips table with no valid items', () => {
    const xml = `
      <materials>
        <brush type="table" name="Empty Table" server_lookid="1100">
          <table align="bad_align">
            <item id="1101" />
          </table>
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { tables } = parseCarpetBrushesXml(xml, nextId)

    expect(tables).toHaveLength(0)
  })

  it('increments nextId for each parsed brush', () => {
    const xml = `
      <materials>
        <brush type="table" name="Table A" server_lookid="1200">
          <table align="alone"><item id="1201" /></table>
        </brush>
        <brush type="table" name="Table B" server_lookid="1300">
          <table align="alone"><item id="1301" /></table>
        </brush>
      </materials>
    `
    const nextId = { value: 50 }
    const { tables } = parseCarpetBrushesXml(xml, nextId)

    expect(tables).toHaveLength(2)
    expect(tables[0].id).toBe(50)
    expect(tables[1].id).toBe(51)
    expect(nextId.value).toBe(52)
  })

  it('parses both carpets and tables from the same XML', () => {
    const xml = `
      <materials>
        <brush type="carpet" name="Mixed Carpet" server_lookid="1400">
          <carpet align="center" id="1401" />
        </brush>
        <brush type="table" name="Mixed Table" server_lookid="1500">
          <table align="alone"><item id="1501" /></table>
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets, tables } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(1)
    expect(carpets[0].name).toBe('Mixed Carpet')
    expect(tables).toHaveLength(1)
    expect(tables[0].name).toBe('Mixed Table')
    expect(nextId.value).toBe(3)
  })

  it('skips non-carpet/table brush types', () => {
    const xml = `
      <materials>
        <brush type="ground" name="Grass" server_lookid="1600">
          <carpet align="n" id="1601" />
        </brush>
        <brush type="wall" name="Stone Wall" server_lookid="1700">
          <carpet align="s" id="1701" />
        </brush>
        <brush type="carpet" name="Real Carpet" server_lookid="1800">
          <carpet align="n" id="1801" />
        </brush>
      </materials>
    `
    const nextId = { value: 1 }
    const { carpets, tables } = parseCarpetBrushesXml(xml, nextId)

    expect(carpets).toHaveLength(1)
    expect(carpets[0].name).toBe('Real Carpet')
    expect(tables).toHaveLength(0)
  })
})
