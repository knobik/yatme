// Parse RME XML wall brush definitions into our data structures.

import {
  type WallBrush, type WallDoor,
  createWallBrush, WALL_TYPE_MAP,
  DOOR_ARCHWAY, DOOR_NORMAL, DOOR_LOCKED, DOOR_QUEST,
  DOOR_MAGIC, DOOR_WINDOW, DOOR_HATCH_WINDOW,
} from './WallTypes'
import { sanitizeXml } from './BrushLoader'

// Door type name → constant
const DOOR_TYPE_MAP: Record<string, number> = {
  'archway': DOOR_ARCHWAY,
  'normal': DOOR_NORMAL,
  'locked': DOOR_LOCKED,
  'quest': DOOR_QUEST,
  'magic': DOOR_MAGIC,
  'window': DOOR_WINDOW,
  'hatch_window': DOOR_HATCH_WINDOW,
  'hatch window': DOOR_HATCH_WINDOW,
}

export function parseWallBrushesXml(
  raw: string,
  nextId: { value: number },
): WallBrush[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(sanitizeXml(raw), 'text/xml')
  const brushes: WallBrush[] = []

  for (const brushEl of doc.querySelectorAll('brush')) {
    const type = brushEl.getAttribute('type')
    if (type !== 'wall') continue

    const name = brushEl.getAttribute('name') || ''

    // Determine look ID (server_lookid takes priority, but we just store the raw value)
    const serverLookId = parseInt(brushEl.getAttribute('server_lookid') || '0', 10)
    const lookId = parseInt(brushEl.getAttribute('lookid') || '0', 10)

    // Skip empty forward declarations
    if (!serverLookId && !lookId && !brushEl.querySelector('wall')) continue

    const brush = createWallBrush()
    brush.id = nextId.value++
    brush.name = name
    brush.lookId = serverLookId || lookId

    // Parse <wall type="..."> children
    for (const wallEl of brushEl.children) {
      const tag = wallEl.tagName.toLowerCase()

      if (tag === 'wall') {
        const typeStr = wallEl.getAttribute('type') || ''
        const alignment = WALL_TYPE_MAP[typeStr]
        if (alignment === undefined) continue

        const node = brush.wallItems[alignment]

        for (const childEl of wallEl.children) {
          const childTag = childEl.tagName.toLowerCase()

          if (childTag === 'item') {
            const id = parseInt(childEl.getAttribute('id') || '0', 10)
            const chance = parseInt(childEl.getAttribute('chance') || '0', 10)
            if (!id) continue

            // Chance is cumulative in RME
            node.totalChance += chance
            node.items.push({ id, chance: node.totalChance })
          } else if (childTag === 'door') {
            const id = parseInt(childEl.getAttribute('id') || '0', 10)
            if (!id) continue

            const doorTypeStr = childEl.getAttribute('type') || ''
            const openAttr = childEl.getAttribute('open')
            const isOpen = openAttr ? openAttr === 'true' : true

            // Handle "any door", "any window", "any" wildcards
            const isAnyDoor = doorTypeStr === 'any door' || doorTypeStr === 'any'
            const isAnyWindow = doorTypeStr === 'any window' || doorTypeStr === 'any'

            if (isAnyDoor) {
              for (const dt of [DOOR_ARCHWAY, DOOR_NORMAL, DOOR_LOCKED, DOOR_QUEST, DOOR_MAGIC]) {
                brush.doorItems[alignment].push({ id, type: dt, open: isOpen })
              }
            }
            if (isAnyWindow) {
              for (const dt of [DOOR_WINDOW, DOOR_HATCH_WINDOW]) {
                brush.doorItems[alignment].push({ id, type: dt, open: isOpen })
              }
            }
            if (!isAnyDoor && !isAnyWindow) {
              const dt = DOOR_TYPE_MAP[doorTypeStr]
              if (dt !== undefined) {
                brush.doorItems[alignment].push({ id, type: dt, open: isOpen })
              }
            }
          }
        }
      } else if (tag === 'friend') {
        const friendName = wallEl.getAttribute('name')
        if (!friendName) continue
        brush.friends.add(friendName)

        // Check for redirect
        const redirect = wallEl.getAttribute('redirect')
        if (redirect === 'true' && !brush.redirectName) {
          brush.redirectName = friendName
        }
      }
    }

    brushes.push(brush)
  }

  return brushes
}
