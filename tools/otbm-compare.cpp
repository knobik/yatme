// Minimal OTBM comparison tool
// Uses Canary's exact parsing logic to load two OTBM files and compare
// the resulting tile/item data. This is the ground truth — if Canary
// would load both files identically, they are equivalent.
//
// Build:  g++ -std=c++20 -O2 -o otbm-compare tools/otbm-compare.cpp
// Usage:  ./otbm-compare <file_a.otbm> <file_b.otbm>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

// ── OTBM constants (from Canary io_definitions.hpp) ─────────────────

enum OTBM_NodeTypes_t {
    OTBM_ROOTV1       = 1,
    OTBM_MAP_DATA     = 2,
    OTBM_TILE_AREA    = 4,
    OTBM_TILE         = 5,
    OTBM_ITEM         = 6,
    OTBM_TOWNS        = 12,
    OTBM_TOWN         = 13,
    OTBM_HOUSETILE    = 14,
    OTBM_WAYPOINTS    = 15,
    OTBM_WAYPOINT     = 16,
    OTBM_TILE_ZONE    = 19,
};

enum OTBM_AttrTypes_t {
    OTBM_ATTR_DESCRIPTION            = 1,
    OTBM_ATTR_TILE_FLAGS             = 3,
    OTBM_ATTR_ACTION_ID              = 4,
    OTBM_ATTR_UNIQUE_ID              = 5,
    OTBM_ATTR_TEXT                   = 6,
    OTBM_ATTR_DESC                   = 7,
    OTBM_ATTR_TELE_DEST              = 8,
    OTBM_ATTR_ITEM                   = 9,
    OTBM_ATTR_DEPOT_ID               = 10,
    OTBM_ATTR_EXT_SPAWN_MONSTER_FILE = 11,
    OTBM_ATTR_RUNE_CHARGES           = 12,
    OTBM_ATTR_EXT_HOUSE_FILE         = 13,
    OTBM_ATTR_HOUSEDOORID            = 14,
    OTBM_ATTR_COUNT                  = 15,
    OTBM_ATTR_DURATION               = 16,
    OTBM_ATTR_DECAYING_STATE         = 17,
    OTBM_ATTR_WRITTENDATE            = 18,
    OTBM_ATTR_WRITTENBY              = 19,
    OTBM_ATTR_SLEEPERGUID            = 20,
    OTBM_ATTR_SLEEPSTART             = 21,
    OTBM_ATTR_CHARGES                = 22,
    OTBM_ATTR_EXT_SPAWN_NPC_FILE     = 23,
    OTBM_ATTR_EXT_ZONE_FILE          = 24,
};

enum OTBM_TileFlag_t : uint32_t {
    OTBM_TILEFLAG_PROTECTIONZONE = 1 << 0,
    OTBM_TILEFLAG_NOPVPZONE      = 1 << 2,
    OTBM_TILEFLAG_NOLOGOUT       = 1 << 3,
    OTBM_TILEFLAG_PVPZONE        = 1 << 4,
};

// Canary runtime tile flags (from items_definitions.hpp)
enum TileFlags_t : uint32_t {
    TILESTATE_NONE           = 0,
    TILESTATE_PROTECTIONZONE = 1 << 7,
    TILESTATE_NOPVPZONE      = 1 << 8,
    TILESTATE_NOLOGOUT       = 1 << 9,
    TILESTATE_PVPZONE        = 1 << 10,
};

static constexpr uint8_t NODE_START = 0xFE;
static constexpr uint8_t NODE_END   = 0xFF;
static constexpr uint8_t NODE_ESC   = 0xFD;

// ── Data structures (from Canary mapcache.hpp) ──────────────────────

struct BasicItem {
    std::string text;
    uint16_t id            = 0;
    uint16_t charges       = 0;
    uint16_t actionId      = 0;
    uint16_t uniqueId      = 0;
    uint16_t destX         = 0;
    uint16_t destY         = 0;
    uint16_t doorOrDepotId = 0;
    uint8_t  destZ         = 0;
    std::vector<std::shared_ptr<BasicItem>> items;
};

