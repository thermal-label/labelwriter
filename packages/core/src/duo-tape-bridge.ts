import type { LabelBitmap } from '@mbtech-nl/bitmap';
import type { MediaDescriptor, PrintEngine, PrinterStatus } from '@thermal-label/contracts';
import type { LabelWriterTapeMedia } from './types.js';

/**
 * Thrown when a Duo tape-side code path needs `@thermal-label/d1-core`
 * but the package isn't installed in the consuming app. `d1-core` is an
 * **optional** peer of `@thermal-label/labelwriter-core` — apps that
 * only drive the LW/LW5 raster engines don't need it. Apps that drive
 * the LabelWriter Duo's tape engine install `d1-core` as a peer and
 * pay no facade tax: they import it directly when they need its types.
 *
 * Subclasses `Error` (matching the contracts package's error style:
 * `MediaNotSpecifiedError`, `UnsupportedOperationError`, …) so consumers
 * can catch by class. The `name` is set explicitly so it survives
 * structuredClone / `JSON.stringify` round-trips.
 */
export class DuoTapeUnavailableError extends Error {
  constructor() {
    super(
      'Printing on the LabelWriter Duo tape side requires @thermal-label/d1-core. ' +
        'Install it as a peer dependency: pnpm add @thermal-label/d1-core',
    );
    this.name = 'DuoTapeUnavailableError';
  }
}

/**
 * Shape of the d1-core module surface the labelwriter driver pulls in
 * on the Duo tape path. Mirrors d1-core's public exports — kept here so
 * the lazy import has a precise type without a value-level static
 * import of `@thermal-label/d1-core` leaking into the LW-raster bundle.
 */
interface D1CoreModule {
  buildPrinterStream(
    bitmap: LabelBitmap,
    engine: PrintEngine,
    options?: { copies?: number; tapeType?: number },
    media?: MediaDescriptor,
  ): Uint8Array;
  STATUS_REQUEST: Uint8Array;
  parseStatus(bytes: Uint8Array): PrinterStatus;
}

/**
 * Lazy-load `@thermal-label/d1-core`. Returns the module on success;
 * throws `DuoTapeUnavailableError` on `ERR_MODULE_NOT_FOUND` (the
 * `vite`/`rollup`/`node` shape when the optional peer is absent).
 *
 * The dynamic import is the load-bearing bit for the optional-peer
 * contract: bundlers (Vite/Rollup/webpack) treat `await import(...)` of
 * a bare specifier as a code-split point, so consumers that never
 * traverse this function don't pull d1-core into their bundle.
 */
export async function loadD1Core(): Promise<D1CoreModule> {
  try {
    return (await import('@thermal-label/d1-core')) as D1CoreModule;
  } catch (err) {
    // Node sets `err.code === 'ERR_MODULE_NOT_FOUND'`; Vite/Rollup
    // surface a generic "Failed to fetch dynamically imported module"
    // or "Cannot find module". Anything that smells like a missing
    // module → friendly error. Other failures (syntax errors inside
    // d1-core, transport errors) are re-thrown unchanged so they're
    // not silently swallowed.
    if (isModuleNotFound(err)) {
      throw new DuoTapeUnavailableError();
    }
    throw err;
  }
}

function isModuleNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') return true;
  const msg = err.message;
  return (
    msg.includes('Cannot find module') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes("Cannot find package '@thermal-label/d1-core'") ||
    msg.includes('Failed to resolve module specifier')
  );
}

/**
 * Encode a Duo tape-side job through d1-core's `buildPrinterStream`.
 * Throws `DuoTapeUnavailableError` if d1-core isn't installed.
 *
 * Mirrors the arguments the static-import call site used to pass; the
 * `media` parameter is typed against the labelwriter-side narrowed
 * `LabelWriterTapeMedia` so the call site doesn't need to know the
 * shape of `D1Media` at runtime.
 */
export async function buildDuoTapeStream(
  bitmap: LabelBitmap,
  engine: PrintEngine,
  options: { copies?: number; tapeType?: number },
  media: LabelWriterTapeMedia | undefined,
): Promise<Uint8Array> {
  const mod = await loadD1Core();
  return mod.buildPrinterStream(bitmap, engine, options, media);
}

/**
 * Lazy accessor for d1-core's 1-byte status request frame (`SYN`).
 * Throws `DuoTapeUnavailableError` if d1-core isn't installed.
 */
export async function duoTapeStatusRequest(): Promise<Uint8Array> {
  const mod = await loadD1Core();
  return mod.STATUS_REQUEST;
}

/**
 * Lazy parser for the Duo tape engine's 1-byte status reply. Throws
 * `DuoTapeUnavailableError` if d1-core isn't installed.
 */
export async function parseDuoTapeStatus(bytes: Uint8Array): Promise<PrinterStatus> {
  const mod = await loadD1Core();
  return mod.parseStatus(bytes);
}
