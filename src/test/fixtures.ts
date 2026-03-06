import type { OtbmItem, OtbmTile, OtbmMap } from '../lib/otbm'
import type { AppearanceData } from '../lib/appearances'
import type { Appearance, AppearanceFlags, SpriteInfo, SpriteAnimation } from '../proto/appearances'

export function makeItem(overrides: Partial<OtbmItem> = {}): OtbmItem {
  return { id: 1, ...overrides }
}

export function makeTile(x: number, y: number, z: number, items: OtbmItem[] = []): OtbmTile {
  return { x, y, z, flags: 0, items }
}

export function makeMapData(tiles: OtbmTile[] = []): OtbmMap {
  const tileMap = new Map<string, OtbmTile>()
  for (const t of tiles) {
    tileMap.set(`${t.x},${t.y},${t.z}`, t)
  }
  return {
    version: 2,
    width: 1024,
    height: 1024,
    description: '',
    spawnFile: '',
    houseFile: '',
    tiles: tileMap,
    towns: [],
    waypoints: [],
  }
}

export function makeAppearance(id: number, flags: Partial<AppearanceFlags> = {}): Appearance {
  return {
    id,
    frameGroup: [],
    flags: { ...flags } as AppearanceFlags,
    name: '',
    description: '',
  }
}

export function makeAppearanceWithSprite(
  info: SpriteInfo,
  flags: Partial<AppearanceFlags> = {},
): Appearance {
  return {
    id: 1,
    frameGroup: [{ fixedFrameGroup: 0, id: 0, spriteInfo: info }],
    flags: { ...flags } as AppearanceFlags,
    name: '',
    description: '',
  }
}

export function makeAppearanceData(entries: [number, Partial<AppearanceFlags>][]): AppearanceData {
  const objects = new Map<number, Appearance>()
  for (const [id, flags] of entries) {
    objects.set(id, makeAppearance(id, flags))
  }
  return {
    objects,
    outfits: new Map(),
    effects: new Map(),
    missiles: new Map(),
  }
}

export function makeSpriteInfo(overrides: Partial<SpriteInfo> = {}): SpriteInfo {
  return {
    patternWidth: 1,
    patternHeight: 1,
    patternDepth: 1,
    layers: 1,
    spriteId: [100],
    boundingSquare: 0,
    animation: undefined,
    isOpaque: false,
    boundingBoxPerDirection: [],
    ...overrides,
  }
}

export function makeSpriteAnimation(phases: number, loopType: number = 0): SpriteAnimation {
  const spritePhase = Array.from({ length: phases }, () => ({
    durationMin: 100,
    durationMax: 100,
  }))
  return {
    defaultStartPhase: 0,
    synchronized: false,
    randomStartPhase: false,
    loopType: loopType as SpriteAnimation['loopType'],
    loopCount: 0,
    spritePhase,
  }
}