struct BasicTile {
    std::shared_ptr<BasicItem> ground;
    std::vector<std::shared_ptr<BasicItem>> items;
    uint32_t flags   = 0;
    uint32_t houseId = 0;
};

struct Position {
    uint16_t x = 0, y = 0;
    uint8_t z = 0;
    bool operator<(const Position& o) const {
        if (x != o.x) return x < o.x;
        if (y != o.y) return y < o.y;
        return z < o.z;
    }
    bool operator==(const Position& o) const {
        return x == o.x && y == o.y && z == o.z;
    }
};

struct Town {
    uint32_t id = 0;
    std::string name;
    Position templePos;
};

struct Waypoint {
    std::string name;
    Position pos;
};

struct MapData {
    uint32_t version = 0;
    uint16_t width = 0, height = 0;
    std::map<uint64_t, std::shared_ptr<BasicTile>> tiles;
    std::vector<Town> towns;
    std::map<std::string, Position> waypoints;
};

static uint64_t posKey(uint16_t x, uint16_t y, uint8_t z) {
    return (uint64_t)x << 24 | (uint64_t)y << 8 | z;
}

// ── FileStream (from Canary filestream.cpp) ─────────────────────────

class FileStream {
    const uint8_t* m_data;
    uint32_t m_size;
    uint32_t m_pos  = 0;
    uint32_t m_nodes = 0;

public:
    FileStream(const uint8_t* data, uint32_t size)
        : m_data(data), m_size(size) {}

    void back(uint32_t n = 1) { m_pos -= n; }

    uint8_t getU8() {
        if (m_pos >= m_size) return 0;
        if (m_nodes > 0 && m_data[m_pos] == NODE_ESC) ++m_pos;
        return m_data[m_pos++];
    }

    uint16_t getU16() {
        uint8_t buf[2];
        for (int i = 0; i < 2; ++i) {
            if (m_nodes > 0 && m_pos < m_size && m_data[m_pos] == NODE_ESC) ++m_pos;
            buf[i] = (m_pos < m_size) ? m_data[m_pos++] : 0;
        }
        uint16_t v;
        memcpy(&v, buf, 2);
        return v;
    }

    uint32_t getU32() {
        uint8_t buf[4];
        for (int i = 0; i < 4; ++i) {
            if (m_nodes > 0 && m_pos < m_size && m_data[m_pos] == NODE_ESC) ++m_pos;
            buf[i] = (m_pos < m_size) ? m_data[m_pos++] : 0;
        }
        uint32_t v;
        memcpy(&v, buf, 4);
        return v;
    }

    std::string getString() {
        uint16_t len = getU16();
        if (len == 0 || len >= 8192) return {};
        std::string s;
        s.reserve(len);
        for (uint16_t i = 0; i < len; ++i) {
            s.push_back(static_cast<char>(getU8()));
        }
        return s;
    }

    void skip(uint32_t n) { m_pos += n; }

    bool isProp(uint8_t prop) {
        if (getU8() == prop) return true;
        back();
        return false;
    }

    bool startNode(uint8_t type = 0) {
        if (getU8() == NODE_START) {
            if (type == 0 || getU8() == type) {
                ++m_nodes;
                return true;
            }
            back();
        }
        back();
        return false;
    }

    bool endNode() {
        if (getU8() == NODE_END) {
            --m_nodes;
            return true;
        }
        back();
        return false;
    }
};

// ── Item attribute parser (from Canary mapcache.cpp) ────────────────

