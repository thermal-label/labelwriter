import { padBitmap, cropBitmap, getRow, type LabelBitmap } from '@mbtech-nl/bitmap';
import type {
  DeviceEntry,
  MediaDescriptor,
  PrintEngine,
  PrinterError,
  PrinterStatus,
  StatusDetail,
  Transport,
} from '@thermal-label/contracts';
import type { LabelWriterPrintOptions, Density } from './types.js';

/**
 * Wire-protocol encoder for the LabelWriter 550 family
 * (LW 550 / 550 Turbo / 5XL).
 *
 * The 550 spec (`LW 550 Technical Reference.pdf`, Sanford 2021)
 * describes a fundamentally different print job structure than the
 * 450 family — different command bytes, different feed semantics, an
 * explicit job header / trailer, and a per-label `ESC D` block with
 * a 12-byte header in front of the raster payload. Trying to share
 * the classic encoder with `if protocol === 'lw5-raster'` branches produced
 * a job stream that the 550 firmware cannot parse; this module is
 * the clean fork.
 *
 * Wire layout — see `compose550Job` for the segmented form the driver
 * actually writes. The 550 needs a status handshake between each
 * label's footer and the job trailer, so a monolithic write hangs:
 *
 *   ESC s <jobID:u32>                                    (job header)
 *   ESC h | ESC i                                        (mode)
 *   ESC C <duty:u8>                                      (density)
 *
 *   per copy (label index 0..N-1):
 *     ESC n <index:u16>                                  (label header)
 *     ESC D <bpp:u8> <align:u8> <width:u32> <height:u32> (label header)
 *     <raster bytes>                                     (no SYN prefix)
 *     ESC G                                              (label footer)
 *     [ driver: ESC A <lock> -> read 32-byte status ]    (footer handshake)
 *
 *   ESC E                                                (feed to tear)
 *   ESC Q                                                (job trailer)
 *
 * Spec ambiguities settled by deliberate choice:
 *
 * - **ESC L (Set Maximum Label Length)** — the spec describes it as
 *   "between normal and continuous label stock" but does not specify
 *   the parameter format. The Label Length section also clarifies
 *   that label length comes from the NFC tag for authentic media.
 *   We **omit `ESC L` entirely** and let the firmware derive length
 *   from the loaded SKU (which it does for genuine media regardless).
 *
 * - **Density mapping** — spec defines `ESC C <duty>` with 0..200%
 *   range and 100% default. The 450-family `Density` enum is
 *   `light | medium | normal | high`. Mapping chosen here:
 *   `light=70 | medium=85 | normal=100 | high=130`. Documented in
 *   `density550Percent`. Hardware-tune later if needed.
 */

/**
 * LW 550-family framing byte. Per-command opcodes (`0x73` for ESC s,
 * `0x44` for ESC D, …) stay inline in their single-call-site builders
 * — the function name already labels them. The 550 raster format
 * carries no `SYN` / `ETB` framing (see `encode550Label`), so only
 * `ESC` recurs.
 */
const ESC = 0x1b;

/** `ESC s` — Start of Print Job. 4-byte job ID, little-endian. */
export function build550JobHeader(jobId: number): Uint8Array {
  return new Uint8Array([
    ESC,
    0x73,
    jobId & 0xff,
    (jobId >> 8) & 0xff,
    (jobId >> 16) & 0xff,
    (jobId >> 24) & 0xff,
  ]);
}

/** `ESC h` (text) / `ESC i` (graphics) — Select Output Mode. */
export function build550Mode(mode: 'text' | 'graphics'): Uint8Array {
  return new Uint8Array([ESC, mode === 'graphics' ? 0x69 : 0x68]);
}

/** `ESC C <duty>` — Set Print Density (0..200, default 100). */
export function build550Density(duty: number): Uint8Array {
  if (!Number.isInteger(duty) || duty < 0 || duty > 200) {
    throw new RangeError(`density duty must be 0..200 (got ${String(duty)})`);
  }
  return new Uint8Array([ESC, 0x43, duty]);
}

/** `ESC e` — Reset Print Density to 100 %. */
export function build550ResetDensity(): Uint8Array {
  return new Uint8Array([ESC, 0x65]);
}

