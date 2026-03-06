# Test Plan — Tibia Map Viewer

## Recommended Stack

**Vitest** — native ESM, TypeScript-first, same API as Jest, fast HMR. Add **React Testing Library** later for component tests.

---

## Tier 1: Pure Functions (No mocks needed)

These are the lowest-effort, highest-confidence tests. Start here.

| Module | What to test | ~Cases |
|--------|-------------|--------|
| `position.ts` | `parsePositionString()` — 3 input formats (`{x=…}`, `{x: …}`, CSV), invalid inputs, edge cases | 10 |
| `BorderTable.ts` | `unpackDirections()` — bit unpacking correctness | 8 |
| `SpriteResolver.ts` | `getSpriteIndex()` — animation phases, pattern coords, layer combos | 12 |
| `SpriteResolver.ts` | `getItemSpriteId()` — pattern selection by tile position, animation | 10 |
| `SpriteResolver.ts` | `getAnimationPhase()` — PINGPONG vs INFINITE loops, elapsed time edge cases | 6 |
| `useSelection.ts` (pure fns) | `toggleItemInSelection()`, `selectAllItemsOnTiles()`, `mergeItemSelections()`, `deriveHighlights()` | 15 |
| `EditorSettings.ts` | `loadSettings()` / `saveSettings()` round-trip, `importSettings()` / `exportSettings()` — note: `mergeWithDefaults()` is private, test through public API | 8 |
| `otbm.ts` | `deepCloneItem()` — deep equality, no reference sharing | 5 |
| `MapMutator.ts` | `classifyItem()` — draw layer classification (ground, bottom, common, top) | 6 |
| `ChunkManager.ts` | `chunkKeyStr()`, `chunkKeyForTile()`, `buildChunkIndex()` — coordinate-to-key mapping, spatial index construction | 8 |
| `sprites.ts` | `findSheet()` — binary search mapping spriteId to sheet info | 4 |
| `tools/types.ts` | `getTilesInBrush()` — square/circle brush footprint geometry (pure, no ToolContext needed) | 5 |

**~97 test cases, no dependencies**

---

## Tier 2: Stateful Classes (Lightweight mock data)

| Module | What to test | ~Cases |
|--------|-------------|--------|
| `Camera.ts` | Zoom levels, floor changes, `getFloorOffset()`, `centerOn()`, viewport bounds | 20 |
| `MapMutator.ts` | `addItem()`/`removeItem()` layer classification, undo/redo batching, `paintGround()` ground replacement, batch `beginBatch()`/`commitBatch()` | 25 |
| `CopyBuffer.ts` | Class: copy selected items, paste with offset, serialize/deserialize round-trip, cut (remove source). Standalone: `removeSelectedItems()` | 18 |
| `BrushRegistry.ts` | Lookup by name/ID, friend/enemy resolution, fallback behavior | 12 |
| `renderTileItems.ts` | `renderTileItems()` — sprite positioning math, elevation accumulation | 5 |

**~80 test cases, need mock `OtbmMap` / `AppearanceData` fixtures**

---

## Tier 3: Algorithms & Auto-tiling (Mock registry/mutator)

| Module | What to test | ~Cases |
|--------|-------------|--------|
| `fillTool.ts` | BFS flood fill — boundaries, same-item check, max size limit (`MAX_FILL_TILES=4096`), max radius (`MAX_FILL_RADIUS=64`), irregular shapes | 10 |
| `BorderSystem.ts` | `computeBorders()` — neighbor analysis, friend resolution, border block selection, tiledata bitmask, optional borders, diagonal decomposition. Note: `friendOf()` and `getBrushTo()` are private — test through `computeBorders()` | 20 |
| `WallSystem.ts` | `doWalls()` — cardinal neighbor bitmask, alignment picking, redirect chain walking. `getWallAlignment()` — wall item lookup | 15 |
| `CarpetSystem.ts` | `doCarpets()` / `doTables()` — 8-directional neighbor bitmask, alignment lookup. `getCarpetAlignment()` / `getTableAlignment()` | 10 |
| `DoorSystem.ts` | `findDoorForAlignment()` — door placement, orientation detection, redirect chain. `switchDoor()` — toggle open/closed state preservation | 10 |
| `mapSearch.ts` | `findItemsOnMap()` / `replaceItemsOnMap()` — scope filtering, nested item traversal, cancellation via AbortSignal, progress callbacks | 12 |

**~77 test cases, need mock tool contexts and brush data**

---

## Tier 4: Tool Handlers (Mock ToolContext)

