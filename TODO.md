# Editor Features TODO

Features modeled after Remere's Map Editor (RME). Grouped by priority tier.

---

## Tier 1 — Essential Editing UX

### Right-Click Context Menu
Popup menu on right-click with: browse tile, delete item, copy/paste, rotate, copy position/ID, goto teleport destination.
- **RME ref**: `vendor/remeres-map-editor/source/map_display.h` (`MapPopupMenu` class, line ~199)
- **RME ref**: `vendor/remeres-map-editor/source/map_display.cpp` (right-click handlers)

### Browse Tile Window
Modal/panel showing all items on a tile in stack order. Reorder items (move up/down), delete individual items, view properties.
- **RME ref**: `vendor/remeres-map-editor/source/browse_tile_window.h`
- **RME ref**: `vendor/remeres-map-editor/source/browse_tile_window.cpp`

### Item Properties Editing
Edit item attributes: action ID, unique ID, teleport destination (X/Y/Z), door ID, depot ID, text/description, count, charges, duration.
- **RME ref**: `vendor/remeres-map-editor/source/properties_window.h`
- **RME ref**: `vendor/remeres-map-editor/source/properties_window.cpp`

### Goto Position Dialog
Jump to any X, Y, Z coordinate on the map.
- **RME ref**: `vendor/remeres-map-editor/source/common_windows.h` (`GotoPositionDialog`, line ~273)
- **RME ref**: `vendor/remeres-map-editor/source/common_windows.cpp`

### Brush Size
Paint with variable-size brushes (1x1, 3x3, 5x5, etc.). Square and circle shapes.
- **RME ref**: `vendor/remeres-map-editor/source/brush.h` (Brush class size handling)
- **RME ref**: `vendor/remeres-map-editor/source/palette_brushlist.h` (brush size UI)

---

## Tier 2 — Smart Brushes

### Ground Brush with Auto-Borders
When placing ground tiles, automatically generate border transitions between terrain types.
- **RME ref**: `vendor/remeres-map-editor/source/ground_brush.h`
- **RME ref**: `vendor/remeres-map-editor/source/ground_brush.cpp` (`GroundBrush::doBorders()`)
- **RME ref**: `vendor/remeres-map-editor/source/brush.h` (`AutoBorder` struct, line ~443)

### Wall Brush with Auto-Alignment
Walls auto-detect neighbors and orient correctly (poles, ends, corners, T-junctions, intersections, diagonals).
- **RME ref**: `vendor/remeres-map-editor/source/wall_brush.h` (`WallBrush`, `WallNode`)
- **RME ref**: `vendor/remeres-map-editor/source/wall_brush.cpp` (`WallBrush::doWalls()`)

### Door Brush
Place doors with proper alignment to walls. Switch door states (open/closed). 8 door types (archway, normal, locked, quest, magic, window, hatch).
- **RME ref**: `vendor/remeres-map-editor/source/brush.h` (`DoorBrush`, line ~357)
- **RME ref**: `vendor/remeres-map-editor/source/brush.cpp` (`DoorBrush::switchDoor()`)

### Carpet & Table Brush
Auto-aligning carpet edges and table segments based on neighbor tiles.
- **RME ref**: `vendor/remeres-map-editor/source/carpet_brush.h` / `.cpp` (`CarpetBrush::doCarpets()`)
- **RME ref**: `vendor/remeres-map-editor/source/table_brush.h` / `.cpp` (`TableBrush::doTables()`)

### Doodad Brush (Multi-Item Placement)
Complex brushes that place multiple items with variations/alternatives. Supports composite multi-tile doodads.
- **RME ref**: `vendor/remeres-map-editor/source/doodad_brush.h`
- **RME ref**: `vendor/remeres-map-editor/source/doodad_brush.cpp`

### Tileset Definitions
Data-driven tileset system that defines which items belong to which brush categories.
- **RME ref**: `vendor/remeres-map-editor/source/tileset.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/tileset_window.h` / `.cpp`

---

## Tier 3 — Map Operations

### Find & Replace Items
Search items by ID, name, type, or properties across entire map or selection. Bulk replace item IDs.
- **RME ref**: `vendor/remeres-map-editor/source/find_item_window.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/replace_items_window.h` / `.cpp`