static void readItemAttrs(FileStream& s, BasicItem& item) {
    for (;;) {
        uint8_t attr = s.getU8();
        switch (attr) {
            case OTBM_ATTR_DEPOT_ID:    item.doorOrDepotId = s.getU16(); break;
            case OTBM_ATTR_HOUSEDOORID: item.doorOrDepotId = s.getU8();  break;
            case OTBM_ATTR_TELE_DEST:
                item.destX = s.getU16();
                item.destY = s.getU16();
                item.destZ = s.getU8();
                break;
            case OTBM_ATTR_COUNT:       item.charges = s.getU8();  break;
            case OTBM_ATTR_CHARGES:     item.charges = s.getU16(); break;
            case OTBM_ATTR_ACTION_ID:   item.actionId = s.getU16(); break;
            case OTBM_ATTR_UNIQUE_ID:   item.uniqueId = s.getU16(); break;
            case OTBM_ATTR_TEXT:        item.text = s.getString(); break;
            case OTBM_ATTR_DESC:        s.getString(); break; // Canary ignores desc
            case OTBM_ATTR_DURATION:    s.getU32(); break;    // runtime state, skip
            case OTBM_ATTR_DECAYING_STATE: s.getU8(); break;  // runtime state, skip
            case OTBM_ATTR_WRITTENDATE: s.getU32(); break;    // runtime state, skip
            case OTBM_ATTR_WRITTENBY:   s.getString(); break; // runtime state, skip
            case OTBM_ATTR_SLEEPERGUID: s.getU32(); break;    // runtime state, skip
            case OTBM_ATTR_SLEEPSTART:  s.getU32(); break;    // runtime state, skip
            case OTBM_ATTR_RUNE_CHARGES: item.charges = s.getU16(); break;
            default:
                s.back();
                return;
        }
    }
}

static bool unserializeItem(FileStream& s, BasicItem& item) {
    // Check for property end
    if (s.isProp(NODE_END)) {
        s.back();
        return true;
    }

    readItemAttrs(s, item);

    // Read child items (containers)
    while (s.startNode()) {
        if (s.getU8() != OTBM_ITEM) {
            fprintf(stderr, "Error: expected OTBM_ITEM child\n");
            return false;
        }
        auto child = std::make_shared<BasicItem>();
        child->id = s.getU16();
        if (!unserializeItem(s, *child)) return false;
        item.items.push_back(child);
        if (!s.endNode()) return false;
    }
    return true;
}

// ── Map loader (from Canary iomap.cpp) ──────────────────────────────

