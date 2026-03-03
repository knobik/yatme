# Tibia Map Editor (Browser)

A modern, browser-based Tibia map editor inspired by Remere's Map Editor.

## Target

- **Tibia 15.00+** (protobuf-based data format)
- Modern web stack (browser-native)

---

## Data Pipeline

```
OTBM map file
    │
    ├── tile positions (x, y, z)
    ├── item IDs per tile
    │
    ▼
appearances.dat (protobuf)
    │
    ├── item/outfit/effect/missile definitions
    ├── flags (walkable, stackable, container, light, elevation, automap color, etc.)
    ├── sprite IDs (references into sprite sheets)
    ├── animation data (frames, duration, loop type)
    ├── pattern info (width, height, depth, layers)
    │
    ▼
catalog-content.json
    │
    ├── maps sprite ID ranges → sheet files
    ├── sprite type (32x32, 64x64, etc.)
    │
    ▼
sprite sheets (.bmp.lzma)
    │
    └── actual pixel data, LZMA-compressed BMP images

items.xml ──► item names, types, and additional properties
```

### Key simplification in v15.00+
Server ID = Client ID. No `items.otb` mapping layer needed. Item IDs in OTBM files directly correspond to IDs in `appearances.dat`.

---

## File Formats

### OTBM (map)
Binary tree format containing the map structure:
- Map header (version, dimensions, description)
- Tile areas grouped by 256x256 regions
- Each tile: position + list of items with attributes
- Waypoints, towns, zones (OTBM v3+)

Reference parsers:
- `vendor/otclient/src/client/mapio.cpp`
- `vendor/remeres-map-editor/source/iomap_otbm.cpp`

### appearances.dat (protobuf)
Protobuf-serialized `Appearances` message containing all visual object definitions.

Proto definition: `tibia-versions/15.00/appearances.proto`

Categories:
| Field | Content |
|---|---|
| `object` | Items (ground, equipment, decorations, etc.) |
| `outfit` | Creature outfits |
| `effect` | Magic/visual effects |
| `missile` | Projectiles |

Each `Appearance` contains:
- `id` — item/outfit/effect ID
- `frame_group[]` — sprite composition (idle, moving, initial)
- `flags` — behavioral properties (see proto for full list)

### catalog-content.json
JSON manifest mapping sprite ID ranges to sheet files:
```json
{"type": "sprite", "file": "sprites-0-1000.bmp.lzma", "spritetype": 1, "firstspriteid": 0, "lastspriteid": 1000}
{"type": "appearances", "file": "appearances.dat"}
```

### Sprite sheets (.bmp.lzma)
LZMA-compressed BMP images. Each sheet is a grid of sprites:
- `spritetype 1` = 32x32 sprites
- `spritetype 2` = 64x64 sprites
- Sprites are laid out in a grid within the sheet

### items.xml
XML file with item names and server-side properties:
```xml
<item id="100" name="void"/>
<item id="102" article="a" name="white flower">
    <attribute key="primarytype" value="quest items"/>
</item>
```

---

## Available Data (`tibia-versions/15.00/`)

| File | Status | Source |
|---|---|---|
| `appearances.proto` | Ready | `vendor/otclient/src/protobuf/appearances.proto` |
| `appearances.dat` | Ready | Tibia 15.00 client (4.8MB) |
| `canary.otbm` | Ready | `vendor/canary/data-canary/world/canary.otbm` (19MB) |
| `items.xml` | Ready | `vendor/canary/data/items/items.xml` (84k lines) |
| `catalog-content.json` | Ready | Tibia 15.00 client |
| Sprite sheets (`.bmp.lzma`) | Ready | Tibia 15.00 client (4,879 files) |

---

## Reference Implementations

| Project | Language | Useful for |
|---|---|---|
| **OTClient** (`vendor/otclient`) | C++ | Protobuf parsing, sprite sheet loading, OTBM read/write, legacy format support |
| **Remere's Map Editor** (`vendor/remeres-map-editor`) | C++ | OTBM read/write, OTB parsing, protobuf loading, editor UX patterns |
| **Canary** (`vendor/canary`) | C++ | Server-side item handling, map loading |

