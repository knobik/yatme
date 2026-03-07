# Zone System — RME Research

## RME Zone Architecture

### Data Model

#### Zone Registry (`Zones` class — per-map)
- `std::map<string, unsigned int> zones` — maps zone name to zone ID
- `std::unordered_set<unsigned int> used_ids` — tracks assigned IDs
- Auto-generates IDs starting from 1 (incrementing until unused found)
- Operations: `addZone(name)`, `addZone(name, id)`, `removeZone(name)`, `hasZone(name/id)`, `getZoneID(name)`
- Each `Map` owns a `Zones` object (`map.zones`)
- Zone ID `0` is invalid/ignored

#### Tile Storage
- Each tile has `std::set<unsigned int> zones` — a tile can belong to **multiple zones**
- Methods: `addZone(id)`, `removeZone(id)`, `hasZone(id)`, `removeZones()`, `hasZone()` (any)

### Brush — `ZoneBrush`
- Extends `FlagBrush` (same base as PZ/noPVP/noLogout flag brushes)
- Holds a single `zoneId` set via `setZone(id)`
- `draw()`: `tile->addZone(zoneId)` — only if tile has ground
- `undraw()`: `tile->removeZone(zoneId)`
- `canDraw()`: tile must exist and zoneId != 0
- Single shared `ZoneBrush` instance — palette sets which zone ID it paints

### OTBM Serialization (two-part storage)

#### 1. Zone Definitions — separate XML file (`mapname-zones.xml`)
- Referenced from OTBM header via `OTBM_ATTR_EXT_ZONE_FILE` (attribute ID `24`)
- Filename is read from header; if loading fails, falls back to `<mapname>-zones.xml`
- File is loaded from the same directory as the `.otbm` file
- XML format:
  ```xml
  <zones>
    <zone name="spawn_area" zoneid="1"/>
    <zone name="boss_room" zoneid="2"/>
  </zones>
  ```

#### 2. Per-tile Zone Assignments — inline in OTBM tile nodes
- Node type: `OTBM_TILE_ZONE` (node ID `19`)
- Binary format: `u16 zone_count`, then `u16 zone_id` repeated
- Written as child node of tile, only when `tile.zones` is non-empty

### Rendering / Visualization
- Zones rendered as **color tinting** on tiles (no separate sprites)
- Two code paths in `map_drawer.cpp`:
  - **Simple path** (~line 480): active zone tint `r = r / 3 * 2; b = b / 3 * 2`
  - **Detailed path** (~line 1551): two cases:
    - **Active zone** (matches selected zone brush): `b /= 1.3; r /= 1.5; g /= 2`
    - **Inactive zones** (tile has other zones or multiple): `r /= 1.4; g /= 1.6; b /= 1.3`
- Only shown when `show_special_tiles` option is enabled

### Zone Lifecycle Operations
- `Map::cleanDeletedZones()` — iterates all tiles, removes zone IDs no longer in registry
- `Map::getZonePosition(zoneId)` — finds first tile with that zone (for "go to" navigation)

### UI — Zone Palette
- List of zones with inline label editing (rename)
- **Add**: creates zone with empty name, opens label editor
- **Remove**: removes zone definition + calls `cleanDeletedZones()` on all tiles
- **Import/Export**: XML files containing zone definitions + all tile positions
  - Export format uses `id` attribute (vs `zoneid` in the OTBM sidecar zones.xml)
  - Includes `<position x="..." y="..." z="..."/>` children per zone
- **Right-click**: navigates camera to first tile in that zone
- Only available for OTBM version 3+

### Key RME Source Files
- `vendor/remeres-map-editor/source/zones.h` / `zones.cpp` — Zone registry
- `vendor/remeres-map-editor/source/zone_brush.h` / `zone_brush.cpp` — Zone painting brush
- `vendor/remeres-map-editor/source/palette_zones.h` / `palette_zones.cpp` — Zone palette UI
- `vendor/remeres-map-editor/source/iomap_otbm.cpp` — OTBM read/write (zone parts)
- `vendor/remeres-map-editor/source/map_drawer.cpp` — Zone visualization (color tinting)
- `vendor/remeres-map-editor/source/tile.h` — Tile zone storage (`std::set<unsigned int> zones`)
- `vendor/remeres-map-editor/source/map.cpp` — `cleanDeletedZones()`, `getZonePosition()`

