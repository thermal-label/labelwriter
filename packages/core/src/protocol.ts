import { padBitmap, cropBitmap, getRow, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { LabelWriterDevice, LabelWriterPrintOptions, Density } from './types.js';

export function buildReset(): Uint8Array {
  return new Uint8Array([0x1b, 0x40]);
}

export function buildSetBytesPerLine(n: number): Uint8Array {
  return new Uint8Array([0x1b, 0x44, n]);
}

export function buildSetLabelLength(dots: number): Uint8Array {
  return new Uint8Array([0x1b, 0x4c, dots & 0xff, (dots >> 8) & 0xff]);
}

export function buildDensity(density: Density): Uint8Array {
  const byte =
    density === 'light' ? 0x63 : density === 'medium' ? 0x64 : density === 'high' ? 0x67 : 0x65;
  return new Uint8Array([0x1b, byte]);
}

export function buildMode(mode: 'text' | 'graphics'): Uint8Array {
  return new Uint8Array([0x1b, mode === 'graphics' ? 0x69 : 0x68]);
}

export function buildFormFeed(): Uint8Array {
  return new Uint8Array([0x1b, 0x45]);
}

export function buildShortFormFeed(): Uint8Array {
  return new Uint8Array([0x1b, 0x47]);
}

export function buildSelectRoll(roll: 0 | 1): Uint8Array {
  return new Uint8Array([0x1b, 0x71, roll]);
}

export function buildJobHeader(jobId: number): Uint8Array {
  return new Uint8Array([
    0x1b,
    0x73,
    jobId & 0xff,
    (jobId >> 8) & 0xff,
    (jobId >> 16) & 0xff,
    (jobId >> 24) & 0xff,
  ]);
}

export function buildStatusRequest(): Uint8Array {
  return new Uint8Array([0x1b, 0x41]);
}

export function buildErrorRecovery(): Uint8Array {
  const buf = new Uint8Array(87);
  buf.fill(0x1b, 0, 85);
  buf[85] = 0x1b;
  buf[86] = 0x41;
  return buf;
}

export function buildRasterRow(rowBytes: Uint8Array, compress = false): Uint8Array {
  if (!compress) {
    const out = new Uint8Array(1 + rowBytes.length);
    out[0] = 0x16;
    out.set(rowBytes, 1);
    return out;
  }

  const rle: number[] = [0x17];
  const totalBits = rowBytes.length * 8;
  let i = 0;
  while (i < totalBits) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = 7 - (i % 8);
    const bit = ((rowBytes[byteIdx] ?? 0) >> bitIdx) & 1;
    let run = 1;
    while (run < 128 && i + run < totalBits) {
      const ni = i + run;
      const nb = Math.floor(ni / 8);
      const nbit = 7 - (ni % 8);
      const nextBit = ((rowBytes[nb] ?? 0) >> nbit) & 1;
      if (nextBit !== bit) break;
      run++;
    }
    rle.push((bit << 7) | (run - 1));
    i += run;
  }
  return new Uint8Array(rle);
}

function fitBitmapWidth(bitmap: LabelBitmap, targetWidth: number): LabelBitmap {
  if (bitmap.widthPx === targetWidth) return bitmap;
  if (bitmap.widthPx < targetWidth) {
    return padBitmap(bitmap, { right: targetWidth - bitmap.widthPx });
  }
  return cropBitmap(bitmap, 0, 0, targetWidth, bitmap.heightPx);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

export function encodeLabel(
  device: LabelWriterDevice,
  bitmap: LabelBitmap,
  options: LabelWriterPrintOptions = {},
): Uint8Array {
  const { density = 'normal', mode = 'text', compress = false, copies = 1, roll, jobId } = options;

  const fitted = fitBitmapWidth(bitmap, device.headDots);

  const parts: Uint8Array[] = [];

  if (device.protocol === '550') {
    const id = jobId ?? Date.now() & 0xffffffff;
    parts.push(buildJobHeader(id));
  }

  parts.push(buildReset());
  parts.push(buildSetBytesPerLine(device.bytesPerRow));
  parts.push(buildDensity(density));
  parts.push(buildMode(mode));
  parts.push(buildSetLabelLength(fitted.heightPx));

  if (roll !== undefined) {
    parts.push(buildSelectRoll(roll));
  }

  const rasterRows: Uint8Array[] = [];
  for (let y = 0; y < fitted.heightPx; y++) {
    const row = getRow(fitted, y);
    rasterRows.push(buildRasterRow(row, compress));
  }

  const rasterBlock = concat(...rasterRows);

  for (let c = 0; c < copies; c++) {
    parts.push(rasterBlock);
    parts.push(buildFormFeed());
  }

  return concat(...parts);
}
