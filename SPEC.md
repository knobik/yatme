# Tibia Map Editor (Browser) — Spec

## Stack
- TypeScript + React + PixiJS + Vite + npm
- ts-proto (via Docker namely/protoc-all) — generate TypeScript types from .proto files
- protobufjs — runtime dependency for generated proto code

## Data files
All in `tibia-versions/15.00/` — see `PROJECT.md` for details.

## Phases

### Phase 1 — Project scaffolding
Set up Vite + React + TypeScript project, install core deps.

### Phase 2 — Appearances loader
Decode `appearances.dat` using `appearances.proto`. Build item/outfit/effect lookup.

### Phase 3 — Sprite sheet loader
Build script (`scripts/convert-sprites.ts`) pre-converts `.bmp.lzma` → PNG. Browser loads PNGs, extracts sprites from 384x384 grids.

### Phase 4 — OTBM parser
Parse binary OTBM map format into tile grid with item stacks.

### Phase 5 — Map renderer
PixiJS viewport rendering tiles with sprites, pan/zoom, floor switching.

### Phase 6 — Items.xml + UI
Item names, inspector panel, item palette, search.

### Phase 7 — Editor tools
Place/remove items, selection, copy/paste, undo/redo.

### Phase 8 — Save/Export
Serialize map back to OTBM, file download.

## References
- OTBM format: `vendor/otclient/src/client/mapio.cpp`, `vendor/remeres-map-editor/source/iomap_otbm.cpp`
- Appearances: `vendor/otclient/src/client/thingtypemanager.cpp`
- Sprites: `vendor/otclient/src/client/spriteappearances.cpp`
- Proto: `tibia-versions/15.00/appearances.proto`
