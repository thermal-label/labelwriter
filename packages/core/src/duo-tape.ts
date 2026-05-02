import { padBitmap, cropBitmap, getRow, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { DeviceEntry, PrintEngine } from '@thermal-label/contracts';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import type { LabelWriterPrintOptions } from './types.js';

/**
 * Wire-protocol encoder for the LabelWriter Duo's tape engine.
 *
 * The Duo presents two USB Printer-class interfaces on a single
 * `vid:pid` (`0x0922:0x0023`): a 672-dot label engine handled by
 * `protocol.ts`, and this 128- or 96-dot tape engine speaking a
 * subset of the LabelWriter command set plus three tape-specific
 * opcodes (`ESC C` set tape type, `ESC E` cut, `ESC A` 8-byte
 * status). See `LW 450 Series Technical Reference.pdf` Appendix B
 * (pages 23-25) and `plans/backlog/duo-tape-support.md`.
 *
 * This module mirrors the shape of `protocol.ts` — small `build*`
 * helpers returning `Uint8Array`, plus an `encodeDuoTapeLabel`
 * top-level encoder. The protocol is close to the LabelManager D1
 * raster format (same SYN-row framing, same ESC C / ESC D opcodes)
 * but diverges on the cut command (`ESC E` vs the LabelManager's
 * `ESC G`) and the 8-byte status reply, so we keep it as its own
 * module rather than reusing `labelmanager-core`.
 */

const TAPE_PROTOCOL = 'd1-tape';

/** Maximum tape-type selector value per PDF page 24. */
const MAX_TAPE_TYPE = 12;

/**
 * Whether an engine speaks the Duo tape protocol.
 *
 * Adapters use this to route tape engines through `encodeDuoTapeLabel`
 * instead of the label-side `encodeLabel`.
 */
export function isDuoTapeEngine(engine: PrintEngine): boolean {
  return engine.protocol === TAPE_PROTOCOL;
}

/** `ESC @` — reset all parameters to defaults. */
export function buildDuoReset(): Uint8Array {
  return new Uint8Array([0x1b, 0x40]);
}

/**
 * `ESC C n` — set tape type (heat sensitivity / colour palette).
 *
 * `n` is a selector 0..12 from the palette table in PDF page 24:
 *   0 black-on-white/clear, 1 black-on-blue, …, 12 red-on-white.
 *
 * The byte identifies what cassette is loaded so the firmware can
 * pick the right strobe profile; it does not change the printed ink
 * (ink is determined by the cassette itself).
 */
export function buildDuoSetTapeType(selector: number): Uint8Array {
  if (!Number.isInteger(selector) || selector < 0 || selector > MAX_TAPE_TYPE) {
    throw new RangeError(
      `tape-type selector must be an integer 0..${String(MAX_TAPE_TYPE)} (got ${String(selector)})`,
    );
  }
  return new Uint8Array([0x1b, 0x43, selector]);
}

/**
 * `ESC D n` — set bytes-per-line.
 *
 * Per PDF page 23, max is `headDots / 8` (12 for the 96-dot Duo,
 * 16 for the 128-dot Duo). Out-of-range values are silently clamped
 * by the firmware; we throw to surface caller bugs early.
 */
export function buildDuoBytesPerLine(n: number, headDots: number): Uint8Array {
  const max = headDots / 8;
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new RangeError(
      `bytes-per-line for ${String(headDots)}-dot head must be an integer 0..${String(max)} (got ${String(n)})`,
    );
  }
  return new Uint8Array([0x1b, 0x44, n]);
}

/**
 * `ESC E` — cut tape.
 *
 * Per PDF page 25 this *must* be sent at the end of every label
 * — the Duo tape engine has no feed-without-cut command.
 */
export function buildDuoCutTape(): Uint8Array {
  return new Uint8Array([0x1b, 0x45]);
}

/** `ESC A` — request the 8-byte status response. See `duo-tape-status.ts`. */
export function buildDuoStatusRequest(): Uint8Array {
  return new Uint8Array([0x1b, 0x41]);
}