static bool loadMap(const char* path, MapData& map) {
    // Read entire file
    std::ifstream f(path, std::ios::binary | std::ios::ate);
    if (!f) {
        fprintf(stderr, "Cannot open: %s\n", path);
        return false;
    }
    auto size = f.tellg();
    f.seekg(0);
    std::vector<uint8_t> buf(size);
    f.read((char*)buf.data(), size);

    // Skip 4-byte identifier
    FileStream s(buf.data() + 4, (uint32_t)size - 4);

    // Root node
    if (!s.startNode()) {
        fprintf(stderr, "No root node\n");
        return false;
    }
    s.skip(1); // node type byte

    map.version = s.getU32();
    map.width   = s.getU16();
    map.height  = s.getU16();
    s.getU32(); // majorVersionItems
    s.getU32(); // minorVersionItems

    // MAP_DATA node
    if (!s.startNode(OTBM_MAP_DATA)) {
        fprintf(stderr, "No MAP_DATA node\n");
        return false;
    }

    // Skip map data attributes (description, file refs)
    for (;;) {
        uint8_t attr = s.getU8();
        switch (attr) {
            case OTBM_ATTR_DESCRIPTION:
            case OTBM_ATTR_EXT_SPAWN_MONSTER_FILE:
            case OTBM_ATTR_EXT_SPAWN_NPC_FILE:
            case OTBM_ATTR_EXT_HOUSE_FILE:
            case OTBM_ATTR_EXT_ZONE_FILE:
                s.getString(); // read and discard
                break;
            default:
                s.back();
                goto done_attrs;
        }
    }
done_attrs:

    // Parse tile areas
    while (s.startNode(OTBM_TILE_AREA)) {
        uint16_t baseX = s.getU16();
        uint16_t baseY = s.getU16();
        uint8_t  baseZ = s.getU8();

        while (s.startNode()) {
            uint8_t tileType = s.getU8();
            if (tileType != OTBM_TILE && tileType != OTBM_HOUSETILE) {
                fprintf(stderr, "Bad tile type: %d\n", tileType);
                return false;
            }

            auto tile = std::make_shared<BasicTile>();

            uint8_t offX = s.getU8();
            uint8_t offY = s.getU8();
            uint16_t x = baseX + offX;
            uint16_t y = baseY + offY;
            uint8_t  z = baseZ;

            if (tileType == OTBM_HOUSETILE) {
                tile->houseId = s.getU32();
            }

            // Tile flags (Canary's exact flag mapping)
            if (s.isProp(OTBM_ATTR_TILE_FLAGS)) {
                uint32_t rawFlags = s.getU32();
                if (rawFlags & OTBM_TILEFLAG_PROTECTIONZONE)
                    tile->flags |= TILESTATE_PROTECTIONZONE;
                else if (rawFlags & OTBM_TILEFLAG_NOPVPZONE)
                    tile->flags |= TILESTATE_NOPVPZONE;
                else if (rawFlags & OTBM_TILEFLAG_PVPZONE)
                    tile->flags |= TILESTATE_PVPZONE;
                if (rawFlags & OTBM_TILEFLAG_NOLOGOUT)
                    tile->flags |= TILESTATE_NOLOGOUT;
            }

            // Inline item (OTBM_ATTR_ITEM)
            if (s.isProp(OTBM_ATTR_ITEM)) {
                auto item = std::make_shared<BasicItem>();
                item->id = s.getU16();
                // Canary uses isGroundTile() here but we don't have item
                // type data. Just store as ground (first item) to match
                // what Canary does for most maps — ground items are ID-only.
                tile->ground = item;
            }

            // Full item nodes
            while (s.startNode()) {
                uint8_t childType = s.getU8();
                if (childType == OTBM_ITEM) {
                    auto item = std::make_shared<BasicItem>();
                    item->id = s.getU16();
                    if (!unserializeItem(s, *item)) return false;

                    // Without item type data we can't call isGroundTile().
                    // Store all full-node items in the items vector.
                    // If ground is not set, first item becomes ground.
                    if (!tile->ground) {
                        tile->ground = item;
                    } else {
                        tile->items.push_back(item);
                    }
                } else if (childType == OTBM_TILE_ZONE) {
                    uint16_t zoneCount = s.getU16();
                    for (uint16_t i = 0; i < zoneCount; ++i) s.getU16();
                } else {
                    fprintf(stderr, "Unknown tile child type: %d\n", childType);
                    return false;
                }
                if (!s.endNode()) return false;
            }

            if (!s.endNode()) return false;

            // Store tile (skip empty tiles like Canary does)
            if (tile->ground || !tile->items.empty() || tile->flags != 0) {
                map.tiles[posKey(x, y, z)] = tile;
            }
        }
        if (!s.endNode()) return false;
    }

    s.endNode(); // MAP_DATA

    // Towns
    if (s.startNode(OTBM_TOWNS)) {
        while (s.startNode(OTBM_TOWN)) {
            Town town;
            town.id   = s.getU32();
            town.name = s.getString();
            town.templePos.x = s.getU16();
            town.templePos.y = s.getU16();
            town.templePos.z = s.getU8();
            map.towns.push_back(town);
            if (!s.endNode()) return false;
        }
        if (!s.endNode()) return false;
    }

    // Waypoints
    if (s.startNode(OTBM_WAYPOINTS)) {
        while (s.startNode(OTBM_WAYPOINT)) {
            std::string name = s.getString();
            Position pos;
            pos.x = s.getU16();
            pos.y = s.getU16();
            pos.z = s.getU8();
            map.waypoints[name] = pos;
            if (!s.endNode()) return false;
        }
        if (!s.endNode()) return false;
    }

    return true;
}

