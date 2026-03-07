# Map I/O Architecture — Research

## Current State

- OTBM path is **hardcoded** to `/canary.otbm` in `src/lib/otbm.ts` (line 442), served from `tibia-versions/15.00/`
- Sidecar file names (houses, spawns) are **parsed from OTBM header** (`OTBM_ATTR_SPAWN_FILE`, `OTBM_ATTR_HOUSE_FILE`) but never loaded
- **No save/serialize** — editor is read-only (`serializeOtbm()` does not exist)
- Editor assets (appearances, sprites, brushes, tilesets) are **not map-specific** — same regardless of mode

### Current Init Pipeline

```mermaid
flowchart TD
    A[App.tsx init] --> B[loadAssets]
    B --> B1[PixiJS App init]
    B1 --> B2[Sprite catalog]
    B2 --> B3[Appearances protobuf]
    B3 --> B4[Item registry - items.xml]
    B4 --> B5[Brush data - XML]
    B5 --> B6[Tilesets - XML]
    B6 --> B7["OTBM parse (hardcoded /canary.otbm)"]
    B7 --> B8[setupEditor]
    B8 --> C[MapRenderer + MapMutator]
```

Step weights: `[2, 15, 3, 12, 8, 3, 50, 5]` — OTBM is 50% of total work.

### Key Files

| File | Role |
|------|------|
| `src/lib/initPipeline.ts` | Orchestrates all asset loading |
| `src/lib/setupEditor.ts` | Creates MapRenderer + MapMutator |
| `src/lib/otbm.ts` | OTBM binary parser (no serializer) |
| `src/App.tsx` | Root component, triggers init |
| `vite.config.ts` | Serves `tibia-versions/15.00/` as publicDir |

### OTBM Parser Exports (parse only)

- `loadOtbm(url?, onProgress?, onStatus?)` — async fetch + parse with progress
- `parseOtbm(raw: Uint8Array)` — synchronous parse (used in tests)
- `deepCloneItem(item)` — utility
- Data interfaces: `OtbmMap`, `OtbmTile`, `OtbmItem`, `OtbmTown`, `OtbmWaypoint`

### Sidecar Files Stored in OTBM Header

| Attribute | Field | Status |
|-----------|-------|--------|
| `OTBM_ATTR_SPAWN_FILE` | `map.spawnFile` | Parsed, not loaded |
| `OTBM_ATTR_HOUSE_FILE` | `map.houseFile` | Parsed, not loaded |
| `OTBM_ATTR_EXT_ZONE_FILE` (24) | Not implemented | See ZONES_RESEARCH.md |

## Target Architecture

Docker image bundling the static frontend + a lightweight Node server. OTS creators provide client assets and map files via volume mounts. A single build artifact — mode detection is not needed in the initial implementation.

### Storage Interface

Even though we start with server-only, defining an interface keeps the door open for a future browser mode without refactoring.

```mermaid
classDiagram
    class MapStorageProvider {
        <<interface>>
        +loadMap() MapBundle
        +saveMap(MapBundle) void
    }

    class MapBundle {
        +otbm: Uint8Array
        +sidecars: Map~string, string~
        +filename: string
    }

    class ServerStorageProvider {
        +loadMap() MapBundle
        +saveMap(MapBundle) void
    }

    MapStorageProvider <|.. ServerStorageProvider
    MapStorageProvider --> MapBundle
```

### Deployment

```yaml
services:
  map-editor:
    image: tibia-map-viewer
    volumes:
      - ./data/world:/map        # OTBM + sidecars
      - ./data/client:/assets    # appearances.dat, catalog-content.json, .bmp.lzma sprite sheets
    ports:
      - "8080:8080"
```

- Entrypoint runs `convert-sprites.ts` to convert `.bmp.lzma` → PNG on container startup
- Server serves converted PNGs + frontend static files
- `GET /api/map` — returns OTBM binary + sidecars from mounted volume
- `POST /api/map` — saves changes back to volume

### Init Flow

```mermaid
flowchart TD
    A[App starts] --> B[ServerStorageProvider.loadMap]
    B --> C[MapBundle]
    C --> D[loadAssets - editor assets]
    D --> E["parseOtbm(bundle.otbm)"]
    E --> F[Parse sidecars - zones, houses, spawns]
    F --> G[setupEditor]
    G --> H[MapRenderer + MapMutator]

    H --> I{User saves}
    I --> J[serializeOtbm + sidecars]
    J --> K[POST /api/map]
```

## Implementation Order

1. **OTBM serializer** — `serializeOtbm()` (inverse of parser, doesn't exist yet)
2. **`MapStorageProvider` interface + `ServerStorageProvider`** — load/save via HTTP
3. **Node server** — Express/Fastify with `GET /api/map` and `POST /api/map`
4. **Refactor `initPipeline.ts`** — split editor asset loading from map loading, consume `MapBundle`
5. **Sidecar file parsing** — load zones/houses/spawns XMLs from bundle
6. **Dockerfile** — static frontend + server, entrypoint runs `convert-sprites.ts`

## Future: Browser Mode

A fully static deployment (GitHub Pages) using zip upload/download. Not planned for initial implementation but the `MapStorageProvider` interface supports it.

- Landing screen with "Open Map" button (file picker for `.zip`)
- Zip contains `.otbm` + sidecar XMLs; parse in-browser with `fflate`
- On save: serialize to zip, trigger browser download
- Asset sourcing: GitHub Action pulls from [dudantas/tibia-client](https://github.com/dudantas/tibia-client), runs `convert-sprites.ts`, includes PNGs in static build
- Would require a `BrowserZipProvider` implementing `MapStorageProvider`
- Mode detection via `window.__MAP_EDITOR_CONFIG__` (present = server, absent = browser)
