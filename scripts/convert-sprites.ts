import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lzma from 'lzma-native';
import sharp from 'sharp';

const SHEET_SIZE = 384;
const BYTES_PER_PIXEL = 4;
const BYTES_IN_SHEET = SHEET_SIZE * SHEET_SIZE * BYTES_PER_PIXEL; // 589,824
const SHEET_WIDTH_BYTES = SHEET_SIZE * BYTES_PER_PIXEL; // 1,536

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = process.env['SPRITES_INPUT_DIR'] ?? path.resolve(__dirname, '../tibia/sprites');
const OUTPUT_DIR = process.env['SPRITES_OUTPUT_DIR'] ?? path.resolve(__dirname, '../tibia/sprites-png');

interface CatalogEntry {
  type: string;
  file: string;
  spritetype?: number;
  firstspriteid?: number;
  lastspriteid?: number;
  area?: number;
}

function skipCipHeader(buffer: Buffer): Buffer {
  // CIP header is always exactly 32 bytes
  return buffer.subarray(32);
}

function decompressLzmaRaw(data: Buffer): Promise<Buffer> {
  // Read LZMA1 properties from the stream (same as OTClient)
  const lclppb = data[0];
  const lc = lclppb % 9;
  const remainder = Math.floor(lclppb / 9);
  const lp = remainder % 5;
  const pb = Math.floor(remainder / 5);

  // Dictionary size (4 bytes, little-endian)
  const dictSize = data.readUInt32LE(1);

  // Skip: 1 (lclppb) + 4 (dict) + 8 (cip compressed size) = 13 bytes
  const compressedData = data.subarray(13);

  return new Promise((resolve, reject) => {
    const decoder = lzma.createStream('rawDecoder', {
      filters: [{
        id: lzma.FILTER_LZMA1,
        lc, lp, pb,
        dict_size: dictSize,
      }],
    });

    const chunks: Buffer[] = [];
    decoder.on('data', (chunk: Buffer) => chunks.push(chunk));
    decoder.on('end', () => resolve(Buffer.concat(chunks)));
    decoder.on('error', (err: Error) => reject(err));

    decoder.write(compressedData);
    decoder.end();
  });
}

function postProcessPixels(bmpData: Buffer): Buffer {
  // Read BMP data offset from BMP header (bytes 10-13)
  const bmpDataOffset = bmpData.readUInt32LE(10);

  if (bmpDataOffset + BYTES_IN_SHEET > bmpData.length) {
    throw new Error(`BMP data offset ${bmpDataOffset} out of bounds (buffer size: ${bmpData.length})`);
  }

  const pixels = Buffer.from(bmpData.subarray(bmpDataOffset, bmpDataOffset + BYTES_IN_SHEET));

  // BGR → RGB swap + magenta → transparent
  for (let i = 0; i < BYTES_IN_SHEET; i += 4) {
    // Swap B and R
    const b = pixels[i];
    const r = pixels[i + 2];
    pixels[i] = r;
    pixels[i + 2] = b;

    // Check for magenta (after swap: R=0xFF, G=0x00, B=0xFF)
    if (pixels[i] === 0xFF && pixels[i + 1] === 0x00 && pixels[i + 2] === 0xFF) {
      pixels[i] = 0x00;
      pixels[i + 1] = 0x00;
      pixels[i + 2] = 0x00;
      pixels[i + 3] = 0x00;
    }
  }

  // Vertical flip
  const tempLine = Buffer.alloc(SHEET_WIDTH_BYTES);
  const halfHeight = SHEET_SIZE / 2;
  for (let y = 0; y < halfHeight; y++) {
    const topOffset = y * SHEET_WIDTH_BYTES;
    const bottomOffset = (SHEET_SIZE - 1 - y) * SHEET_WIDTH_BYTES;

    pixels.copy(tempLine, 0, topOffset, topOffset + SHEET_WIDTH_BYTES);
    pixels.copy(pixels, topOffset, bottomOffset, bottomOffset + SHEET_WIDTH_BYTES);
    tempLine.copy(pixels, bottomOffset);
  }

  return pixels;
}

async function convertSheet(entry: CatalogEntry): Promise<void> {
  const inputPath = path.join(INPUT_DIR, entry.file);
  const outputFile = entry.file.replace('.bmp.lzma', '.png');
  const outputPath = path.join(OUTPUT_DIR, outputFile);

  if (fs.existsSync(outputPath)) return;

  const raw = fs.readFileSync(inputPath);
  const afterHeader = skipCipHeader(raw);
  const bmpData = await decompressLzmaRaw(afterHeader);
  const pixels = postProcessPixels(bmpData);

  await sharp(pixels, {
    raw: { width: SHEET_SIZE, height: SHEET_SIZE, channels: 4 },
  })
    .png()
    .toFile(outputPath);
}

async function main() {
  const catalog: CatalogEntry[] = JSON.parse(
    fs.readFileSync(path.join(INPUT_DIR, 'catalog-content.json'), 'utf-8')
  );

  const spriteEntries = catalog.filter((e) => e.type === 'sprite');
  console.log(`Found ${spriteEntries.length} sprite sheets to convert`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let done = 0;
  const total = spriteEntries.length;
  const BATCH_SIZE = 20;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = spriteEntries.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (entry) => {
        try {
          await convertSheet(entry);
          done++;
          if (done % 100 === 0 || done === total) {
            console.log(`Progress: ${done}/${total}`);
          }
        } catch (err) {
          console.error(`Failed to convert ${entry.file}:`, err);
        }
      })
    );
  }

  // Generate new catalog-content.json: convert sprite filenames, keep other entries as-is
  const outputCatalog = catalog.map((entry) => {
    if (entry.type === 'sprite') {
      return {
        ...entry,
        file: entry.file.replace('.bmp.lzma', '.png'),
      }
    }
    // Copy non-sprite files (e.g. appearances.dat) to output dir
    const src = path.join(INPUT_DIR, entry.file)
    const dst = path.join(OUTPUT_DIR, entry.file)
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.copyFileSync(src, dst)
    }
    return entry
  });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog-content.json'),
    JSON.stringify(outputCatalog, null, 2)
  );

  console.log('Done!');
}

main().catch(console.error);
