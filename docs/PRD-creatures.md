# PRD: Monster & NPC System

## Overview

Implement a full creature system (monsters and NPCs) with spawn zones, matching RME's behavior. Creatures are first-class tile entities — placeable, movable, selectable, and serialized to sidecar XML files alongside the OTBM map.

## Reference

RME source: `vendor/remeres-map-editor/source/` — key files: `monster.h`, `npc.h`, `spawn_monster.h`, `spawn_npc.h`, `monster_brush.cpp`, `npc_brush.cpp`, `spawn_monster_brush.cpp`, `spawn_npc_brush.cpp`, `tile.h`, `iomap_otbm.cpp`, `palette_monster.h`, `map_drawer.cpp`.

---

## Data Model

### Creature Entity

```typescript
interface TileCreature {
  name: string          // creature type name (lookup key)
  direction: Direction  // NORTH=0, EAST=1, SOUTH=2, WEST=3
  spawnTime: number     // respawn interval in seconds
  weight?: number       // spawn probability weight (monsters only, 0-255)
  isNpc: boolean        // true = NPC, false = monster
}

enum Direction {
  NORTH = 0,
  EAST = 1,
  SOUTH = 2,
  WEST = 3,
}
```

### Tile Storage

Extend `OtbmTile` with:
- `monsters: TileCreature[]` — multiple monsters per tile (like RME's `std::vector<Monster*>`)
- `npc?: TileCreature` — at most one NPC per tile (like RME's `Npc* npc`)
- `spawnMonster?: { radius: number }` — monster spawn zone center marker
- `spawnNpc?: { radius: number }` — NPC spawn zone center marker

### Spawn Zone Tracking (Map-Level)

On `OtbmMap` or a separate manager:
- `monsterSpawns: Set<string>` — positions ("x,y,z") of all monster spawn centers
- `npcSpawns: Set<string>` — positions ("x,y,z") of all NPC spawn centers

Each tile location also needs a **spawn count** (how many spawn zones cover this tile) for both monster and NPC spawns. This determines whether creatures can be placed on a tile.

### Creature Database

```typescript
interface CreatureType {
  name: string
  lookType: number        // outfit ID from appearances
  lookItem?: number       // item ID for item-based outfits
  lookMount?: number
  lookAddon?: number
  lookHead?: number       // color layers
  lookBody?: number
  lookLegs?: number
  lookFeet?: number
  isNpc: boolean
}
```

Loaded from `data/creatures/monsters.xml` and `data/creatures/npcs.xml` (or a combined `creatures.xml`). Format matches RME:

```xml
<monsters>
  <monster name="Rat">
    <look type="21" />
  </monster>
  ...
</monsters>
```

A `CreatureDatabase` class provides lookup by name, lists all monsters/NPCs, and supports search/filtering.

---

## Spawn Zone System

### How Spawn Zones Work (RME Behavior)

1. A **spawn zone** is a marker placed on a single tile (the center) with a **radius**.
2. All tiles within the radius are considered "inside" the spawn zone.
3. Creatures can only be placed on tiles covered by at least one spawn zone (unless auto-create is enabled).
4. The spawn zone is a square area: `(center.x - radius)` to `(center.x + radius)` in both X and Y.
5. Multiple spawn zones can overlap — tiles track how many spawns cover them.

### Spawn Count Tracking

When a spawn zone is added/removed, increment/decrement spawn counts on all tiles in its radius. This is tracked at the `TileLocation` level (or equivalent). Used for:
- `canPlaceCreature()` checks
- Overlay rendering intensity (overlapping spawns darken more)

### Auto-Create Spawn

Setting: when placing a creature on a tile with no spawn coverage, auto-create a `SpawnMonster(1)` or `SpawnNpc(1)` (radius=1) on that tile. Enabled by default (matches RME's `AUTO_CREATE_SPAWN_MONSTER` / `AUTO_CREATE_SPAWN_NPC`).

---

## Brush System

### Four New Brush Types

| Brush | Behavior | Smear | Details |
|-------|----------|-------|---------|
| **MonsterBrush** | Places a specific monster on tile | Yes | Requires spawn coverage or auto-create. Won't duplicate same type on tile. Blocked in PZ. |
| **NpcBrush** | Places a specific NPC on tile | Yes | Replaces existing NPC. Requires spawn coverage or auto-create. |
| **SpawnMonsterBrush** | Creates monster spawn zone | No | Uses brush size as radius. Only one spawn per tile center. |
| **SpawnNpcBrush** | Creates NPC spawn zone | No | Uses brush size as radius. Only one spawn per tile center. |

### BrushSelection Extension

```typescript
type BrushSelection =
  | { mode: 'brush'; brushType: 'ground' | 'wall' | 'carpet' | 'table' | 'doodad'; brushName: string }
  | { mode: 'raw'; itemId: number }
  | { mode: 'creature'; creatureName: string; isNpc: boolean }
  | { mode: 'spawn'; spawnType: 'monster' | 'npc' }
```

---

## Palette UI

### Creature Palette (New Panel)

Two tabs or sections: **Monsters** and **NPCs**.

Each section contains:
- **Tileset dropdown** — category filter (e.g., "Rotworms", "Demons", "Undead" for monsters)
- **Search field** — filter by name
- **Creature list** — scrollable list with outfit sprite preview + name
- **Mode toggle** — "Place Creature" vs "Place Spawn Zone"
- **Spawn time** spinner (default: 60s for monsters, 60s for NPCs)
- **Spawn radius** spinner (when in spawn zone mode, 1-15)

Selecting a creature from the list sets the active brush to `MonsterBrush` or `NpcBrush`. Toggling to "Place Spawn" switches to `SpawnMonsterBrush` or `SpawnNpcBrush`.

### Tileset Integration

Creature tilesets loaded from `data/materials/tilesets.xml` (like existing brush tilesets). Each tileset has a `creature` category containing monster/NPC names.

---

## Rendering

### Creature Sprites

Creatures are rendered on their tile using their **outfit lookType** from the appearances data. The outfit system uses:
- `lookType` → appearance ID for the creature sprite
- Pattern/animation selection for idle frame
- Direction affects which sprite frame to show

For MVP, render creatures as a single idle frame facing their stored direction. Full outfit coloring (head/body/legs/feet layers) is a stretch goal.

### Spawn Zone Overlay

Two overlay classes (similar to `ZoneOverlay` / `HouseOverlay`):

- **MonsterSpawnOverlay** — renders on tiles covered by monster spawns
  - Color: warm red/orange tint (semi-transparent)
  - Intensity increases with overlapping spawns (multiply by 0.7 per spawn, like RME)
  - Spawn center tile gets a special icon/marker

- **NpcSpawnOverlay** — renders on tiles covered by NPC spawns
  - Color: cool blue/cyan tint (semi-transparent)
  - Same overlap behavior

### Spawn Center Indicator

The tile at the center of a spawn zone gets a visible indicator (icon or colored border) so the user can identify spawn centers vs. covered tiles.

---

## Visibility Toggles

Four independent settings in `EditorSettings`:

| Setting | Default | Description |
|---------|---------|-------------|
| `showMonsters` | `true` | Show monster sprites on tiles |
| `showMonsterSpawns` | `true` | Show monster spawn zone overlay |
| `showNpcs` | `true` | Show NPC sprites on tiles |
| `showNpcSpawns` | `true` | Show NPC spawn zone overlay |

Menu entries in hamburger menu under **View** section. Keyboard shortcuts TBD (RME uses F/S/X/U).

---

## Tools

### Creature Tool (`'creature'`)

New editor tool for placing creatures and spawn zones. Activated when a creature brush or spawn brush is selected from the palette.

**Behavior:**
- **MonsterBrush/NpcBrush active**: Click places creature on tile. Drag to smear (place on multiple tiles).
- **SpawnMonsterBrush/SpawnNpcBrush active**: Click creates spawn zone centered on tile with configured radius.
- **Erase tool**: Removes creatures and spawn zones.
- **Select tool**: Can select creatures (click on creature sprite to select it, drag to move).

### Creature Properties Modal

Opened via context menu or double-click on a creature. Shows:
- Creature name (read-only)
- Direction (dropdown: N/E/S/W)
- Spawn time (spinner, seconds)
- Weight (spinner, monsters only)

### Spawn Zone Properties Modal

Opened via context menu or double-click on a spawn zone center. Shows:
- Spawn type (read-only: monster/NPC)
- Radius (spinner, 1-15)

---

## Serialization

### XML File Format (RME Compatible)

Monster spawns saved to `{mapname}-monster.xml`:
```xml
<?xml version="1.0"?>
<monsters>
  <monster centerx="100" centery="100" centerz="7" radius="5">
    <monster name="Rat" x="0" y="0" z="7" spawntime="60" weight="100" direction="0"/>
    <monster name="Spider" x="2" y="1" z="7" spawntime="60" weight="50" direction="2"/>
  </monster>
</monsters>
```

NPC spawns saved to `{mapname}-npc.xml`:
```xml
<?xml version="1.0"?>
<npcs>
  <npc centerx="300" centery="300" centerz="7" radius="2">
    <npc name="Josef" x="0" y="0" z="7" spawntime="3600" direction="1"/>
  </npc>
</npcs>
```

**Key details:**
- Creature positions stored as **relative offsets** from spawn center (`x = tile.x - center.x`)
- Z coordinate stored as **absolute** value
- OTBM header stores spawn filenames via attributes (already supported: `spawnFile`, `npcFile` on `OtbmMap`)
- Creatures must belong to a spawn zone to be serialized. Orphan creatures (outside any spawn) are warned and skipped.

### Import/Export

- **Import**: Parse sidecar XML files when loading OTBM. Match creature names against `CreatureDatabase`.
- **Export**: Write sidecar XML files when saving OTBM. Iterate spawn centers, collect creatures within radius.
- **Import standalone**: Menu option to import spawn XML files independently.
- **Export standalone**: Menu option to export spawn XML files independently.

---

## Undo/Redo

All creature and spawn operations go through `MapMutator` and are undoable:
- Place/remove creature
- Place/remove spawn zone
- Move creature (drag & drop)
- Edit creature properties
- Edit spawn zone radius

---

## Acceptance Criteria

1. Creatures (monsters and NPCs) can be placed on tiles from the palette
2. Spawn zones can be created with configurable radius
3. Creatures render with their outfit sprite on the map
4. Spawn zones render as colored overlays
5. Four independent visibility toggles work correctly
6. Creatures can be selected, moved (drag & drop), and deleted
7. Creature and spawn properties are editable
8. Spawn data serializes to/from RME-compatible XML format
9. All operations support undo/redo
10. Creature palette supports search and tileset filtering
11. Hamburger menu has entries for all visibility toggles and import/export
12. Tests cover creature placement, spawn zone logic, serialization, and overlay rendering

---

## Implementation Phases

### Phase 1: Data Foundation
- Creature types and database (`CreatureDatabase`)
- Tile model extensions (monsters, npc, spawnMonster, spawnNpc)
- Spawn zone tracking (spawn counts per tile location)
- Creature data file (`data/creatures/monsters.xml`, `data/creatures/npcs.xml`)
- Parse `*-monster.xml` and `*-npc.xml` sidecar files on OTBM load

### Phase 2: Spawn Zone System
- Spawn zone add/remove logic with radius-based tile coverage
- Spawn count tracking on tile locations
- MonsterSpawnOverlay and NpcSpawnOverlay rendering
- Visibility toggles in EditorSettings + MapRenderer
- Hamburger menu entries

### Phase 3: Creature Brushes & Placement
- MonsterBrush, NpcBrush, SpawnMonsterBrush, SpawnNpcBrush
- BrushSelection extension for creature/spawn modes
- Creature tool (place, smear, erase)
- Auto-create spawn setting
- Integration with MapMutator (undo/redo)

### Phase 4: Creature Rendering
- Outfit sprite resolution from appearances data
- Creature rendering on tiles (idle frame, direction-aware)
- Creature visibility toggles

### Phase 5: Creature Palette UI
- CreaturePalette component (monsters tab, NPCs tab)
- Search, tileset filtering, creature list with sprite preview
- Mode toggle (place creature vs place spawn)
- Spawn time, radius, weight controls
- Integration with App.tsx state and toolbar

### Phase 6: Selection & Interaction
- Select tool: select creatures, drag to move
- Creature properties panel/modal (direction, spawn time, weight)
- Spawn zone properties (radius editing)
- Context menu entries for creatures
- Inspector integration

### Phase 7: Serialization (Write & Standalone Import/Export)
- Write sidecar XML files on OTBM save
- Import/export standalone spawn files
- Hamburger menu entries for import/export

### Phase 8: Polish & Testing
- Comprehensive test coverage
- Edge cases (orphan creatures, overlapping spawns, auto-create)
- Performance optimization for large spawn zones
- Keyboard shortcuts for visibility toggles
