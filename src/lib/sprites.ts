const SHEET_SIZE = 384;

const SPRITE_DIMENSIONS: Record<number, { width: number; height: number }> = {
  0: { width: 32, height: 32 },
  1: { width: 32, height: 64 },
  2: { width: 64, height: 32 },
  3: { width: 64, height: 64 },
};

interface CatalogSpriteEntry {
  type: 'sprite';
  file: string;
  spritetype: number;
  firstspriteid: number;
  lastspriteid: number;
}

export interface SheetInfo {
  file: string;
  spritetype: number;
  firstSpriteId: number;
  lastSpriteId: number;
  width: number;
  height: number;
  cols: number;
}

const sheetIndex: SheetInfo[] = [];
const sheetCache = new Map<string, HTMLImageElement>();
const spriteCache = new Map<number, ImageBitmap>();

export async function loadSpriteCatalog(
  catalogUrl = '/sprites-png/catalog-content.json',
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const { fetchTextWithProgress } = await import('./fetchWithProgress');
  const text = await fetchTextWithProgress(catalogUrl, onProgress);
  const catalog = JSON.parse(text);

  sheetIndex.length = 0;

  for (const entry of catalog) {
    if (entry.type !== 'sprite') continue;
    const dims = SPRITE_DIMENSIONS[entry.spritetype];
    if (!dims) continue;

    sheetIndex.push({
      file: entry.file,
      spritetype: entry.spritetype,
      firstSpriteId: entry.firstspriteid,
      lastSpriteId: entry.lastspriteid,
      width: dims.width,
      height: dims.height,
      cols: Math.floor(SHEET_SIZE / dims.width),
    });
  }

  // Sort by firstSpriteId for binary search
  sheetIndex.sort((a, b) => a.firstSpriteId - b.firstSpriteId);
}

export function findSheet(spriteId: number): SheetInfo | null {
  let lo = 0;
  let hi = sheetIndex.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const sheet = sheetIndex[mid];
    if (spriteId < sheet.firstSpriteId) hi = mid - 1;
    else if (spriteId > sheet.lastSpriteId) lo = mid + 1;
    else return sheet;
  }
  return null;
}

function loadSheetImage(file: string): Promise<HTMLImageElement> {
  const cached = sheetCache.get(file);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      sheetCache.set(file, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load sheet: ${file}`));
    img.src = `/sprites-png/${file}`;
  });
}

export async function getSprite(spriteId: number): Promise<ImageBitmap | null> {
  const cached = spriteCache.get(spriteId);
  if (cached) return cached;

  const sheet = findSheet(spriteId);
  if (!sheet) return null;

  const img = await loadSheetImage(sheet.file);

  const offset = spriteId - sheet.firstSpriteId;
  const col = offset % sheet.cols;
  const row = Math.floor(offset / sheet.cols);
  const sx = col * sheet.width;
  const sy = row * sheet.height;

  const bitmap = await createImageBitmap(img, sx, sy, sheet.width, sheet.height);
  spriteCache.set(spriteId, bitmap);
  return bitmap;
}

export function getSpriteSheetCount(): number {
  return sheetIndex.length;
}
