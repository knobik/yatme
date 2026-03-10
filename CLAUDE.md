# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based Tibia map editor targeting Tibia 15.00+ (protobuf data format). Built with React 19, PixiJS 8, TypeScript, Vite, and Tailwind CSS 4. Renders and edits OTBM map files using sprite data from the Tibia client.

## Commands

- **Dev server**: `npm run dev` (Vite dev server, serves `data/` and `tibia/` as public)
- **Build**: `npm run build` (runs `tsc -b && vite build`)
- **Lint**: `npm run lint` (ESLint)
- **Protobuf codegen**: `npm run proto` (requires Docker — generates `src/proto/appearances.ts`)
- **Test**: `npm test` (Vitest, runs all `src/**/*.test.ts` files)
- **Test watch**: `npm run test:watch` (Vitest in watch mode)
- **Test single file**: `npx vitest run src/lib/Camera.test.ts`
- **Test coverage**: `npm run test:coverage` (uses `@vitest/coverage-v8`)

## Architecture

### Data Pipeline
```
OTBM map file -> appearances.dat (protobuf) -> catalog-content.json -> sprite sheets (.bmp.lzma) -> items.xml
```
Key: Server ID = Client ID in v15.00+ (no `items.otb` mapping needed).

### Init Flow (`src/lib/initPipeline.ts` -> `src/lib/setupEditor.ts`)
`loadAssets()` orchestrates startup: PixiJS app init -> sprite catalog -> appearances -> items.xml -> brush/material XML -> tilesets -> OTBM map parse. Returns `InitResult` consumed by `setupEditor()` which creates the `MapRenderer` and `MapMutator`. Initial camera position: first town's temple → map center (width/2, height/2) for loaded OTBM without towns → 1024/1024/7 for new empty maps.

### Core Classes (`src/lib/`)
- **MapRenderer** — PixiJS rendering engine. Manages Camera, ChunkManager, FloorManager, TileRenderer, SelectionOverlay, LightEngine. Handles multi-floor rendering with diagonal offset (RME-style).
- **MapMutator** — All map mutations (place/remove items, undo/redo, copy/paste, fill, border/randomize). Classifies items into draw layers: ground, bottom, common, top.
- **Camera** — Viewport position, zoom, floor navigation.
- **ChunkManager** — Spatial index for tiles grouped into chunks for efficient rendering.
- **TileRenderer** — Renders individual tiles using sprite data from TextureManager/SpriteResolver.
- **FloorManager** — Multi-floor visibility and transparency.
- **otbm.ts** — Binary OTBM parser/serializer.
- **appearances.ts** — Protobuf appearance data loader.
- **items.ts** — Item registry from items.xml.

### Brush System (`src/lib/brushes/`)
XML-based brush definitions loaded from `data/materials/`. Types: ground brushes (with borders), wall brushes, carpet/table brushes, doodad brushes. `BrushRegistry` is the central lookup. Border/wall/carpet systems handle auto-tiling.

### Tools (`src/hooks/tools/`)
Editor tools: `selectTool`, `drawTool`, `eraseTool`, `fillTool`, `doorTool`. Each implements pointer event handlers. Managed by `useEditorTools` hook.

### UI (`src/components/`)
- **App.tsx** — Root component, manages all state and panel visibility.
- **Toolbar.tsx** — Top toolbar with tool buttons and hamburger menu.
- **HamburgerMenu.tsx** — Main menu with all operations and keyboard shortcuts.
- **Inspector** — Tile item inspector panel.
- **BrushPalette / ItemPalette** — Brush and raw item selection panels.
- **FindItemDialog / ReplaceItemsDialog** — Search and replace across map.

### Data Files
- `tibia/` — Client assets (appearances.dat, catalog-content.json, sprite sheets). Served as Vite publicDir.
- `data/materials/` — Brush/tileset XML definitions (borders, brushes, tilesets).
- `data/items.xml` — Item names and properties.