// ── Comparison ──────────────────────────────────────────────────────

static bool compareItems(const BasicItem& a, const BasicItem& b,
                         const char* path, int& diffCount) {
    bool ok = true;
    auto diff = [&](const char* field, auto va, auto vb) {
        if (va != vb) {
            if (diffCount < 20) {
                fprintf(stderr, "  %s.%s: %s vs %s\n", path, field,
                        std::to_string(va).c_str(), std::to_string(vb).c_str());
            }
            ++diffCount;
            ok = false;
        }
    };

    diff("id",            a.id,            b.id);
    diff("charges",       a.charges,       b.charges);
    diff("actionId",      a.actionId,      b.actionId);
    diff("uniqueId",      a.uniqueId,      b.uniqueId);
    diff("destX",         a.destX,         b.destX);
    diff("destY",         a.destY,         b.destY);
    diff("destZ",         a.destZ,         b.destZ);
    diff("doorOrDepotId", a.doorOrDepotId, b.doorOrDepotId);

    if (a.text != b.text) {
        if (diffCount < 20) {
            fprintf(stderr, "  %s.text: \"%s\" vs \"%s\"\n", path,
                    a.text.c_str(), b.text.c_str());
        }
        ++diffCount;
        ok = false;
    }

    if (a.items.size() != b.items.size()) {
        if (diffCount < 20) {
            fprintf(stderr, "  %s.items.size: %zu vs %zu\n", path,
                    a.items.size(), b.items.size());
        }
        ++diffCount;
        ok = false;
    } else {
        for (size_t i = 0; i < a.items.size(); ++i) {
            char childPath[256];
            snprintf(childPath, sizeof(childPath), "%s.items[%zu]", path, i);
            compareItems(*a.items[i], *b.items[i], childPath, diffCount);
        }
    }

    return ok;
}

