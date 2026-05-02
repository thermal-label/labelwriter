import { padBitmap, cropBitmap, getRow, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { DeviceEntry, PrintEngine } from '@thermal-label/contracts';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import type { LabelWriterPrintOptions, Density } from './types.js';
import { encode550Label } from './protocol-550.js';

/**
 * Wire byte for `ESC q 0x30` — automatic roll selection on the Twin
 * Turbo. The firmware picks an available roll. See LW 450 Series Tech
 * Ref p.16.
 */
export const ROLL_BYTE_AUTO = 0x30;

/**
 * Engine protocols this encoder + dispatch path produces correct byte
 * streams for. `lw-330` matches `lw-450` byte-for-byte minus the
 * `ESC G` / `ESC q` commands the 300-series firmware rejects (per
 * SE450 Tech Ref); the encoder never emits those for single-engine
 * 300-series devices. `lw-550` is dispatched to `protocol-550.ts`
 * — a fundamentally different print job structure (ESC s / ESC n /
 * ESC D 12-byte header / ESC Q) that does not share bytes with the
 * 450 family. `d1-tape` (Duo's tape side) is handled by `duo-tape.ts`
 * and routed via `isDuoTapeEngine` rather than `isEngineDrivable` here.
 */
const SUPPORTED_PROTOCOLS = new Set(['lw-330', 'lw-450', 'lw-550']);

/**
 * Whether *this module's* `encodeLabel` produces a correct byte stream
 * for a given engine. Adapters use this together with `isDuoTapeEngine`
 * to route engines to the right encoder (label vs tape).
 */
export function isEngineDrivable(engine: PrintEngine): boolean {
  return SUPPORTED_PROTOCOLS.has(engine.protocol);
}

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

/**
 * `ESC q <n>` — select roll on the Twin Turbo. Per LW 450 Series Tech
 * Ref p.16, `n` is one of:
 *   `0x30` ('0') — automatic selection (firmware picks)
 *   `0x31` ('1') — first physical roll  (left)
 *   `0x32` ('2') — second physical roll (right)
 *
 * Twin Turbo engine entries store `0x31` / `0x32` directly in
 * `bind.address`, so the encoder hands the byte through unchanged.
 * `ROLL_BYTE_AUTO` covers the auto case.
 */
export function buildSelectRoll(byte: number): Uint8Array {
  return new Uint8Array([0x1b, 0x71, byte]);
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

interface ResolvedEngine {
  engine: PrintEngine;
  /**
   * Wire byte to prepend as `ESC q <byte>` for in-band engine
   * selection, or `undefined` when the device's protocol does not use
   * an address byte (single-engine printers, Duo's bInterfaceNumber
   * routing).
   */
  selectRollByte: number | undefined;
}

function resolveEngine(device: DeviceEntry, requested: string | undefined): ResolvedEngine {
  const engines = device.engines;
  const first = engines[0];
  if (!first) {
    throw new Error(`Device ${device.key} has no engines declared.`);
  }

  const hasAddressedEngine = engines.some(e => e.bind?.address !== undefined);

  if (requested === 'auto') {
    return {
      engine: first,
      selectRollByte: hasAddressedEngine ? ROLL_BYTE_AUTO : undefined,
    };
  }

  if (requested !== undefined) {
    const found = engines.find(e => e.role === requested);
    if (!found) {
      const roles = engines.map(e => e.role).join(', ');
      throw new Error(
        `Device ${device.key} has no engine with role "${requested}". Available: ${roles}.`,
      );
    }
    return { engine: found, selectRollByte: found.bind?.address };
  }

  // requested === undefined: keep back-compat — use the first engine
  // for geometry. On Twin-Turbo-style devices (multiple engines with
  // address byte) emit auto so the firmware picks; on Duo-style
  // devices (interface routing, no address byte) emit nothing.
  return {
    engine: first,
    selectRollByte: hasAddressedEngine ? ROLL_BYTE_AUTO : undefined,
  };
}

function assertEncoderSupports(engine: PrintEngine, deviceKey: string): void {
  if (!SUPPORTED_PROTOCOLS.has(engine.protocol)) {
    throw new UnsupportedOperationError(
      `encodeLabel on ${deviceKey} engine "${engine.role}"`,
      `protocol "${engine.protocol}" is not handled by the labelwriter encoder. Supported: ${[...SUPPORTED_PROTOCOLS].join(', ')}.`,
    );
  }
}

export function encodeLabel(
  device: DeviceEntry,
  bitmap: LabelBitmap,
  options: LabelWriterPrintOptions = {},
): Uint8Array {
  const { density = 'normal', mode = 'text', compress = false, copies = 1 } = options;

  const { engine, selectRollByte } = resolveEngine(device, options.engine);
  assertEncoderSupports(engine, device.key);

  // 550 family uses a fundamentally different job structure (job
  // header / per-label header / job trailer), so dispatch out before
  // the 450-shaped path.
  if (engine.protocol === 'lw-550') {
    return encode550Label(device, bitmap, options);
  }

  const headDots = engine.headDots;
  const bytesPerRow = headDots / 8;
  const fitted = fitBitmapWidth(bitmap, headDots);

  const parts: Uint8Array[] = [];

  parts.push(buildReset());
  parts.push(buildSetBytesPerLine(bytesPerRow));
  parts.push(buildDensity(density));
  parts.push(buildMode(mode));
  parts.push(buildSetLabelLength(fitted.heightPx));

  if (selectRollByte !== undefined) {
    parts.push(buildSelectRoll(selectRollByte));
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
