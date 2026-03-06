// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./fetchWithProgress', () => ({
  fetchWithProgress: vi.fn(),
}));

vi.mock('../proto/appearances', () => ({
  Appearances: {
    decode: vi.fn(),
  },
}));

import { loadAppearances } from './appearances';
import { Appearances } from '../proto/appearances';
import { fetchWithProgress } from './fetchWithProgress';

const mockedFetchWithProgress = vi.mocked(fetchWithProgress);
const mockedDecode = vi.mocked(Appearances.decode);

function fakeAppearance(id: number, name = 'test') {
  return { id, frameGroup: [], flags: undefined, name, description: '' };
}

function setupMocks(opts?: {
  objects?: ReturnType<typeof fakeAppearance>[];
  outfits?: ReturnType<typeof fakeAppearance>[];
  effects?: ReturnType<typeof fakeAppearance>[];
  missiles?: ReturnType<typeof fakeAppearance>[];
}) {
  const fakeBuffer = new ArrayBuffer(8);
  mockedFetchWithProgress.mockResolvedValue(fakeBuffer);
  mockedDecode.mockReturnValue({
    object: opts?.objects ?? [],
    outfit: opts?.outfits ?? [],
    effect: opts?.effects ?? [],
    missile: opts?.missiles ?? [],
  } as any);
}

describe('loadAppearances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AppearanceData with 4 maps (objects, outfits, effects, missiles)', async () => {
    setupMocks({
      objects: [fakeAppearance(1)],
      outfits: [fakeAppearance(2)],
      effects: [fakeAppearance(3)],
      missiles: [fakeAppearance(4)],
    });

    const result = await loadAppearances();

    expect(result).toHaveProperty('objects');
    expect(result).toHaveProperty('outfits');
    expect(result).toHaveProperty('effects');
    expect(result).toHaveProperty('missiles');
    expect(result.objects).toBeInstanceOf(Map);
    expect(result.outfits).toBeInstanceOf(Map);
    expect(result.effects).toBeInstanceOf(Map);
    expect(result.missiles).toBeInstanceOf(Map);
  });

  it('builds lookup by id correctly (object accessible by id)', async () => {
    const obj = fakeAppearance(42, 'sword');
    setupMocks({ objects: [obj] });

    const result = await loadAppearances();

    expect(result.objects.get(42)).toEqual(obj);
  });

  it('returns empty maps when arrays are empty', async () => {
    setupMocks();

    const result = await loadAppearances();

    expect(result.objects.size).toBe(0);
    expect(result.outfits.size).toBe(0);
    expect(result.effects.size).toBe(0);
    expect(result.missiles.size).toBe(0);
  });

  it('passes progress callback through to fetchWithProgress', async () => {
    setupMocks();
    const onProgress = vi.fn();

    await loadAppearances('/appearances.dat', onProgress);

    expect(mockedFetchWithProgress).toHaveBeenCalledWith('/appearances.dat', onProgress);
  });

  it('uses correct default URL /appearances.dat', async () => {
    setupMocks();

    await loadAppearances();

    expect(mockedFetchWithProgress).toHaveBeenCalledWith('/appearances.dat', undefined);
  });

  it('passes buffer as Uint8Array to Appearances.decode', async () => {
    setupMocks();

    await loadAppearances();

    expect(mockedDecode).toHaveBeenCalledWith(expect.any(Uint8Array));
  });

  it('passes custom URL through to fetchWithProgress', async () => {
    setupMocks();

    await loadAppearances('/custom/path.dat');

    expect(mockedFetchWithProgress).toHaveBeenCalledWith('/custom/path.dat', undefined);
  });

  it('multiple objects are accessible by their IDs', async () => {
    const obj1 = fakeAppearance(10, 'helmet');
    const obj2 = fakeAppearance(20, 'armor');
    const obj3 = fakeAppearance(30, 'legs');
    setupMocks({ objects: [obj1, obj2, obj3] });

    const result = await loadAppearances();

    expect(result.objects.size).toBe(3);
    expect(result.objects.get(10)).toEqual(obj1);
    expect(result.objects.get(20)).toEqual(obj2);
    expect(result.objects.get(30)).toEqual(obj3);
  });

  it('duplicate IDs result in last-wins (Map.set behavior)', async () => {
    const first = fakeAppearance(5, 'first');
    const second = fakeAppearance(5, 'second');
    setupMocks({ objects: [first, second] });

    const result = await loadAppearances();

    expect(result.objects.size).toBe(1);
    expect(result.objects.get(5)).toEqual(second);
  });
});