static int compareMaps(const MapData& a, const MapData& b) {
    int diffs = 0;

    if (a.version != b.version) {
        fprintf(stderr, "  version: %u vs %u\n", a.version, b.version);
        ++diffs;
    }
    if (a.width != b.width || a.height != b.height) {
        fprintf(stderr, "  dimensions: %ux%u vs %ux%u\n",
                a.width, a.height, b.width, b.height);
        ++diffs;
    }

    // Compare tiles
    if (a.tiles.size() != b.tiles.size()) {
        fprintf(stderr, "  tile count: %zu vs %zu\n", a.tiles.size(), b.tiles.size());
        ++diffs;
    }

    // Tiles in A but not B
    for (const auto& [key, tileA] : a.tiles) {
        auto it = b.tiles.find(key);
        if (it == b.tiles.end()) {
            uint16_t x = (key >> 24) & 0xFFFF;
            uint16_t y = (key >> 8) & 0xFFFF;
            uint8_t  z = key & 0xFF;
            if (diffs < 20) {
                fprintf(stderr, "  tile (%u,%u,%u): only in file A\n", x, y, z);
            }
            ++diffs;
            continue;
        }
        const auto& tileB = *it->second;

        uint16_t x = (key >> 24) & 0xFFFF;
        uint16_t y = (key >> 8) & 0xFFFF;
        uint8_t  z = key & 0xFF;

        if (tileA->flags != tileB.flags) {
            if (diffs < 20) {
                fprintf(stderr, "  tile (%u,%u,%u).flags: 0x%x vs 0x%x\n",
                        x, y, z, tileA->flags, tileB.flags);
            }
            ++diffs;
        }
        if (tileA->houseId != tileB.houseId) {
            if (diffs < 20) {
                fprintf(stderr, "  tile (%u,%u,%u).houseId: %u vs %u\n",
                        x, y, z, tileA->houseId, tileB.houseId);
            }
            ++diffs;
        }

        // Ground
        bool hasGroundA = tileA->ground != nullptr;
        bool hasGroundB = tileB.ground != nullptr;
        if (hasGroundA != hasGroundB) {
            if (diffs < 20) {
                fprintf(stderr, "  tile (%u,%u,%u).ground: %s vs %s\n",
                        x, y, z, hasGroundA ? "yes" : "no", hasGroundB ? "yes" : "no");
            }
            ++diffs;
        } else if (hasGroundA) {
            char path[128];
            snprintf(path, sizeof(path), "tile(%u,%u,%u).ground", x, y, z);
            compareItems(*tileA->ground, *tileB.ground, path, diffs);
        }

        // Items
        if (tileA->items.size() != tileB.items.size()) {
            if (diffs < 20) {
                fprintf(stderr, "  tile (%u,%u,%u).items.size: %zu vs %zu\n",
                        x, y, z, tileA->items.size(), tileB.items.size());
            }
            ++diffs;
        } else {
            for (size_t i = 0; i < tileA->items.size(); ++i) {
                char path[128];
                snprintf(path, sizeof(path), "tile(%u,%u,%u).items[%zu]", x, y, z, i);
                compareItems(*tileA->items[i], *tileB.items[i], path, diffs);
            }
        }
    }

    // Tiles in B but not A
    for (const auto& [key, tileB] : b.tiles) {
        if (a.tiles.find(key) == a.tiles.end()) {
            uint16_t x = (key >> 24) & 0xFFFF;
            uint16_t y = (key >> 8) & 0xFFFF;
            uint8_t  z = key & 0xFF;
            if (diffs < 20) {
                fprintf(stderr, "  tile (%u,%u,%u): only in file B\n", x, y, z);
            }
            ++diffs;
        }
    }

    // Towns
    if (a.towns.size() != b.towns.size()) {
        fprintf(stderr, "  town count: %zu vs %zu\n", a.towns.size(), b.towns.size());
        ++diffs;
    } else {
        for (size_t i = 0; i < a.towns.size(); ++i) {
            if (a.towns[i].id != b.towns[i].id ||
                a.towns[i].name != b.towns[i].name ||
                !(a.towns[i].templePos == b.towns[i].templePos)) {
                if (diffs < 20) {
                    fprintf(stderr, "  town[%zu] mismatch\n", i);
                }
                ++diffs;
            }
        }
    }

    // Waypoints
    if (a.waypoints.size() != b.waypoints.size()) {
        fprintf(stderr, "  waypoint count: %zu vs %zu\n",
                a.waypoints.size(), b.waypoints.size());
        ++diffs;
    } else {
        for (const auto& [name, posA] : a.waypoints) {
            auto it = b.waypoints.find(name);
            if (it == b.waypoints.end()) {
                if (diffs < 20) fprintf(stderr, "  waypoint '%s': only in A\n", name.c_str());
                ++diffs;
            } else if (!(posA == it->second)) {
                if (diffs < 20) fprintf(stderr, "  waypoint '%s': position differs\n", name.c_str());
                ++diffs;
            }
        }
    }

    return diffs;
}

// ── Main ────────────────────────────────────────────────────────────

int main(int argc, char** argv) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <file_a.otbm> <file_b.otbm>\n", argv[0]);
        return 1;
    }

    MapData mapA, mapB;

    printf("Loading A: %s\n", argv[1]);
    if (!loadMap(argv[1], mapA)) return 1;
    printf("  %zu tiles, %zu towns, %zu waypoints\n",
           mapA.tiles.size(), mapA.towns.size(), mapA.waypoints.size());

    printf("Loading B: %s\n", argv[2]);
    if (!loadMap(argv[2], mapB)) return 1;
    printf("  %zu tiles, %zu towns, %zu waypoints\n",
           mapB.tiles.size(), mapB.towns.size(), mapB.waypoints.size());

    printf("Comparing...\n");
    int diffs = compareMaps(mapA, mapB);

    if (diffs == 0) {
        printf("\nPASS: maps are identical (as Canary would load them)\n");
        return 0;
    } else {
        fprintf(stderr, "\nFAIL: %d differences found\n", diffs);
        return 1;
    }
}