/** `ESC T <speed>` — Content Type / speed mode. 0x10 normal, 0x20 high. */
export function build550ContentType(speed: 'normal' | 'high'): Uint8Array {
  return new Uint8Array([ESC, 0x74, speed === 'high' ? 0x20 : 0x10]);
}

/**
 * `ESC n <index>` — Set Label Index. 2-byte u16, little-endian.
 *
 * The 550 status frame echoes the label index back in a u16 field
 * (status bytes 5-6), and minlux/dymon's Wireshark capture of the DYMO
 * software shows a 2-byte field on the wire. An earlier revision
 * emitted a u32 here — two bytes too wide — which left two stray `0x00`
 * bytes in the job stream ahead of `ESC D` and can desync the
 * firmware's command parser.
 */
export function build550LabelIndex(index: number): Uint8Array {
  return new Uint8Array([ESC, 0x6e, index & 0xff, (index >> 8) & 0xff]);
}

/**
 * `ESC D` Start of Label Print Data — 12-byte header followed by raster
 * payload. Per spec p.12:
 *
 *   Byte 0     ESC (0x1b)
 *   Byte 1     D   (0x44)
 *   Byte 2     BPP (default 1)
 *   Byte 3     Alignment (2 = bottom)
 *   Bytes 4-7  Width = number of lines (label length in raster rows)
 *   Bytes 8-11 Height = number of dots per line (head width)
 *   Bytes 12+  Print data — width * roundup(height*bpp/8) bytes
 *
 * Note the axis convention: spec "Width" is the feed direction
 * (= our `bitmap.heightPx`); spec "Height" is across the head
 * (= our `bitmap.widthPx`). The diagram on p.12 makes this
 * concrete — dot 0 is at the bottom of the head; raster rows
 * advance with the feed.
 */
export function build550LabelHeader(
  widthLines: number,
  heightDots: number,
  options: { bpp?: number; alignment?: number } = {},
): Uint8Array {
  const bpp = options.bpp ?? 1;
  const alignment = options.alignment ?? 2;
  return new Uint8Array([
    ESC,
    0x44,
    bpp,
    alignment,
    widthLines & 0xff,
    (widthLines >> 8) & 0xff,
    (widthLines >> 16) & 0xff,
    (widthLines >> 24) & 0xff,
    heightDots & 0xff,
    (heightDots >> 8) & 0xff,
    (heightDots >> 16) & 0xff,
    (heightDots >> 24) & 0xff,
  ]);
}

/** `ESC G` — Feed to Print Head (between labels in a multi-label job). */
export function build550ShortFormFeed(): Uint8Array {
  return new Uint8Array([ESC, 0x47]);
}

/** `ESC E` — Feed to Tear Position (last label of a job). */
export function build550FormFeed(): Uint8Array {
  return new Uint8Array([ESC, 0x45]);
}

/** `ESC Q` — End of Print Job. Mandatory trailer; releases host lock. */
export function build550EndJob(): Uint8Array {
  return new Uint8Array([ESC, 0x51]);
}

/**
 * `ESC A <lock>` — Request Print Engine Status.
 *
 * Lock semantics per spec p.13:
 *   0 = no lock (heartbeat / status query during error / between-label query)
 *   1 = lock interface for printing (acquire before sending a job)
 *   2 = status query between labels in an active job (does not block)
 */
export function build550StatusRequest(lock: 0 | 1 | 2 = 0): Uint8Array {
  return new Uint8Array([ESC, 0x41, lock]);
}

/** `ESC U` — Get SKU Information. Response is a 63-byte structure. */
export function build550GetSku(): Uint8Array {
  return new Uint8Array([ESC, 0x55]);
}

/** `ESC V` — Get Engine Version. Response is a 34-byte HW/FW/PID block. */
export function build550GetVersion(): Uint8Array {
  return new Uint8Array([ESC, 0x56]);
}

