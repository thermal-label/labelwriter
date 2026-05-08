import { createBitmap, padBitmap, cropBitmap, getRow, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { DeviceEntry, MediaDescriptor, PrintEngine } from '@thermal-label/contracts';
import { UnsupportedOperationError, getPrintableArea } from '@thermal-label/contracts';
import { buildPrinterStream } from '@thermal-label/d1-core';
import type { LabelWriterPrintOptions, LabelWriterTapeMedia, Density } from './types.js';
import { encode550Label } from './protocol-550.js';

/**
 * Wire byte for `ESC q 0x30` — automatic roll selection on the Twin
 * Turbo. The firmware picks an available roll. See LW 450 Series Tech
 * Ref p.16.
 */
export const ROLL_BYTE_AUTO = 0x30;

/**
 * Engine protocols this encoder + dispatch path produces correct byte
 * streams for. `lw-450` covers the entire pre-CUPS / 300-series /
 * 400-series / 450-series / EL family — the byte streams `encodeLabel`
 * emits are accepted by all of them. The 300-series firmware is known
 * to reject `ESC G` (short form feed) and unconditional `ESC q`
 * (select roll); the encoder never emits either for single-engine
 * devices, so the distinction does not surface here. If a future
 * code path needs to emit one of those bytes selectively, model the
 * firmware quirk as an `engine.capabilities` flag (see
 * `LabelWriterEngineCapabilities`) rather than reintroducing a
 * separate protocol tag.
 *
 * `lw-550` is dispatched to `protocol-550.ts` — a fundamentally
 * different print job structure (ESC s / ESC n / ESC D 12-byte header
 * / ESC Q) that does not share bytes with the 450 family. `d1-tape`
 * (Duo's tape side) is dispatched to `@thermal-label/d1-core`'s
 * `buildPrinterStream` — same encoder the labelmanager driver uses,
 * since the Duo's tape engine is electrically a LabelManager.
 */
const SUPPORTED_PROTOCOLS = new Set(['lw-450', 'lw-550', 'd1-tape']);

/**
 * Whether *this module's* `encodeLabel` produces a correct byte stream
 * for a given engine. Adapters use this to filter the device's
 * engines down to drivable ones at construction time.
 */
export function isEngineDrivable(engine: PrintEngine): boolean {
  return SUPPORTED_PROTOCOLS.has(engine.protocol);
}

/**
 * Whether an engine speaks the D1 tape protocol (the Duo's tape
 * side). Used by adapters to route status queries through d1-core's
 * 1-byte parser instead of the 450/550 multi-byte parsers.
 */
export function isDuoTapeEngine(engine: PrintEngine): boolean {
  return engine.protocol === 'd1-tape';
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

/** Convert mm to dots at the given DPI, rounding to the nearest dot. */
function mmToDots(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Compose the wire bitmap for the LabelWriter family per plan 08 §6
 * (Labelwriter subsection): **send fewer rows** for the leading /
 * trailing dead zones (LW's head sits past the leading edge after
 * form-feed and cannot reverse-feed); cross-feed pad with white
 * columns inside `headDots`-wide rows. Result is `headDots` ×
 * `wireRows` where `wireRows = bitmap.heightPx − leadingDots −
 * trailingDots`. LW labels are left-aligned, so the label's leftmost
 * reachable dot lands at wire-bitmap col `leftDots`.
 *
 * When `getPrintableArea(engine, media)` returns all zeros (today's
 * state — no `printableArea` populated on any DEVICES entry), this
 * collapses to the previous `fitBitmapWidth` behaviour: pad to
 * `headDots` width on the right when narrower, crop when wider, all
 * rows passed through. Wire output is byte-identical to the
 * pre-plan-08 encoder until someone populates real values.
 */
function composeWireBitmap(
  bitmap: LabelBitmap,
  engine: PrintEngine,
  media: MediaDescriptor | undefined,
): LabelBitmap {
  const headDots = engine.headDots;
  const dpi = engine.dpi;
  // Chassis-mechanical dead zones come from the engine descriptor (with
  // per-roll media-tag override applied by `getPrintableArea` — LW 5xx
  // NFC tag exposes per-SKU offsets). Operator-facing per-call overrides
  // are no longer plumbed here; drivers respect the registry-resolved
  // values directly.
  const { leading, trailing, left, right } = getPrintableArea(engine, media);
  const leadingDots = mmToDots(leading, dpi);
  const trailingDots = mmToDots(trailing, dpi);
  const leftDots = mmToDots(left, dpi);
  const rightDots = mmToDots(right, dpi);

  // Source label width is whatever fits in the head — wider authored
  // bitmaps are cropped (preserves today's "wider than head crops to
  // head" behaviour); narrower ones flow into the head's leftmost
  // dots and the unreached pins stay zero.
  const labelWidthDots = Math.min(bitmap.widthPx, headDots);

  // Feed direction: skip leading + trailing dead-zone rows. Wire
  // bitmap is shorter than the authored bitmap by exactly the dead-
  // zone budget. Clamp at zero in case a future caller hands in a
  // bitmap shorter than the dead-zone budget — the encoder shouldn't
  // explode on a degenerate input.
  const wireRows = Math.max(0, bitmap.heightPx - leadingDots - trailingDots);
  if (wireRows === 0) return { widthPx: headDots, heightPx: 0, data: new Uint8Array(0) };

  // Cross-feed: copy authored cols [leftDots .. labelWidthDots − rightDots]
  // (clamped at zero), preserving the left dead-zone as white columns.
  const sourceColStart = Math.min(leftDots, labelWidthDots);
  const sourceColEnd = Math.max(sourceColStart, labelWidthDots - rightDots);
  const sourceColCount = sourceColEnd - sourceColStart;

  // Fast path — all-zero dead-zone is the only state that ships
  // today, and we must emit byte-identical output. The crop+pad
  // pipeline below would also be byte-identical in that case, but
  // staying on the original code path keeps this commit's behavioural
  // surface zero.
  if (leadingDots === 0 && trailingDots === 0 && leftDots === 0 && rightDots === 0) {
    if (bitmap.widthPx === headDots) return bitmap;
    if (bitmap.widthPx < headDots) {
      return padBitmap(bitmap, { right: headDots - bitmap.widthPx });
    }
    return cropBitmap(bitmap, 0, 0, headDots, bitmap.heightPx);
  }

  // Source slice: the authored content that survives the dead-zone.
  const slice =
    sourceColCount > 0
      ? cropBitmap(bitmap, sourceColStart, leadingDots, sourceColCount, wireRows)
      : createBitmap(0, wireRows);

  // Cross-feed compose: position the slice into the head row.
  // labelLeftEdgeDot is 0 for LW (left-aligned), so the slice sits at
  // wire col `sourceColStart` (= leftDots, by construction). Right pad
  // fills out to headDots; with non-zero rightDots the rightmost
  // `rightDots` cols of the *label* stay white, and any head pins past
  // labelWidthDots also stay white (head fires harmlessly into air).
  const leftPad = sourceColStart;
  const rightPad = headDots - sourceColStart - sourceColCount;
  if (leftPad === 0 && rightPad === 0) return slice;
  return padBitmap(slice, { left: leftPad, right: rightPad });
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
  media?: MediaDescriptor,
): Uint8Array {
  const { density = 'normal', mode = 'text', compress = false, copies = 1 } = options;

  const { engine, selectRollByte } = resolveEngine(device, options.engine);
  assertEncoderSupports(engine, device.key);

  // 550 family uses a fundamentally different job structure (job
  // header / per-label header / job trailer), so dispatch out before
  // the 450-shaped path.
  if (engine.protocol === 'lw-550') {
    return encode550Label(device, bitmap, options, media);
  }

  // D1 tape (Duo's tape side) — same encoder the labelmanager driver
  // uses. Tape media's pre-computed `tapeColour` (ESC C selector) maps
  // to d1-core's `options.tapeType`; if absent, d1-core derives from
  // the media's `text` / `background` colours.
  if (engine.protocol === 'd1-tape') {
    if (media && (media as { type?: string }).type !== 'tape') {
      throw new Error(
        `Tape engine requires media of type "tape" (got "${String((media as { type?: string }).type)}").`,
      );
    }
    const tapeMedia = media as LabelWriterTapeMedia | undefined;
    const d1Options: Parameters<typeof buildPrinterStream>[2] = {};
    if (options.copies !== undefined) d1Options.copies = options.copies;
    if (tapeMedia?.tapeColour !== undefined) d1Options.tapeType = tapeMedia.tapeColour;
    return buildPrinterStream(bitmap, engine, d1Options, tapeMedia);
  }

  const headDots = engine.headDots;
  const bytesPerRow = headDots / 8;
  // Cross-feed-pad / leading-skip / trailing-skip per plan 08 §6.
  // Resolved entirely from `engine.printableArea` (with per-roll media
  // override applied internally by `getPrintableArea`).
  const fitted = composeWireBitmap(bitmap, engine, media);

  const parts: Uint8Array[] = [];

  parts.push(buildReset());
  parts.push(buildSetBytesPerLine(bytesPerRow));
  parts.push(buildDensity(density));
  parts.push(buildMode(mode));
  // Label length = the actual label feed pitch the printer's form-feed
  // and cut sequencing need to know. Order:
  //   1. `options.labelLengthDots` — caller-supplied override, used
  //      when the caller has pre-stripped dead-zone rows (so
  //      `bitmap.heightPx` is shorter than the label pitch). Pass
  //      `media.lengthDots` here when stripping.
  //   2. `bitmap.heightPx` — the input bitmap height when the caller
  //      hasn't pre-stripped (encoder does the strip itself OR no
  //      strip is happening).
  // Sending `fitted.heightPx` (the post-strip wire height) would tell
  // the printer the label is shorter than it really is and cause the
  // form-feed offset to compound across consecutive prints.
  parts.push(buildSetLabelLength(options.labelLengthDots ?? bitmap.heightPx));

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
