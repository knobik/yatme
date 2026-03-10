# Creature System — Progress Tracker

**PRD**: [PRD-creatures.md](./PRD-creatures.md)

## Phase 1: Data Foundation
- [ ] Define `TileCreature` interface and `Direction` enum
- [ ] Define `CreatureType` interface
- [ ] Implement `CreatureDatabase` class (load from XML, lookup by name, list all, search/filter)
- [x] Create creature data files (`data/creatures/monsters.xml`, `data/creatures/npcs.xml`)
- [ ] Extend `OtbmTile` with `monsters`, `npc`, `spawnMonster`, `spawnNpc` fields
- [ ] Add spawn tracking to map level (`monsterSpawns`, `npcSpawns` position sets)
- [ ] Add spawn count tracking per tile location
- [ ] Parse `*-monster.xml` on OTBM load (populate tiles with monsters + spawn zones)
- [ ] Parse `*-npc.xml` on OTBM load (populate tiles with NPCs + spawn zones)
- [ ] Tests: creature database loading, tile creature storage, spawn XML parsing

## Phase 2: Spawn Zone System
- [ ] Implement spawn zone add/remove with radius-based tile coverage
- [ ] Implement spawn count increment/decrement on covered tiles
- [ ] Create `MonsterSpawnOverlay` class (extends TileOverlay pattern)
- [ ] Create `NpcSpawnOverlay` class
- [ ] Spawn center indicator rendering
- [ ] Add `showMonsters`, `showMonsterSpawns`, `showNpcs`, `showNpcSpawns` to `EditorSettings`
- [ ] Wire overlays into `MapRenderer` (update loop, destroy, recycle)
- [ ] Wire visibility toggles into renderer (`setShowMonsterSpawnOverlay`, etc.)
- [ ] Add hamburger menu entries for all 4 visibility toggles
- [ ] Sync saved settings to renderer on init (`useEditorInit.ts`)
- [ ] Tests: spawn zone coverage, spawn counts, overlay toggle

## Phase 3: Creature Brushes & Placement
- [ ] Implement `MonsterBrush` (place monster, duplicate check, PZ block)
- [ ] Implement `NpcBrush` (place NPC, replaces existing)
- [ ] Implement `SpawnMonsterBrush` (create spawn zone with radius)
- [ ] Implement `SpawnNpcBrush` (create NPC spawn zone)
- [ ] Extend `BrushSelection` type with `creature` and `spawn` modes
- [ ] Implement creature tool (`src/hooks/tools/creatureTool.ts`)
- [ ] Add auto-create spawn setting
- [ ] Integrate creature mutations into `MapMutator` (undo/redo)
- [ ] Update `hoverHandler.ts` for creature tool cursor
- [ ] Update `useEditorTools.ts` with creature tool handlers
- [ ] Update `Toolbar.tsx` tool definitions
- [ ] Tests: creature placement, spawn zone creation, undo/redo

## Phase 4: Creature Rendering
- [ ] Implement outfit sprite resolution from appearances data
- [ ] Render creature sprites on tiles (idle frame, direction-aware)
- [ ] Integrate creature rendering into `TileRenderer`
- [ ] Respect `showMonsters` and `showNpcs` visibility settings
- [ ] Tests: creature sprite resolution, render with visibility toggles

## Phase 5: Creature Palette UI
- [ ] Create `CreaturePalette` component
- [ ] Monster tab with creature list + outfit sprite preview
- [ ] NPC tab with creature list + outfit sprite preview
- [ ] Search/filter by name
- [ ] Tileset category dropdown
- [ ] Mode toggle: "Place Creature" vs "Place Spawn Zone"
- [ ] Spawn time spinner
- [ ] Spawn radius spinner (spawn mode)
- [ ] Weight spinner (monster mode)
- [ ] Integrate into `App.tsx` state management
- [ ] Add `showCreaturePalette` to EditorSettings
- [ ] Add palette toggle to hamburger menu
- [ ] `useToolAutoToggle` for creature/spawn tools

## Phase 6: Selection & Interaction
- [ ] Select tool: click to select creature on tile
- [ ] Select tool: drag to move creature
- [ ] Creature properties modal (direction, spawn time, weight)
- [ ] Spawn zone properties modal (radius)
- [ ] Context menu entries for creatures (delete, properties, rotate)
- [ ] Inspector integration (show creatures on tile)
- [ ] Erase tool: remove creatures

## Phase 7: Serialization (Write & Standalone Import/Export)
- [ ] Write `*-monster.xml` on OTBM save
- [ ] Write `*-npc.xml` on OTBM save
- [ ] Import standalone spawn XML files
- [ ] Export standalone spawn XML files
- [ ] Hamburger menu entries for spawn import/export
- [ ] Tests: round-trip serialization, XML format compatibility

## Phase 8: Polish & Testing
- [ ] Edge case: orphan creatures (outside any spawn zone)
- [ ] Edge case: overlapping spawn zones (multiple spawn counts)
- [ ] Edge case: auto-create spawn when placing creature without coverage
- [ ] Performance: large spawn zones (radius 15+ covering many tiles)
- [ ] Keyboard shortcuts for 4 visibility toggles
- [ ] Comprehensive integration tests
- [ ] Manual QA pass with RME-exported maps

---

## Status Legend
- [ ] Not started
- [x] Complete
- [~] In progress