/** `SYN` + row bytes — one raster line. */
export function buildDuoRasterRow(rowBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + rowBytes.length);
  out[0] = 0x16;
  out.set(rowBytes, 1);
  return out;
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

/**
 * Tape-side print options.
 *
 * `tapeType` is the `ESC C` selector (0..12) — usually derived from
 * the loaded cassette's media descriptor rather than passed by the
 * caller; defaults to 0 (black-on-white/clear) when omitted.
 *
 * `engine` follows the same routing rules as the label side. On a
 * Duo, callers typically pass `'tape'` to disambiguate from the
 * label engine.
 */
export interface DuoTapePrintOptions extends Pick<LabelWriterPrintOptions, 'engine' | 'copies'> {
  tapeType?: number;
}

function resolveTapeEngine(device: DeviceEntry, requested: string | undefined): PrintEngine {
  const tapeEngines = device.engines.filter(isDuoTapeEngine);
  if (tapeEngines.length === 0) {
    throw new UnsupportedOperationError(
      `encodeDuoTapeLabel on ${device.key}`,
      `device has no engine with protocol "${TAPE_PROTOCOL}".`,
    );
  }
  if (requested === undefined || requested === 'auto') {
    const first = tapeEngines[0];
    if (!first) {
      throw new UnsupportedOperationError(
        `encodeDuoTapeLabel on ${device.key}`,
        `device has no engine with protocol "${TAPE_PROTOCOL}".`,
      );
    }
    return first;
  }
  const found = device.engines.find(e => e.role === requested);
  if (!found) {
    const roles = device.engines.map(e => e.role).join(', ');
    throw new Error(
      `Device ${device.key} has no engine with role "${requested}". Available: ${roles}.`,
    );
  }
  if (!isDuoTapeEngine(found)) {
    throw new UnsupportedOperationError(
      `encodeDuoTapeLabel on ${device.key} engine "${found.role}"`,
      `engine speaks protocol "${found.protocol}", not "${TAPE_PROTOCOL}". Use encodeLabel for label-side engines.`,
    );
  }
  return found;
}

/**
 * Encode a complete tape print job.
 *
 * Output is raw USB Printer-class bytes for the tape interface
 * (no HID framing). Caller is responsible for opening the right
 * `bInterfaceNumber` — see `engine.bind.usb.bInterfaceNumber` and
 * `@thermal-label/transport`'s `UsbTransport.open(vid, pid, opts)`.
 *
 * Wire layout per copy:
 *   ESC @            (reset)
 *   ESC C n          (tape type)
 *   ESC D bytesPerLine
 *   <SYN> row …      (one per raster line, padded/cropped to head width)
 *   ESC E            (cut)
 *
 * The bitmap must already be in head-aligned orientation (caller's
 * responsibility — typically via `pickRotation` + `renderImage`).
 * Width is fitted to `engine.headDots` by right-padding or cropping;
 * height is preserved.
 */
export function encodeDuoTapeLabel(
  device: DeviceEntry,
  bitmap: LabelBitmap,
  options: DuoTapePrintOptions = {},
): Uint8Array {
  const engine = resolveTapeEngine(device, options.engine);
  const headDots = engine.headDots;
  const bytesPerRow = headDots / 8;
  const fitted = fitBitmapWidth(bitmap, headDots);
  const tapeType = options.tapeType ?? 0;
  const copies = Math.max(1, options.copies ?? 1);

  const rasterRows: Uint8Array[] = [];
  for (let y = 0; y < fitted.heightPx; y++) {
    rasterRows.push(buildDuoRasterRow(getRow(fitted, y)));
  }
  const rasterBlock = concat(...rasterRows);

  const parts: Uint8Array[] = [];
  for (let c = 0; c < copies; c++) {
    parts.push(buildDuoReset());
    parts.push(buildDuoSetTapeType(tapeType));
    parts.push(buildDuoBytesPerLine(bytesPerRow, headDots));
    parts.push(rasterBlock);
    parts.push(buildDuoCutTape());
  }
  return concat(...parts);
}