/** `ESC @` — Restart Print Engine. **Destructive — reboots the engine.** */
export function build550Restart(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

/**
 * 550 recovery sequence — `ESC Q` to release any pending job state
 * and the host print lock. Soft path; safe to send at any time.
 *
 * For a hard recovery (`ESC @` reboot), use `build550Restart()`
 * separately — it will lose any buffered data and is documented as
 * destructive.
 */
export function build550Recovery(): Uint8Array {
  return new Uint8Array([ESC, 0x51]);
}

/**
 * `ESC *` — Restore Print Engine Factory Settings.
 *
 * **Destructive — wipes user-tunable settings.** Not exposed on the
 * driver adapter; callers who deliberately want to factory-reset the
 * engine can write these bytes directly via `transport.write()`.
 */
export function build550FactoryReset(): Uint8Array {
  return new Uint8Array([ESC, 0x2a]);
}

/**
 * `ESC o <count>` — Set Label Count.
 *
 * Per spec p.20, single-byte `count` (0..255). Use case unclear from
 * the spec — likely overrides the on-printer remaining-labels
 * counter. Exposed as a low-level builder; no driver method wraps it.
 */
export function build550SetLabelCount(count: number): Uint8Array {
  if (!Number.isInteger(count) || count < 0 || count > 0xff) {
    throw new RangeError(`label count must be an integer 0..255 (got ${String(count)})`);
  }
  return new Uint8Array([ESC, 0x6f, count]);
}

/**
 * Print-status byte 0 sub-state values per spec p.13-14:
 *   0..3 — sub-states once the lock is granted to the active host
 *          (0=idle, 1=printing, 2=error, 3=cancel)
 *   4    — printer just woke from standby
 *   5    — status reply *before* the lock is granted to the active
 *          host (i.e. the lock is held by someone else, or the
 *          printer hasn't decided yet)
 *
 * `LOCK_NOT_GRANTED = 5` is the load-bearing one — it tells the
 * caller "your `ESC A 1` request did not give you the lock; another
 * host is in charge."
 */
export const PRINT_STATUS_LOCK_NOT_GRANTED = 5;

/** Length of the SKU info response from `ESC U`. */
export const SKU_INFO_BYTE_COUNT = 63;
/** Length of the engine version response from `ESC V`. */
export const ENGINE_VERSION_BYTE_COUNT = 34;
/** Length of the print status response from `ESC A`. */
export const STATUS_BYTE_COUNT_550 = 32;

/**
 * Density-percent mapping for the family-level `Density` enum on the
 * 550. Exported so callers can introspect; pass an explicit number
 * to `build550Density` to bypass.
 */
export function density550Percent(density: Density): number {
  switch (density) {
    case 'light':
      return 70;
    case 'medium':
      return 85;
    case 'high':
      return 130;
    case 'normal':
    default:
      return 100;
  }
}

/**
 * Fit the authored bitmap to the engine's head width for the
 * LabelWriter 550 family. Width-only — see `composeWireBitmap` in
 * `protocol.ts` for the dead-zone rationale; the 5xx fork mirrors the
 * same width-only contract so callers see identical behaviour across
 * the LW lineup.
 */
function composeWireBitmap550(bitmap: LabelBitmap, engine: PrintEngine): LabelBitmap {
  const headDots = engine.headDots;
  if (bitmap.widthPx === headDots) return bitmap;
  if (bitmap.widthPx < headDots) {
    return padBitmap(bitmap, { right: headDots - bitmap.widthPx });
  }
  return cropBitmap(bitmap, 0, 0, headDots, bitmap.heightPx);
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
 * A 550 print job split into the segments an interactive write routine
 * interleaves with `ESC A` status reads. See the
 * `lw5-raster` protocol doc — "Inter-label status handshake" — for the
 * wire contract this shape encodes; `write550Job` is its driver.
 */
export interface Composed550Job {
  /** Once: `ESC s`, `ESC h`/`ESC i`, `ESC C`, optional `ESC T`. */
  preamble: Uint8Array;
  /** One per copy: `ESC n` + `ESC D` + raster + `ESC G`. */
  labels: Uint8Array[];
  /** Once, after the last label's handshake: `ESC E` + `ESC Q`. */
  finalize: Uint8Array;
}

/**
 * Compose a 550 print job as interleavable segments — see
 * `Composed550Job`. The bitmap is fitted to `headDots` (right-pad
 * narrower, crop wider) so each raster line is `headDots / 8` bytes.
 * `compress` is ignored — the 550 raster format has no `SYN` / `ETB`
 * framing.
 */
export function compose550Job(
  device: DeviceEntry,
  bitmap: LabelBitmap,
  options: LabelWriterPrintOptions = {},
  media?: MediaDescriptor,
): Composed550Job {
  // Media is no longer read by the 550 encoder — round-2 dead-zone
  // work moved canvas-sizing to the caller. Parameter kept for API
  // stability; the `void` keeps tsc + eslint quiet without renaming
  // the public arg to `_media` (which would leak into typedoc output).
  void media;
  const engine = device.engines.find(e => e.protocol === 'lw5-raster');
  if (!engine) {
    throw new Error(`Device ${device.key} has no engine with protocol "lw5-raster".`);
  }

  const headDots = engine.headDots;
  const bytesPerLine = headDots / 8;
  // Width-only fit. Dead-zone offsets live on the authoring canvas;
  // see `getPrintableCanvasDots` for the helper the harness uses.
  const fitted = composeWireBitmap550(bitmap, engine);
  const widthLines = fitted.heightPx;

  const density = options.density ?? 'normal';
  const mode = options.mode ?? 'text';
  const copies = Math.max(1, options.copies ?? 1);
  const jobId = options.jobId ?? Date.now() & 0xffffffff;

  // Pre-build the raster block; reused per copy.
  const rasterRows: Uint8Array[] = [];
  for (let y = 0; y < widthLines; y++) {
    rasterRows.push(getRow(fitted, y));
  }
  const rasterBlock = concat(...rasterRows);
  if (rasterBlock.length !== widthLines * bytesPerLine) {
    throw new Error(
      `internal: raster block size ${String(rasterBlock.length)} ≠ widthLines * bytesPerLine ${String(
        widthLines * bytesPerLine,
      )} — bitmap not head-aligned?`,
    );
  }

  const preambleParts: Uint8Array[] = [
    build550JobHeader(jobId),
    build550Mode(mode),
    build550Density(density550Percent(density)),
  ];
  if (options.speed !== undefined) {
    preambleParts.push(build550ContentType(options.speed));
  }

  // Every label ends with `ESC G` — the 550 footer the driver follows
  // with the `ESC A` status handshake. (The 450 family uses `ESC G`
  // only between copies and `ESC E` as the last copy's trailer; the
  // 550 footers every label and feeds-to-tear once, in `finalize`.)
  const labels: Uint8Array[] = [];
  for (let c = 0; c < copies; c++) {
    labels.push(
      concat(
        build550LabelIndex(c),
        build550LabelHeader(widthLines, headDots),
        rasterBlock,
        build550ShortFormFeed(),
      ),
    );
  }

  return {
    preamble: concat(...preambleParts),
    labels,
    finalize: concat(build550FormFeed(), build550EndJob()),
  };
}

/**
 * Encode a complete 550 print job as one contiguous byte array —
 * `preamble` + every `labels` segment + `finalize` from
 * `compose550Job`, with the inter-segment status handshakes omitted.
 *
 * This is the offline / test view of the job. **Real printing must go
 * through `compose550Job` + the driver's interactive routine** —
 * writing this blob in one shot hangs the 550 firmware (see
 * `Composed550Job`).
 */
export function encode550Label(
  device: DeviceEntry,
  bitmap: LabelBitmap,
  options: LabelWriterPrintOptions = {},
  media?: MediaDescriptor,
): Uint8Array {
  const job = compose550Job(device, bitmap, options, media);
  return concat(job.preamble, ...job.labels, job.finalize);
}

export interface Write550JobOptions {
  /**
   * Per-handshake read deadline, ms. Omit to delegate to the
   * transport's own policy — WebUSB has no implicit timeout, so web
   * callers should set a finite value.
   */
  handshakeReadTimeoutMs?: number;
}

/**
 * Write a composed 550 job interactively. See the `lw5-raster`
 * protocol doc — "Inter-label status handshake" — for the wire
 * contract.
 *
 * Lock byte: `0` on the last label (final query + lock release), `2`
 * between labels (host defers the read to the next iteration).
 */
export async function write550Job(
  transport: Transport,
  job: Composed550Job,
  options: Write550JobOptions = {},
): Promise<void> {
  const timeout = options.handshakeReadTimeoutMs;
  await transport.write(job.preamble);
  // A deferred `ESC A 2` reply from the previous label, not yet drained.
  let pendingHandshake = false;
  for (const [i, segment] of job.labels.entries()) {
    const isLast = i === job.labels.length - 1;
    if (pendingHandshake) {
      await transport.read(STATUS_BYTE_COUNT_550, timeout);
      pendingHandshake = false;
    }
    await transport.write(segment);
    await transport.write(build550StatusRequest(isLast ? 0 : 2));
    if (isLast) {
      // `ESC A 0` — final status query; wait for the reply.
      await transport.read(STATUS_BYTE_COUNT_550, timeout);
    } else {
      // `ESC A 2` — host does not wait; drain on the next iteration.
      pendingHandshake = true;
    }
  }
  await transport.write(job.finalize);
}

// ─────────────────────────────────────────────────────────────────
// Response parsers
// ─────────────────────────────────────────────────────────────────

/**
 * Parsed `ESC V` response — the 34-byte HW/FW/PID identity block.
 */
export interface EngineVersion {
  /** 16-char UTF-8 hardware version string (right-padded with nulls). */
  hwVersion: string;
  /** Firmware kind: `'application'` (FWAP) or `'bootloader'` (FWBL). */
  fwKind: 'application' | 'bootloader' | 'unknown';
  /** 4-char major release version. */
  fwMajor: string;
  /** 4-char minor release version. */
  fwMinor: string;
  /** 4-char release date in `MMYY` format. */
  fwReleaseDate: string;
  /** USB Product ID (u16, little-endian over bytes 32-33). */
  pid: number;
  /**
   * The raw `ESC V` response, verbatim. Mirrors `PrinterStatus.rawBytes`
   * — lets a downstream report carry the undecoded frame for triage when
   * the parse is wrong or a firmware revision adds fields.
   */
  rawBytes: Uint8Array;
}

function asciiTrim(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 0x00 || bytes[end - 1] === 0x20)) end--;
  return new TextDecoder('utf-8').decode(bytes.subarray(0, end));
}