### Vendor References
- `vendor/otclient` — C++ reference for protobuf/sprite/OTBM parsing
- `vendor/remeres-map-editor` — C++ reference for editor UX, brush systems, OTBM I/O
- `vendor/canary` — Server-side item handling, map data

## Testing Notes
- Always write tests for new features and changes
- Write tests that test behaviors, not implementation details
- Use AAA (Arrange, Act, Assert) pattern for writing tests
- `src/proto/appearances.ts` is generated from a proto file — do not write tests for it
- `src/lib/appearances.ts` is thin glue (fetch + decode + build maps) — does not need unit tests

## Tibia Z-Axis Convention
**Lower Z = higher elevation**: Z=0 is sky, Z=7 is ground level, Z=8-15 is underground. "Upper floors" have lower Z numbers.

## Item Rendering Order
Uses RME convention: items render in forward array order (last item drawn on top). This differs from OTClient which reverses common items. OTBM export will need order translation.

## UI Design Principles — "Dark Forge"

A precision instrument shell. Dark steel frame, warm amber highlights.
The map viewport is king — UI stays compact and out of the way.

1. **Content-first** — maximize viewport, minimize chrome. No unnecessary panels or decorations.
2. **Information-dense** — pack data tight with clear hierarchy. Use label/value pattern (uppercase condensed labels, monospace values).
3. **Warm on cold** — amber/gold accents (`#d4a549`) on cool dark surfaces. Evokes torchlight on stone — ties to Tibia's fantasy theme.
4. **Crisp precision** — small radii (3-7px), pixel-aligned edges. No bubbly soft rounding. This is a tool, not a toy.
5. **Layered depth** — frosted glass panels (`backdrop-filter: blur`), subtle shadows, elevation through opacity. Panels let the map bleed through.

### Typography
- **UI text**: Barlow (400/500/600/700)
- **Labels**: Barlow Condensed, uppercase, wide tracking, tertiary color
- **Data values**: JetBrains Mono, primary color
- **Accent values**: JetBrains Mono, `--accent-text` color
- Base size: 12px. Keep UI text small and dense.

### Color Palette
- Backgrounds: `--bg-void` (#07070a) through `--bg-active` (#26262f)
- Glass panels: `--glass-bg` (rgba 82% opacity) with 12px blur
- Text: `--text-primary` (#e4e2de), `--text-secondary` (#908d85), `--text-tertiary` (#5c5a54)
- Accent: `--accent` (#d4a549) — warm amber/gold
- Semantic: `--danger` (#c44040), `--success` (#4a9e6a), `--info` (#5b9fd4)

### Component Patterns
- Use `.panel` class for overlay containers (frosted glass)
- Use `.btn` / `.btn-icon` for buttons
- Use `.label` + `.value` for data display
- Use `.separator` / `.separator-v` for visual dividers
- Use `.kbd` for keyboard shortcut hints

### Design system file
All CSS variables and base classes: `src/styles/theme.css`

## UI Conventions

- All tools, views, and map operations must have entries in the **hamburger menu** (`src/components/Toolbar.tsx` -> `menuSections`) — not just keyboard shortcuts or context menu items.

## Code Style

- Don't copy code — if you need to write it twice, extract it into a shared utility, hook, or component.

## Workflow

- When working on plans, track progress using the task tool (TaskCreate/TaskUpdate).

## Documentation Conventions

- When writing diagrams in Markdown files, always use Mermaid syntax (```mermaid code blocks).

## Active Feature: Creature System

**PRD**: `docs/PRD-creatures.md` — Full requirements for monsters, NPCs, spawn zones.
**Progress**: `docs/PROGRESS-creatures.md` — Task-level checklist with 17 phases and dependency graph.

**Current phase**: Phase 11 (Creature Palette UI)

When resuming work on the creature system:
1. Read `docs/PROGRESS-creatures.md` to find the current phase and next unchecked task.
2. Read the PRD section relevant to that phase for full context.
3. After completing a phase, update the progress file (check off tasks) and bump "Current phase" here.
4. New creature code goes in `src/lib/creatures/` unless modifying existing files.
