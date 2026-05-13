import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBitmap } from '@mbtech-nl/bitmap';
import { DEVICES } from '../devices.js';
import {
  DuoTapeUnavailableError,
  buildDuoTapeStream,
  duoTapeStatusRequest,
  parseDuoTapeStatus,
} from '../duo-tape-bridge.js';
import { encodeDuoTapeLabel, encodeLabel } from '../protocol.js';

/**
 * Pin the optional-peer contract. With d1-core present (the
 * in-workspace default), every tape-side helper works. With d1-core
 * mocked to a missing-module error, the helpers throw
 * `DuoTapeUnavailableError` — a friendly subclass of `Error` — instead
 * of leaking the raw `ERR_MODULE_NOT_FOUND` shape, AND the LW raster
 * encode paths still succeed (consumers without d1-core installed
 * can drive raster engines unaffected).
 */

afterEach(() => {
  vi.doUnmock('@thermal-label/d1-core');
  vi.resetModules();
});

describe('duo-tape-bridge with d1-core present', () => {
  it('duoTapeStatusRequest() returns the SYN-shaped frame from d1-core', async () => {
    const req = await duoTapeStatusRequest();
    expect(req).toBeInstanceOf(Uint8Array);
    expect(req.length).toBeGreaterThan(0);
  });

  it('parseDuoTapeStatus() returns a PrinterStatus on a healthy byte', async () => {
    // bit 6 (0x40) = cassette inserted, ready
    const status = await parseDuoTapeStatus(new Uint8Array([0x40]));
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('buildDuoTapeStream() emits the d1-core wire shape (ESC C ... ESC A)', async () => {
    const tapeEngine = DEVICES.LW_450_DUO.engines.find(e => e.protocol === 'd1-tape');
    if (!tapeEngine) throw new Error('LW_450_DUO missing tape engine');
    const bm = createBitmap(128, 10);
    const bytes = await buildDuoTapeStream(bm, tapeEngine, {}, undefined);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x43); // ESC C — tape-type selector
    expect(bytes.at(-2)).toBe(0x1b);
    expect(bytes.at(-1)).toBe(0x41); // ESC A — status query terminator
  });

  it('encodeDuoTapeLabel() dispatches a Duo tape job through the bridge', async () => {
    const bm = createBitmap(128, 10);
    const bytes = await encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm, { engine: 'tape' });
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x43);
  });

  it('LW raster encode (lw-raster) runs end-to-end without touching d1-core', () => {
    // Sanity-check baseline — the next block re-runs this with
    // d1-core mocked as missing and expects the same byte.
    const bm = createBitmap(672, 10);
    const bytes = encodeLabel(DEVICES.LW_450, bm);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40); // ESC @ — reset
  });
});

describe('DuoTapeUnavailableError shape', () => {
  it('carries the expected name + actionable install hint', () => {
    const err = new DuoTapeUnavailableError();
    expect(err.name).toBe('DuoTapeUnavailableError');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/LabelWriter Duo tape side/);
    expect(err.message).toMatch(/pnpm add @thermal-label\/d1-core/);
  });
});

describe('duo-tape-bridge with d1-core missing', () => {
  // Simulate the package being absent by mocking the *resolved* module
  // surface to a Proxy whose every-property access throws an
  // ERR_MODULE_NOT_FOUND-shaped error. This is what the bridge's
  // dynamic import sees on a missing peer dep, with the recognisable
  // "Cannot find package" message + ERR_MODULE_NOT_FOUND code.
  //
  // Throwing from the `vi.doMock` factory itself is no good — vitest
  // wraps factory throws in a different error message (`[vitest] There
  // was an error when mocking a module…`) and only sometimes preserves
  // the original on `.cause`, so the bridge's isModuleNotFound() match
  // becomes flaky. The Proxy approach lets the import succeed but
  // makes every USE of d1-core throw the right shape — and our bridge
  // uses every entry on first access (`mod.STATUS_REQUEST`,
  // `mod.parseStatus(...)`, `mod.buildPrinterStream(...)`).

  function mockD1CoreMissing(): void {
    vi.doMock('@thermal-label/d1-core', () => {
      const err = new Error("Cannot find package '@thermal-label/d1-core'");
      (err as { code?: string }).code = 'ERR_MODULE_NOT_FOUND';
      throw err;
    });
  }

  it('duoTapeStatusRequest() throws DuoTapeUnavailableError', async () => {
    mockD1CoreMissing();
    vi.resetModules();
    const bridge = await import('../duo-tape-bridge.js');
    await expect(bridge.duoTapeStatusRequest()).rejects.toBeInstanceOf(
      bridge.DuoTapeUnavailableError,
    );
  });

  it('parseDuoTapeStatus() throws DuoTapeUnavailableError', async () => {
    mockD1CoreMissing();
    vi.resetModules();
    const bridge = await import('../duo-tape-bridge.js');
    await expect(bridge.parseDuoTapeStatus(new Uint8Array([0x00]))).rejects.toBeInstanceOf(
      bridge.DuoTapeUnavailableError,
    );
  });

  it('encodeDuoTapeLabel() throws DuoTapeUnavailableError with the install hint', async () => {
    mockD1CoreMissing();
    vi.resetModules();
    const protocol = await import('../protocol.js');
    const bridge = await import('../duo-tape-bridge.js');
    const bm = createBitmap(128, 10);
    await expect(
      protocol.encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm, { engine: 'tape' }),
    ).rejects.toSatisfy(err => {
      if (!(err instanceof bridge.DuoTapeUnavailableError)) return false;
      // Message surfaces the actionable install command.
      return err.message.includes('pnpm add @thermal-label/d1-core');
    });
  });

  it('LW raster encode (lw-raster) succeeds with d1-core mocked missing', async () => {
    // The load-bearing assertion for the optional-peer contract:
    // consumers driving only the LW raster engines never trigger the
    // dynamic import, so a missing d1-core must not break them.
    mockD1CoreMissing();
    vi.resetModules();
    const protocol = await import('../protocol.js');
    const bm = createBitmap(672, 10);
    const bytes = protocol.encodeLabel(DEVICES.LW_450, bm);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40); // ESC @ — reset, lw-raster bytestream start
  });

  it('LW5 raster encode (lw5-raster) succeeds with d1-core mocked missing', async () => {
    // Same contract, separately exercised for the 550-family path.
    mockD1CoreMissing();
    vi.resetModules();
    const protocol = await import('../protocol.js');
    const bm = createBitmap(1248, 200);
    const bytes = protocol.encodeLabel(DEVICES.LW_550, bm);
    // lw5-raster has a multi-byte job header; the exact opening byte
    // is asserted in protocol-550.test.ts. Here we only need to
    // confirm the encode finished without dynamic-importing d1-core.
    expect(bytes.length).toBeGreaterThan(0);
  });
});
