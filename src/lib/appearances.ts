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

export async function loadAppearances(
  url = '/appearances.dat',
  onProgress?: (fraction: number) => void,
): Promise<AppearanceData> {
  const { fetchWithProgress } = await import('./fetchWithProgress');
  const buffer = await fetchWithProgress(url, onProgress);
  const decoded = Appearances.decode(new Uint8Array(buffer));

  return {
    objects: buildLookup(decoded.object),
    outfits: buildLookup(decoded.outfit),
    effects: buildLookup(decoded.effect),
    missiles: buildLookup(decoded.missile),
  };
}
