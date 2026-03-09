# Monster System TODO

> **Progress: 4/16 tasks complete (25%)**
>
> | Section                      | Done | Total |
> |------------------------------|------|-------|
> | Creature Database & Palette  | 4    | 4     |
> | Creature Rendering on Map    | 0    | 2     |
> | Spawn Area Tool              | 0    | 3     |
> | Placement Validation         | 0    | 3     |
> | NPC Support                  | 0    | 3     |
> | Weight System                | 0    | 1     |

## Creature Database & Palette
- [x] Load creature definitions from XML (monster names, looktype/outfit data) into a `CreatureDatabase` registry
- [x] Replace the text input in `MonsterPalette` with a searchable/browsable creature list (similar to `BrushPalette`/`ItemPalette`)
- [x] Show creature outfit preview in the palette list entries
- [x] Validate creature names against the database when placing

## Creature Rendering on Map
- [ ] Render creature outfit sprites on their tiles (using looktype from creature database) instead of just colored dots
- [ ] Show creature facing direction visually on the sprite

## Spawn Area Tool
- [ ] Add explicit spawn area creation brush (separate from placing individual creatures)
- [ ] Allow user to set spawn radius when creating (not just auto-radius 5)
- [ ] Visualize spawn center marker on the map (distinct from creature positions)

## Placement Validation
- [ ] Check tile has ground before allowing creature placement
- [ ] Check tile isn't blocking before allowing creature placement
- [ ] Respect Protection Zone — prevent monster placement in PZ tiles

## NPC Support
- [ ] Separate NPC database and palette from monsters
- [ ] Enforce one-NPC-per-tile limit (matching RME behavior)
- [ ] Separate NPC spawn areas from monster spawn areas

## Weight System
- [ ] Add weight field to creature placement UI
- [ ] Support weight in spawn probability display/editing
