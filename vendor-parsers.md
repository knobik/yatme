# Vendor Parsers & Data Formats

## No .otb files found
None of the vendor repos ship `.otb` files. They are expected to be provided externally.

## Binary data files present
- `vendor/canary/data/items/appearances.dat` — protobuf-based appearances (only vendor repo that ships this)

---

## OTClient (`vendor/otclient`)

### Supported Tibia versions
Client 7.40 ~ 15.11 (very broad range). Protobuf appearances used for 12.81+, legacy Tibia.dat/Tibia.spr for older versions.

### Parsers

#### Legacy format (Tibia.dat / Tibia.spr)
- **ThingTypeManager::loadDat()** — `src/client/thingtypemanager.cpp:73-110`
  - Reads signature (u32), content revision, category counts (u16 each for items/creatures/effects/missiles)
  - Items start at ID 100, others at ID 1
  - Calls `ThingType::unserialize()` for each entry (in `src/client/thingtype.cpp`)
- **SpriteManager::loadSpr() / loadRegularSpr() / loadCwmSpr()** — `src/client/spritemanager.h/cpp`
  - Parses `.spr` sprite files, also supports CWM sprite format
- **saveDat() / saveSpr()** available under `FRAMEWORK_EDITOR` flag

#### Modern protobuf format (appearances.dat + sprite sheets)
- **ThingTypeManager::loadAppearances()** — `src/client/thingtypemanager.cpp:147-232`
  - Reads `catalog-content.json` for sprite sheet metadata
  - Parses `appearances.dat` via protobuf (`appearances.proto`)
  - Categories: object (items), outfit (creatures), effect, missile
- **SpriteAppearances** — `src/client/spriteappearances.cpp/h`
  - Handles sprite sheets (`.bmp.lzma` format)
- Proto file: `src/protobuf/appearances.proto`

#### OTB / XML (editor mode, behind FRAMEWORK_EDITOR)
- **ThingTypeManager::loadOtb()** — `src/client/thingtypemanager.cpp:525-573`
  - Parses `.otb` binary tree format (signature, root attr version, major/minor version, item types)
- **ThingTypeManager::loadXml()** — `src/client/thingtypemanager.cpp:575-623`
  - Parses `items.xml`, requires OTB loaded first

#### Static data (protobuf)
- **ThingTypeManager::loadStaticData()** — `src/client/thingtypemanager.cpp:268-316`
  - Parses `staticdata.dat` via protobuf for monster/boss race data
  - Proto file: `src/protobuf/staticdata.proto`

---

## Proto file decision
Using **OTClient's `appearances.proto`** (`vendor/otclient/src/protobuf/appearances.proto`) as the canonical proto definition.
- Most complete / newest version (supports up to client 15.11)
- Has extra fields vs Canary/RME: `deco_kit`, `hook_south`, `hook_east`, `transparencylevel`, `ITEM_CATEGORY` quiver/soul_cores/fist_weapons, `PLAYER_PROFESSION_MONK`
- Wire-compatible with Canary's bundled `appearances.dat` (unknown fields are safely ignored by protobuf)
- Package: `otclient.protobuf.appearances`

---

## Data files for browser map editor (v15.00)

### Files extracted to `tibia/`
- `appearances.dat` — from Tibia 15.00 client (4.8MB)
- `appearances.proto` — from `vendor/otclient/src/protobuf/appearances.proto`
- `canary.otbm` — from `vendor/canary/data-canary/world/canary.otbm` (19MB, OTBM version 2)
- `items.xml` — from `vendor/canary/data/items/items.xml` (84k lines, item names/properties)
- `sprites/` — original `.bmp.lzma` sheets (4,879) + `catalog-content.json` from Tibia 15.00 client
- `sprites-png/` — pre-converted PNG sheets (4,879) + generated `catalog-content.json`

### items.otb is NOT needed for v15.00
In the modern Canary/protobuf format, **server ID = client ID**. Canary's `items.xml` uses plain `id` attributes (starting at 100) with no separate `clientid` field. The old `.otb` mapping layer (server ID ↔ client ID) was only needed for older versions where these IDs diverged.

### Simplified data chain (v15.00)
```
OTBM (item IDs) → appearances.dat (same IDs, sprite refs + flags) → sprite sheets (pixels)
         ↑
    items.xml adds names/properties
```

### Remere's confirms this
RME's `ItemDatabase` (`source/items.h`) has two loading paths:
- `loadFromOtb()` — classic `.otb` for old versions
- `loadFromProtobuf()` — loads directly from protobuf `Appearances`, no `.otb` needed

### Sprite sheets
Sourced from Tibia 15.00 client installation. Pre-converted to PNG via `scripts/convert-sprites.ts` (Node.js, uses `lzma-native` + `sharp`).

---

## Canary (`vendor/canary`)
- Client version: **15.00** (`src/core.hpp: CLIENT_VERSION = 1500`)
- Ships `appearances.dat` and `items.xml`
- Ships multiple `.otbm` maps (main world + quest/event maps)
- *TODO: explore parsers further*

## Remere's Map Editor (`vendor/remeres-map-editor`)
- Has OTBM read/write (`source/iomap_otbm.cpp`)
- Has OTB parser (`source/items.cpp`)
- Has protobuf appearances loader (`source/items.h: loadFromProtobuf()`)
- Has sprite appearances loader (`source/sprite_appearances.cpp/h`)
- *TODO: explore parsers further*