| Module | What to test | ~Cases |
|--------|-------------|--------|
| `drawTool.ts` | Brush painting — single click, drag sequence, ground vs item brush | 8 |
| `eraseTool.ts` | Single item removal, drag erase | 6 |
| `selectTool.ts` | Click select, drag rectangle, shift-add, move selection | 15 |
| `doorTool.ts` | Door placement on valid/invalid tiles | 6 |
| `fillTool.ts` | `createFillHandlers()` — handler integration with ToolContext (algorithm tested in Tier 3) | 4 |
| `hoverHandler.ts` | Hover preview item creation | 4 |
| `types.ts` | `resolveBrush()` — brush type routing. Also: `brushBatchName()`, `applyBrushToTile()`, `getPreviewItemId()`, `getSelectionPreviewId()`, `getCopyBufferFootprint()` | 10 |
| `InputHandler.ts` | `setupMapInput()` — drag state machine, pan calculations, click-vs-drag detection, tile coordinate resolution | 10 |
| `useClipboard.ts` | Clipboard state management, paste preview lifecycle, undo integration | 8 |

**~71 test cases, need `ToolContext` mock with fake mutator/camera**

---

## Tier 5: Data Loaders (Mock fetch/XML)

| Module | What to test | ~Cases |
|--------|-------------|--------|
| `otbm.ts` | OTBM binary parse -> structured data (no serializer exists yet — round-trip test blocked until save is implemented) | 8 |
| `items.ts` | `loadItems()` with test XML snippet, `getItemDisplayName()` | 8 |
| `appearances.ts` | `loadAppearances()` — protobuf binary parse, appearance lookup | 6 |
| `BrushLoader.ts` | `parseGroundBrushesXml()` -> correct `GroundBrush` structure. `parseBordersXml()` -> border definitions. `sanitizeXml()` | 10 |
| `WallLoader.ts` | `parseWallBrushesXml()` -> correct wall parts | 6 |
| `CarpetLoader.ts` | `parseCarpetBrushesXml()` -> correct carpet alignments | 5 |
| `DoodadLoader.ts` | `parseDoodadBrushesXml()` -> correct doodad items/chances | 5 |
| `tilesets/TilesetLoader.ts` | `loadTilesets()` / `resolveTilesets()` / `findEntryInTilesets()` -> correct category/brush assignments | 8 |
| `fetchWithProgress.ts` | `fetchWithProgress()` / `fetchTextWithProgress()` — progress calculation, error handling | 4 |

**~60 test cases, need small test fixture files (XML snippets, binary blobs)**

---

## Tier 6: React Components (React Testing Library — later phase)

| Component | What to test | ~Cases |
|-----------|-------------|--------|
| `GoToPositionDialog` | Input validation, submit fires callback with parsed position | 6 |
| `FindItemDialog` | Search triggers callback, displays results | 5 |
| `ReplaceItemsDialog` | Replace flow, progress display | 5 |
| `Inspector` | Renders tile items, item selection, reorder/delete actions | 10 |
| `Toolbar` | Tool button state, active tool highlight | 8 |
| `HamburgerMenu` | Menu items render, keyboard shortcuts display | 5 |
| `BrushPalette` | Category filtering, brush selection callback | 8 |
| `ItemPalette` | Item search, raw item selection callback | 6 |
| `SettingsModal` | Setting toggles persist values | 6 |
| `ContextMenu` | Viewport boundary clamping, group rendering, disabled items, keyboard shortcuts | 8 |
| `ItemPicker` | Mode switching (search/type/properties), debounced search, property filtering | 12 |
| `ScopeSelector` | Map/selection toggle, disabled state when no selection | 4 |

**~83 test cases, need mock editor context providers**

---

## Tier 7: Integration / E2E (Playwright — future)

| Scenario | What to test |
|----------|-------------|
| Full init pipeline | Load map file -> renders tiles on canvas |
| Draw workflow | Select brush -> click map -> tile mutated -> renders |
| Undo/redo cycle | Paint -> undo -> verify state -> redo -> verify state |
| Copy/paste | Select -> copy -> move -> paste -> verify placement |
| Find/replace | Search item -> replace -> verify map updated |
| Floor navigation | Switch floors -> correct tiles visible |
| Save/load | Export OTBM -> re-import -> map matches |

**~7 scenarios, requires browser environment (Playwright)**

---

## Summary

| Tier | Category | Test Cases | Effort | Dependencies |
|------|----------|-----------|--------|--------------|
| 1 | Pure functions | ~97 | Low | None |
| 2 | Stateful classes | ~80 | Medium | Mock fixtures |
| 3 | Algorithms | ~77 | Medium | Mock registry |
| 4 | Tool handlers | ~71 | Medium | Mock context |
| 5 | Data loaders | ~60 | Medium | Test fixtures |
| 6 | React components | ~83 | High | RTL + mocks |
| 7 | E2E | ~7 | High | Playwright |
| **Total** | | **~475** | | |

Recommended order: Tiers 1-3 first (~254 cases) — they cover the core logic, need minimal infrastructure, and will catch the most bugs. Tiers 4-5 add tool and loader coverage. Tiers 6-7 are polish for later.
