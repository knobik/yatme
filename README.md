# YATME — Yet Another Tibia Map Editor

Browser-based OpenTibia map editor for Tibia 15.00+ client data. Built with React 19, PixiJS 8, TypeScript, and Vite.

Renders and edits OTBM map files using sprite data extracted from the Tibia client. Inspired by [Remere's Map Editor](https://github.com/hjnilsson/rme).

## Asset Setup

The editor requires asset files from a Tibia 15.00+ client. You can find them at:

```
%LOCALAPPDATA%\Tibia\packages\Tibia\assets\
```

The directory contains:

```
catalog-content.json                    # Asset manifest
appearances-<hash>.dat                  # Protobuf appearance definitions
sprites-<hash>.bmp.lzma                # Sprite sheet files (~5000 files)
...                                     # Other client data files
```

You will also need your `.otbm` map file and its sidecar XML files (e.g. `*-house.xml`, `*-monster.xml`, `*-npc.xml`, `*-zones.xml`) if available.

Where to place these files depends on your setup — see the sections below.

---

## Self-Hosting with Docker Compose

Host the map editor alongside your OTS server for map development and administration.

### 1. Prepare files

Copy the client assets into an `assets/` directory and your map files into a `maps/` directory:

```
assets/
├── catalog-content.json
├── appearances-<hash>.dat
├── sprites-<hash>.bmp.lzma
└── ...
maps/
├── mymap.otbm
├── mymap-house.xml
└── ...
```

### 2. Create `docker-compose.yml`

```yaml
services:
  editor:
    image: knobik/yatme:latest
    user: "${UID:-1000}:${GID:-1000}"
    ports:
      - "${PORT:-8080}:8080"
    volumes:
      - ./assets:/app/sprites:ro
      - ./maps:/app/maps
      - sprites-png:/app/sprites-png
    restart: unless-stopped

volumes:
  sprites-png:
```

### 3. Start the editor

```bash
docker compose up -d
```

The editor is available at `http://localhost:8080`.

On first startup, sprite sheets are automatically converted from `.bmp.lzma` to PNG. The `sprites-png` volume persists converted sprites across container restarts.

### Volumes

| Mount | Description |
|-------|-------------|
| `./assets:/app/sprites:ro` | Tibia client sprite sheets, `catalog-content.json`, and `appearances-<hash>.dat`. Mounted read-only. |
| `./maps:/app/maps` | OTBM map files and their sidecar XML files (e.g. `*-house.xml`, `*-zones.xml`) if available. Read-write so the editor can save changes. |
| `sprites-png` (named volume) | Cache for converted PNG sprites. Persists across container restarts so conversion only runs once. |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `8080`  | Host port   |
| `UID`    | `1000`  | Container user ID |
| `GID`    | `1000`  | Container group ID |

### Alternative: `docker run`

If you prefer not to use Docker Compose, run the container directly.

First, create the named volume for the sprite cache:

```bash
docker volume create sprites-png
```

Then start the container:

```bash
docker run -d \
  --name yatme \
  -p 8080:8080 \
  -v ./assets:/app/sprites:ro \
  -v ./maps:/app/maps \
  -v sprites-png:/app/sprites-png \
  knobik/yatme:latest
```

To run as a specific user (matching your host UID/GID):

```bash
docker run -d \
  --name yatme \
  -u "$(id -u):$(id -g)" \
  -p 8080:8080 \
  -v ./assets:/app/sprites:ro \
  -v ./maps:/app/maps \
  -v sprites-png:/app/sprites-png \
  knobik/yatme:latest
```

See the [Volumes](#volumes) and [Configuration](#configuration) tables above for details on each mount.

---

## Local Development

### Prerequisites

- Node.js 22+
- Docker (optional, for protobuf codegen)

### Asset Setup

Copy the client assets (see [Asset Setup](#asset-setup)) into `tibia/sprites/` and your map files into `maps/`:

```
tibia/sprites/
├── catalog-content.json
├── appearances-<hash>.dat
├── sprites-<hash>.bmp.lzma
└── ...
maps/
├── mymap.otbm
└── ...
```

### Dev Server

```bash
npm install
npm run dev
```

The dev server serves assets from `tibia/` and `data/` as public directories.

### Build

```bash
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview the production build locally
```

### Testing

```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode
npm run test:coverage                 # Coverage report
npx vitest run src/lib/Camera.test.ts # Single file
```

### Linting

```bash
npm run lint
```