export function parseEngineVersion(bytes: Uint8Array): EngineVersion {
  if (bytes.length < ENGINE_VERSION_BYTE_COUNT) {
    throw new Error(
      `ESC V response must be ${String(ENGINE_VERSION_BYTE_COUNT)} bytes (got ${String(bytes.length)})`,
    );
  }
  const hwVersion = asciiTrim(bytes.subarray(0, 16));
  const fwKindStr = asciiTrim(bytes.subarray(16, 20));
  const fwKind: EngineVersion['fwKind'] =
    fwKindStr === 'FWAP' ? 'application' : fwKindStr === 'FWBL' ? 'bootloader' : 'unknown';
  const fwMajor = asciiTrim(bytes.subarray(20, 24));
  const fwMinor = asciiTrim(bytes.subarray(24, 28));
  const fwReleaseDate = asciiTrim(bytes.subarray(28, 32));
  const pid = (bytes[32] ?? 0) | ((bytes[33] ?? 0) << 8);
  return { hwVersion, fwKind, fwMajor, fwMinor, fwReleaseDate, pid, rawBytes: bytes };
}

/**
 * Parsed `ESC U` response — the 63-byte NFC SKU dump.
 *
 * Field layout matches the spec table on p.16-19. All multi-byte
 * integers are little-endian.
 *
 * Geometry fields (`label*Mm`, `marker*Mm`, the `*OffsetMm` pair,
 * `linerWidthMm`, `totalLengthMm`) are **deci-millimetres** on the
 * wire and converted to true mm here. The spec table calls them
 * `1...2^16 = length in mm`, but that unit is an erratum — an
 * S0722540 (57×32 mm) roll reports 571 / 317. The deci-mm reading is
 * confirmed by on-the-wire capture, not the PDF; this is the same
 * class of spec error already noted for the status frame's
 * width/length in `support_550_devices.md` §2.3.
 */
