# Tibia Map Editor

Browser-based Tibia map editor for Tibia 15.00+. Built with React 19, PixiJS 8, TypeScript, and Vite.

Renders and edits OTBM map files using sprite data extracted from the Tibia client. Inspired by [Remere's Map Editor](https://github.com/hjnilsson/rme).

## Prerequisites

- Node.js 22+
- Tibia 15.00 client files (see [Asset Setup](#asset-setup))
- Docker (for protobuf codegen and production deployment)

## Asset Setup

The editor requires asset files from a Tibia 15.00+ client. Copy the entire contents of the Tibia client's `packages/` directory into `tibia/sprites/`:

```
tibia/sprites/
├── catalog-content.json                    # Asset manifest
├── appearances-<hash>.dat                  # Protobuf appearance definitions
├── sprites-<hash>.bmp.lzma                 # Sprite sheet files (~5000 files)
└── ...                                     # Other client data files
```

The `packages/` directory is located inside the Tibia client installation folder.

Map files (`.otbm`) go in the `maps/` directory.

## Development

```bash
npm install
npm run dev
```

The dev server serves assets from `tibia/` and `data/` as public directories.

## Build

```bash
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview the production build locally
```

## Testing

```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode
npm run test:coverage                 # Coverage report
npx vitest run src/lib/Camera.test.ts # Single file
```

## Linting

```bash
npm run lint
```

## Self-Hosting with Docker Compose

Host the map editor alongside your OTS server for map development and administration.

### 1. Prepare assets

Follow [Asset Setup](#asset-setup) and place your `.otbm` map files in `maps/`.

### 2. Start the editor

```bash
docker compose up -d
```

The editor is available at `http://localhost:8080`.

On first startup, sprite sheets are automatically converted from `.bmp.lzma` to PNG. To persist converted sprites across container restarts, uncomment the `sprites-png` volume in `docker-compose.yml`.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `8080`  | Host port   |
| `UID`    | `1000`  | Container user ID |
| `GID`    | `1000`  | Container group ID |
