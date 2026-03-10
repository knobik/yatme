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
  name: string          // creature type name (lookup key into CreatureDatabase)
  direction: Direction  // facing direction
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

Loaded from `data/creatures/monsters.xml` and `data/creatures/npcs.xml`. Actual RME format (attributes on element, NOT child nodes):

```xml
<!-- monsters.xml -->
<monsters>
  <monster name="Rat" looktype="21"/>
  <monster name="Achad" looktype="146" lookhead="95" lookbody="93" looklegs="38" lookfeet="59" lookaddons="3"/>
  <monster name="A Shielded Astral Glyph" lookitem="24226"/>
</monsters>

<!-- npcs.xml -->
<npcs>
  <npc name="Josef" looktype="131" lookitem="0" lookaddon="0" lookhead="38" lookbody="85" looklegs="9" lookfeet="85"/>
</npcs>
```

`CreatureDatabase` class responsibilities:
- Parse both XML files
- Lookup by name (case-insensitive): `getByName(name: string): CreatureType | undefined`
- List all: `getAllMonsters(): CreatureType[]`, `getAllNpcs(): CreatureType[]`
- Search/filter by name substring (for palette UI): `search(query: string, isNpc: boolean): CreatureType[]`

### Init Pipeline Integration

`CreatureDatabase` is loaded in `loadAssets()` (`src/lib/initPipeline.ts`) **after** appearances (needed to validate lookType exists). The `data/creatures/` directory must be served by Vite (add to `publicDir` or serve config alongside existing `data/` path).

---

## Spawn Zone System

### SpawnManager

A new class `SpawnManager` (lives on `OtbmMap` or as standalone) encapsulates all spawn zone logic:

```typescript
class SpawnManager {
  // Spawn center registries
  monsterSpawns: Set<string>   // "x,y,z" keys of monster spawn centers
  npcSpawns: Set<string>       // "x,y,z" keys of NPC spawn centers

  // Per-tile spawn coverage counts
  monsterSpawnCounts: Map<string, number>  // "x,y,z" → count of monster spawns covering this tile
  npcSpawnCounts: Map<string, number>      // "x,y,z" → count of NPC spawns covering this tile

  // Mutators
  addMonsterSpawn(centerX, centerY, centerZ, radius): void
  removeMonsterSpawn(centerX, centerY, centerZ, radius): void
  addNpcSpawn(centerX, centerY, centerZ, radius): void
  removeNpcSpawn(centerX, centerY, centerZ, radius): void

  // Queries
  getMonsterSpawnCount(x, y, z): number
  getNpcSpawnCount(x, y, z): number
  isInMonsterSpawn(x, y, z): boolean
  isInNpcSpawn(x, y, z): boolean
  getTilesInRadius(centerX, centerY, centerZ, radius): Position[]
}
```

### How Spawn Zones Work (RME Behavior)

1. A **spawn zone** is a marker placed on a single tile (the center) with a **radius**.
2. All tiles within the radius are considered "inside" the spawn zone.
3. Creatures can only be placed on tiles covered by at least one spawn zone (unless auto-create is enabled).
4. The spawn zone is a square area: `(center.x - radius)` to `(center.x + radius)` in both X and Y.
5. Multiple spawn zones can overlap — tiles track how many spawns cover them.

### Spawn Count Tracking

When a spawn zone is added/removed, `SpawnManager` increments/decrements counts on all tiles in the radius. Used for:
- `canPlaceCreature()` checks
- Overlay rendering intensity (overlapping spawns darken more)

### Auto-Create Spawn

Editor setting (`autoCreateSpawn: boolean`, default `true`): when placing a creature on a tile with no spawn coverage, auto-create a spawn zone (radius=1) centered on that tile. Matches RME's `AUTO_CREATE_SPAWN_MONSTER` / `AUTO_CREATE_SPAWN_NPC`.

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

## MapMutator Creature Operations

Extend `MapMutator` with creature-specific mutations (all undoable):

```typescript
// Creature placement
placeCreature(x, y, z, creature: TileCreature): void
removeCreature(x, y, z, creatureName: string, isNpc: boolean): void
moveCreature(fromX, fromY, fromZ, toX, toY, toZ, creatureName: string, isNpc: boolean): void

// Creature property editing
updateCreatureProperties(x, y, z, creatureName: string, isNpc: boolean, props: Partial<TileCreature>): void

// Spawn zone operations
placeSpawnZone(x, y, z, type: 'monster' | 'npc', radius: number): void
removeSpawnZone(x, y, z, type: 'monster' | 'npc'): void
updateSpawnRadius(x, y, z, type: 'monster' | 'npc', newRadius: number): void
```