export interface SkuInfo {
  /** Magic number `0xCAB6` — used to validate the response. */
  magic: number;
  /** Spec version byte (currently `'0'` per p.16). */
  version: number;
  /** Payload length byte. */
  length: number;
  /** CRC over payload (u16 LE, bytes 4-5). */
  crc: number;
  /** 12-char SKU number, e.g. `'30252      '`. */
  sku: string;
  /** Brand identifier — `'dymo'` for `0x00`, `'unknown'` otherwise. */
  brand: 'dymo' | 'unknown';
  /** Region code (`0xFF` = global per p.17). */
  region: number;
  material:
    | 'card'
    | 'clear'
    | 'durable'
    | 'paper'
    | 'permanent'
    | 'plastic'
    | 'removable'
    | 'time-exp'
    | 'unknown';
  labelType: 'continuous' | 'die' | 'card' | 'unknown';
  labelColor: 'clear' | 'white' | 'pink' | 'yellow' | 'green' | 'blue' | 'unknown';
  contentColor: 'black' | 'red-black' | 'unknown';
  markerType: number;
  markerPitchMm: number;
  marker1WidthMm: number;
  marker1ToStartMm: number;
  marker2WidthMm: number;
  marker2OffsetMm: number;
  verticalOffsetMm: number;
  /** Label length in mm — one decimal; deci-mm on the wire. 0 for continuous. */
  labelLengthMm: number;
  /** Label width in mm — one decimal; deci-mm on the wire. */
  labelWidthMm: number;
  printableHorizontalOffsetMm: number;
  printableVerticalOffsetMm: number;
  linerWidthMm: number;
  totalLabelCount: number;
  totalLengthMm: number;
  counterMargin: number;
  counterStrategy: 'count-up' | 'count-down' | 'unknown';
  /** Production date in `DDYY` format (per spec p.19). */
  productionDate: string;
  /** Production time in `HHMM` format. */
  productionTime: string;
  /**
   * The raw `ESC U` response, verbatim. Mirrors `PrinterStatus.rawBytes`
   * — lets a downstream report carry the undecoded frame for triage when
   * the parse is wrong or a firmware revision adds fields.
   */
  rawBytes: Uint8Array;
}