### Flood Fill
Fill contiguous matching ground area with a different ground type.
- **RME ref**: `vendor/remeres-map-editor/source/map_display.h` (`floodFill()`, line ~132)
- **RME ref**: `vendor/remeres-map-editor/source/map_display.cpp`

### Borderize Selection
Apply auto-borders to all terrain in current selection.
- **RME ref**: `vendor/remeres-map-editor/source/ground_brush.cpp` (`GroundBrush::doBorders()`)

### Randomize Selection
Randomize ground tile variations within selection.
- **RME ref**: `vendor/remeres-map-editor/source/ground_brush.h` (variation system)

### Map Cleanup
Remove invalid items, duplicate items, corpses, unreachable tiles, empty spawns, walls-on-walls.
- **RME ref**: `vendor/remeres-map-editor/source/main_menubar.cpp` (cleanup handlers)

---

## Tier 4 — Item Manipulation

### Drag & Drop Items Between Tiles
Pick up items from one tile and drop on another (move operation).
- **RME ref**: `vendor/remeres-map-editor/source/map_display.h` (`dragging`, `drag_start_x/y/z`)
- **RME ref**: `vendor/remeres-map-editor/source/map_display.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/copybuffer.h` / `.cpp`

### Rotate Item
Cycle through item rotation states.
- **RME ref**: `vendor/remeres-map-editor/source/map_display.cpp` (`OnRotateItem()`, line ~79)
- **RME ref**: `vendor/remeres-map-editor/source/item.h` / `.cpp`

### Switch Door State
Toggle doors between open/closed states.
- **RME ref**: `vendor/remeres-map-editor/source/map_display.cpp` (`OnSwitchDoor()`, line ~80)
- **RME ref**: `vendor/remeres-map-editor/source/brush.cpp` (`DoorBrush::switchDoor()`)

---

## Tier 5 — Specialized Content

### Flag Brush (Zone Flags)
Draw protection zones (PZ), PvP zones, no-logout zones on tiles.
- **RME ref**: `vendor/remeres-map-editor/source/brush.h` (`FlagBrush`, line ~328)
- **RME ref**: `vendor/remeres-map-editor/source/zone_brush.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/palette_zones.h` / `.cpp`

### House Management
Mark tiles as house tiles, set house IDs, place house exits.
- **RME ref**: `vendor/remeres-map-editor/source/house_brush.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/house_exit_brush.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/house.h` / `.cpp`

### Monster & NPC Spawns
Place individual monsters/NPCs and define spawn areas with radius.
- **RME ref**: `vendor/remeres-map-editor/source/monster_brush.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/npc_brush.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/spawn_monster_brush.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/spawn_npc_brush.h` / `.cpp`

### Waypoint Management
Create and edit named waypoints on the map.
- **RME ref**: `vendor/remeres-map-editor/source/brush.h` (Waypoint brush)

---

## Tier 6 — View & Overlays

### Minimap Window
Overview map showing the entire map at small scale, click to navigate.
- **RME ref**: `vendor/remeres-map-editor/source/minimap_window.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/iominimap.h` / `.cpp`

### Map Statistics
Display tile count, item count, creature count, floor distribution, etc.
- **RME ref**: `vendor/remeres-map-editor/source/main_menubar.cpp` (`OnMapStatistics()`)

### Display Overlays
Toggle visibility of: monsters, spawns, NPCs, zones, houses, waypoints, wall hooks, pickupables, moveables.
- **RME ref**: `vendor/remeres-map-editor/source/map_drawer.h` / `.cpp`

### Grid Overlay
Show tile grid lines over the map.
- **RME ref**: `vendor/remeres-map-editor/source/map_drawer.cpp`

### Action History Window
Visual undo/redo stack with action descriptions and icons.
- **RME ref**: `vendor/remeres-map-editor/source/actions_history_window.h` / `.cpp`
- **RME ref**: `vendor/remeres-map-editor/source/action.h` / `.cpp`

---

## Tier 7 — Advanced

### Eraser Brush (Selective)
RME's eraser removes items by type (ground only, walls only, all non-ground, etc.).
- **RME ref**: `vendor/remeres-map-editor/source/brush.h` (`EraserBrush`)

### Live Collaborative Editing
Start/join a live editing server, broadcast changes to connected clients.
- **RME ref**: `vendor/remeres-map-editor/source/live_*.h` / `.cpp`
