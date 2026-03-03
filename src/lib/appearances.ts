import { Appearances, Appearance } from '../proto/appearances';

export interface AppearanceData {
  objects: Map<number, Appearance>;
  outfits: Map<number, Appearance>;
  effects: Map<number, Appearance>;
  missiles: Map<number, Appearance>;
}

function buildLookup(list: Appearance[]): Map<number, Appearance> {
  const map = new Map<number, Appearance>();
  for (const item of list) {
    map.set(item.id, item);
  }
  return map;
}

export async function loadAppearances(url = '/appearances.dat'): Promise<AppearanceData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch appearances.dat: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const decoded = Appearances.decode(new Uint8Array(buffer));

  return {
    objects: buildLookup(decoded.object),
    outfits: buildLookup(decoded.outfit),
    effects: buildLookup(decoded.effect),
    missiles: buildLookup(decoded.missile),
  };
}