const MATERIAL_TABLE = [
  'card',
  'clear',
  'durable',
  'paper',
  'permanent',
  'plastic',
  'removable',
  'time-exp',
] as const;
const LABEL_TYPE_TABLE = ['continuous', 'die', 'card'] as const;
const LABEL_COLOR_TABLE = ['clear', 'white', 'pink', 'yellow', 'green', 'blue'] as const;
const CONTENT_COLOR_TABLE = ['black', 'red-black'] as const;

function u16le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

/**
 * Read a u16-LE geometry field and convert deci-mm → mm.
 *
 * Keeps the single decimal the NFC tag actually carries (571 → 57.1)
 * without inventing further precision. See the `SkuInfo` doc for why
 * the spec's "length in mm" is an erratum.
 */
function u16DeciMm(bytes: Uint8Array, offset: number): number {
  return u16le(bytes, offset) / 10;
}

export function parseSkuInfo(bytes: Uint8Array): SkuInfo {
  if (bytes.length < SKU_INFO_BYTE_COUNT) {
    throw new Error(
      `ESC U response must be ${String(SKU_INFO_BYTE_COUNT)} bytes (got ${String(bytes.length)})`,
    );
  }
  const magic = u16le(bytes, 0);
  const sku = asciiTrim(bytes.subarray(8, 20));
  const brand: SkuInfo['brand'] = (bytes[20] ?? 0xff) === 0x00 ? 'dymo' : 'unknown';
  const materialIdx = bytes[22] ?? 0xff;
  const labelTypeIdx = bytes[23] ?? 0xff;
  const labelColorIdx = bytes[24] ?? 0xff;
  const contentColorIdx = bytes[25] ?? 0xff;

  const counterStrategyByte = bytes[56] ?? 0xff;
  const counterStrategy: SkuInfo['counterStrategy'] =
    counterStrategyByte === 0x00
      ? 'count-up'
      : counterStrategyByte === 0x01
        ? 'count-down'
        : 'unknown';

  return {
    magic,
    version: bytes[2] ?? 0,
    length: bytes[3] ?? 0,
    crc: u16le(bytes, 4),
    sku,
    brand,
    region: bytes[21] ?? 0xff,
    material: MATERIAL_TABLE[materialIdx] ?? 'unknown',
    labelType: LABEL_TYPE_TABLE[labelTypeIdx] ?? 'unknown',
    labelColor: LABEL_COLOR_TABLE[labelColorIdx] ?? 'unknown',
    contentColor: CONTENT_COLOR_TABLE[contentColorIdx] ?? 'unknown',
    markerType: bytes[26] ?? 0,
    markerPitchMm: u16DeciMm(bytes, 28),
    marker1WidthMm: u16DeciMm(bytes, 30),
    marker1ToStartMm: u16DeciMm(bytes, 32),
    marker2WidthMm: u16DeciMm(bytes, 34),
    marker2OffsetMm: u16DeciMm(bytes, 36),
    verticalOffsetMm: u16DeciMm(bytes, 38),
    labelLengthMm: u16DeciMm(bytes, 40),
    labelWidthMm: u16DeciMm(bytes, 42),
    printableHorizontalOffsetMm: u16DeciMm(bytes, 44),
    printableVerticalOffsetMm: u16DeciMm(bytes, 46),
    linerWidthMm: u16DeciMm(bytes, 48),
    // totalLabelCount and counterMargin are counts, not lengths — no scaling.
    totalLabelCount: u16le(bytes, 50),
    totalLengthMm: u16DeciMm(bytes, 52),
    counterMargin: u16le(bytes, 54),
    counterStrategy,
    productionDate: asciiTrim(bytes.subarray(60, 62)),
    productionTime: asciiTrim(bytes.subarray(62, 64)),
    rawBytes: bytes,
  };
}