Each mutation records an undo action that reverses the change. Spawn zone mutations also update `SpawnManager` counts.

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

Creatures are rendered on their tile using their **outfit lookType** from the appearances data:
- `lookType` → outfit appearance ID. Resolve to idle sprite for the stored direction.
- `lookItem` → item-based outfit (fallback: render as item sprite using existing `SpriteResolver`).
- Missing/unknown outfits → render a placeholder icon (e.g., question mark or generic creature silhouette).

**Render layer order**: Creatures render AFTER all tile items (on top of everything). Monsters first, then NPC (NPC on top if both exist).

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
- **MonsterBrush/NpcBrush active**: Click places creature on tile via `MapMutator.placeCreature()`. Drag to smear (place on multiple tiles).
- **SpawnMonsterBrush/SpawnNpcBrush active**: Click creates spawn zone via `MapMutator.placeSpawnZone()` with configured radius.
- **Erase tool**: Removes creatures via `MapMutator.removeCreature()` and spawn zones via `MapMutator.removeSpawnZone()`.
- **Select tool**: Can select creatures (click on creature sprite to select it, drag to move via `MapMutator.moveCreature()`).

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

- **Import (on load)**: Parse sidecar XML files when loading OTBM. Match creature names against `CreatureDatabase`. Unknown creatures logged as warnings but still loaded (marked as missing).
- **Export (on save)**: Write sidecar XML files when saving OTBM. Iterate spawn centers, collect creatures within radius.
- **Import standalone**: Menu option to import spawn XML files independently.
- **Export standalone**: Menu option to export spawn XML files independently.

---

## Acceptance Criteria

1. Creatures (monsters and NPCs) can be placed on tiles from the palette
2. Spawn zones can be created with configurable radius
3. Creatures render with their outfit sprite on the map
4. Spawn zones render as colored overlays
5. Four independent visibility toggles work correctly
6. Creatures can be selected, moved (drag & drop), and deleted
7. Creature and spawn properties are editable via modals
8. Spawn data serializes to/from RME-compatible XML format
9. All operations support undo/redo
10. Creature palette supports search and tileset filtering
11. Hamburger menu has entries for all visibility toggles and import/export
12. Tests cover creature placement, spawn zone logic, serialization, and overlay rendering

---

## Implementation Phases

See [PROGRESS-creatures.md](./PROGRESS-creatures.md) for detailed task-level tracking and dependency graph.

| Phase | Name | Depends On | Summary |
|-------|------|------------|---------|
| 1 | Types & Creature Database | — | `Direction`, `TileCreature`, `CreatureType`, `CreatureDatabase` (parse XML, lookup) |
| 2 | Tile Model & Spawn Manager | 1 | Extend `OtbmTile` with creature/spawn fields, `SpawnManager` class |
| 3 | Sidecar XML Parsing & Init | 1, 2 | Parse `*-monster.xml` / `*-npc.xml`, wire into `initPipeline.ts` |
| 4 | Editor Settings & Toggles | 3 | 4 visibility settings + `autoCreateSpawn`, App.tsx state, hamburger menu |
| 5 | Spawn Zone Overlays | 2, 4 | `MonsterSpawnOverlay`, `NpcSpawnOverlay`, MapRenderer wiring |
| 6 | Creature Sprite Resolution | 3 | `CreatureSpriteResolver` — lookType/lookItem → renderable sprite |
| 7 | Creature Rendering on Tiles | 5, 6 | Render creatures in `TileRenderer` after items, respect visibility |
| 8 | MapMutator Creature Ops | 2 | place/remove/move creature, place/remove/update spawn zone (all with undo) |
| 9 | Creature Brushes | 4, 8 | `MonsterBrush`, `NpcBrush`, `SpawnMonsterBrush`, `SpawnNpcBrush`, auto-create |
| 10 | Creature Tool & Erase | 9 | `creatureTool.ts`, smear, hoverHandler, erase tool extension |
| 11 | Creature Palette UI | 6, 10 | `CreaturePalette` component, tabs, search, mode toggle, controls |
| 12 | Selection & Movement | 7, 8 | Select tool creature selection + drag-move |
| 13 | Property Modals | 8 | Creature properties modal, spawn zone properties modal |
| 14 | Context Menu & Inspector | 12, 13 | Context menu entries, inspector creature display |
| 15 | Write on Save | 2, 3 | `writeMonsterSpawnXml` / `writeNpcSpawnXml`, hook into save flow |
| 16 | Standalone Import/Export | 3, 15 | Menu-driven import/export of spawn XML files |
| 17 | Polish & Testing | all | Edge cases, performance, keyboard shortcuts, integration tests |