/**
 * Map a `SkuInfo` payload to a `PrinterStatus`-compatible
 * `detectedMedia` descriptor for round-tripping into the registry.
 *
 * The SKU number and dimensions are sufficient to identify the roll
 * for downstream UI ("you have X loaded"). We deliberately don't
 * extend the `MediaDescriptor` shape here; consumers that need
 * material / counter / NFC fields can read the full `SkuInfo`.
 */
export function skuInfoToMedia(sku: SkuInfo): {
  id: string;
  name: string;
  type: 'die-cut' | 'continuous';
  widthMm: number;
  heightMm?: number;
} {
  const { sku: skuNumber, labelWidthMm, labelLengthMm, labelType } = sku;
  const isContinuous = labelType === 'continuous' || labelLengthMm === 0;
  return {
    id: `sku-${skuNumber.trim() || 'unknown'}`,
    name: skuNumber.trim() || 'Unknown SKU',
    type: isContinuous ? 'continuous' : 'die-cut',
    widthMm: labelWidthMm,
    ...(isContinuous ? {} : { heightMm: labelLengthMm }),
  };
}

/**
 * Build driver-formatted `details[]` rows describing the *specific
 * loaded roll instance* from an `ESC U` SKU dump.
 *
 * These are roll-instance forensics — SKU code, material, total label
 * count, production date, counter strategy — beyond what
 * `detectedMedia` carries (which stays the catalogue-ish dimensions +
 * SKU id). The driver attaches them to the cached status so subsequent
 * `getStatus()` polls replay them in the harness diagnostics panel.
 */
export function skuInfoDetails(sku: SkuInfo): StatusDetail[] {
  const details: StatusDetail[] = [];
  const skuCode = sku.sku.trim();
  if (skuCode) details.push({ label: 'Roll SKU', value: skuCode });
  details.push({ label: 'Roll material', value: sku.material });
  details.push({ label: 'Roll label type', value: sku.labelType });
  if (sku.totalLabelCount > 0) {
    details.push({ label: 'Roll total labels', value: String(sku.totalLabelCount) });
  }
  details.push({ label: 'Roll counter', value: sku.counterStrategy });
  const prodDate = sku.productionDate.trim();
  if (prodDate) details.push({ label: 'Roll production date', value: prodDate });
  return details;
}

// ─────────────────────────────────────────────────────────────────
// Helper: compose a PrinterStatus that includes SKU-derived media
// ─────────────────────────────────────────────────────────────────

/**
 * Decorate a parsed status response with `detectedMedia` derived from
 * a freshly-fetched SKU dump. Used by the driver after `getMedia()`
 * returns, so subsequent `print()` / `createPreview()` calls have
 * something to fall back to.
 */
export function withDetectedMedia(status: PrinterStatus, sku: SkuInfo): PrinterStatus {
  const detected = skuInfoToMedia(sku);
  return {
    ...status,
    detectedMedia: detected,
  };
}

// Re-export for symmetry with `duo-tape-status`. The status layout
// itself lives in `status.ts` so the dispatch by `device.protocol`
// stays in one place; everything else 550-specific lives here.
export type { PrinterError, PrinterStatus };
