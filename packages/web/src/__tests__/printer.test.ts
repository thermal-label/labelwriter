/* eslint-disable @typescript-eslint/no-deprecated -- intentionally exercises the deprecated per-transport factories during plan-10 transition */
import { describe, expect, it, vi } from 'vitest';
import { MediaNotSpecifiedError, UnsupportedOperationError } from '@thermal-label/contracts';
import type { Transport } from '@thermal-label/contracts';
import { DEVICES, MEDIA, findDevice } from '@thermal-label/labelwriter-core';
import {
  fromUSBDevice,
  fromUSBDeviceAll,
  requestPrinter,
  requestPrintersUsbLegacy,
  WebLabelWriterPrinter,
} from '../printer.js';
import { createMockUSBDevice } from './webusb-mock.js';

/**
 * Fake `Transport` recording write/read order, with an async hop on
 * each write so an unserialised concurrent caller could interleave.
 */
class RecordingTransport implements Transport {
  readonly calls: { kind: 'write' | 'read' }[] = [];
  connected = true;

  async write(): Promise<void> {
    this.calls.push({ kind: 'write' });
    await Promise.resolve();
    await Promise.resolve();
  }

  async read(): Promise<Uint8Array> {
    this.calls.push({ kind: 'read' });
    await Promise.resolve();
    // 450 idle status byte: 0x03 = Ready + Top of form.
    return new Uint8Array([0x03]);
  }

  close(): Promise<void> {
    this.connected = false;
    return Promise.resolve();
  }
}

function usb(key: keyof typeof DEVICES): { vid: number; pid: number } {
  const entry = DEVICES[key];
  if (!entry.transports.usb) throw new Error(`${key} has no usb transport`);
  return {
    vid: Number.parseInt(entry.transports.usb.vid, 16),
    pid: Number.parseInt(entry.transports.usb.pid, 16),
  };
}

const LW_450 = usb('LW_450');
const LW_550 = usb('LW_550');
const LW_450_DUO = usb('LW_450_DUO');

function solidRgba(
  width: number,
  height: number,
): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4).fill(0),
  };
}

describe('WebLabelWriterPrinter', () => {
  it('exposes adapter metadata', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    expect(printer.family).toBe('labelwriter');
    expect(printer.model).toBe('LabelWriter 450');
    expect(printer.device).toEqual(DEVICES.LW_450);
  });

  it('onStatus subscribes via the contracts polling shim (plan 11)', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    let received = 0;
    const unsub = printer.onStatus(() => {
      received += 1;
    });
    await new Promise<void>(r => setTimeout(r, 30));
    unsub();
    await printer.close();
    expect(received).toBeGreaterThanOrEqual(1);
  });

  it('print() writes encoded bytes to WebUSB with explicit media', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    await printer.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);

    expect(device.__transfers.length).toBeGreaterThan(0);
    expect(device.__transfers[0]!.data[0]).toBe(0x1b);
    expect(device.__transfers[0]!.data[1]).toBe(0x40);
  });

  it('print() throws MediaNotSpecifiedError without media', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    await expect(printer.print(solidRgba(672, 10))).rejects.toBeInstanceOf(MediaNotSpecifiedError);
  });

  it('serialises getStatus() behind an in-flight print() (plan 15 A3)', async () => {
    const transport = new RecordingTransport();
    const device = findDevice(LW_450.vid, LW_450.pid)!;
    const printer = new WebLabelWriterPrinter(device, transport);

    // Kick a print and fire a status poll before it resolves — the
    // exact collision the 4 s onStatus loop creates against a long job.
    const printDone = printer.print(solidRgba(672, 64), MEDIA.ADDRESS_STANDARD);
    const statusDone = printer.getStatus();
    await Promise.all([printDone, statusDone]);

    // getStatus() is the only caller issuing a `read()`. With the
    // serializer in place its write+read round-trip lands entirely
    // after every print write: the single read is the last call and
    // every preceding call is a print write — no status write spliced
    // into the raster stream.
    const firstReadIdx = transport.calls.findIndex(c => c.kind === 'read');
    expect(firstReadIdx).toBeGreaterThan(0);
    expect(firstReadIdx).toBe(transport.calls.length - 1);
    expect(transport.calls.slice(0, firstReadIdx).every(c => c.kind === 'write')).toBe(true);
  });

  it('getStatus returns the contracts shape on the 450', async () => {
    // 0x03 = bit 0 (Ready) + bit 1 (Top of form) — the canonical idle byte.
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid, new Uint8Array([0x03]));
    const printer = await fromUSBDevice(device);
    const status = await printer.getStatus();
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('getStatus reads 32 bytes on the 550 and parses bay/head/voltage health', async () => {
    // 550 status no longer carries media dimensions — that's ESC U
    // (NFC SKU dump). The status response only signals printer health.
    const bytes = new Uint8Array(32);
    bytes[10] = 8; // main bay status: media present, ok
    bytes[30] = 1; // head voltage: ok
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, bytes);
    const printer = await fromUSBDevice(device);
    const status = await printer.getStatus();
    expect(status.rawBytes.length).toBe(32);
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.detectedMedia).toBeUndefined();
  });

  it('close() closes the transport', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    await printer.close();
    expect(device.opened).toBe(false);
    expect(printer.connected).toBe(false);
  });

  it('throws for unknown USB devices', async () => {
    const device = createMockUSBDevice(0x1234, 0x5678);
    await expect(fromUSBDevice(device)).rejects.toThrow('Unsupported USB device');
  });

  it('createPreview() returns a single black plane with explicit media', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    const preview = await printer.createPreview(solidRgba(8, 8), {
      media: MEDIA.SHIPPING_STANDARD,
    });
    expect(preview.planes).toHaveLength(1);
    expect(preview.planes[0]!.name).toBe('black');
    expect(preview.assumed).toBe(false);
  });

  it('createPreview() falls back to DEFAULT_MEDIA on the 550 too — status carries no media', async () => {
    // Pre-rewrite this test asserted the 550 createPreview path picked
    // up media auto-detected from status. The 550 status response in
    // fact carries no media dimensions (those live in the ESC U NFC
    // dump), so the fallback path is the same as the 450.
    const bytes = new Uint8Array(32);
    bytes[10] = 8;
    bytes[30] = 1;
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, bytes);
    const printer = await fromUSBDevice(device);
    await printer.getStatus();
    const preview = await printer.createPreview(solidRgba(8, 8));
    expect(preview.assumed).toBe(true);
    expect(preview.media).toBe(MEDIA.ADDRESS_STANDARD);
  });

  it('createPreview() falls back to DEFAULT_MEDIA with assumed=true', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    const preview = await printer.createPreview(solidRgba(8, 8));
    expect(preview.assumed).toBe(true);
    expect(preview.media).toBe(MEDIA.ADDRESS_STANDARD);
  });

  it('recover() writes the legacy 87-byte sync-flush on a 450 device', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    const before = device.__transfers.length;
    await printer.recover();
    expect(device.__transfers.length).toBeGreaterThan(before);
    expect(device.__transfers[before]!.data.length).toBe(87);
  });

  it('recover() writes ESC Q on a 550 device (release pending job + lock)', async () => {
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid);
    const printer = await fromUSBDevice(device);
    const before = device.__transfers.length;
    await printer.recover();
    const sent = device.__transfers[before]!.data;
    expect(sent.length).toBe(2);
    expect(Array.from(sent)).toEqual([0x1b, 0x51]);
  });

  it('print() acquires the lock and prepends the job header on 550', async () => {
    const status = new Uint8Array(32);
    status[10] = 8; // bay ok
    status[30] = 1; // head voltage ok
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, status);
    const printer = await fromUSBDevice(device);
    const before = device.__transfers.length;
    await printer.print(solidRgba(672, 4), MEDIA.ADDRESS_STANDARD);
    const writes = device.__transfers.slice(before).map(t => t.data);
    expect(Array.from(writes[0]!)).toEqual([0x1b, 0x41, 0x01]);
    expect(writes[1]![0]).toBe(0x1b);
    expect(writes[1]![1]).toBe(0x73);
  });

  it('print() throws when the 550 reports the lock is held by another host', async () => {
    const status = new Uint8Array(32);
    status[0] = 5; // PRINT_STATUS_LOCK_NOT_GRANTED
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, status);
    const printer = await fromUSBDevice(device);
    await expect(printer.print(solidRgba(672, 4), MEDIA.ADDRESS_STANDARD)).rejects.toThrow(/lock/i);
  });

  it('print() auto-fetches SKU on 550 when no media is provided', async () => {
    const status = new Uint8Array(32);
    status[10] = 8;
    status[30] = 1;
    const sku = new Uint8Array(63);
    sku[0] = 0xb6;
    sku[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', sku.subarray(8, 20));
    sku[23] = 0x01;
    sku[40] = 0x3d;
    sku[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    sku[42] = 0x3b;
    sku[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    // Two scripted replies: the ESC A status read, then the ESC U SKU read.
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, [status, sku]);
    const printer = await fromUSBDevice(device);
    const before = device.__transfers.length;
    await printer.print(solidRgba(672, 4));
    const writes = device.__transfers.slice(before).map(t => t.data);
    expect(Array.from(writes[0]!)).toEqual([0x1b, 0x41, 0x01]);
    expect(Array.from(writes[1]!)).toEqual([0x1b, 0x55]);
    expect(writes[2]![0]).toBe(0x1b);
    expect(writes[2]![1]).toBe(0x73);
  });

  it('print() still throws MediaNotSpecifiedError on 550 when ESC U returns no SKU', async () => {
    const status = new Uint8Array(32);
    status[10] = 8;
    status[30] = 1;
    const sku = new Uint8Array(63); // bad magic → undefined
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, [status, sku]);
    const printer = await fromUSBDevice(device);
    await expect(printer.print(solidRgba(672, 4))).rejects.toBeInstanceOf(MediaNotSpecifiedError);
  });

  it('getMedia() throws UnsupportedOperationError on non-550 devices', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    await expect(printer.getMedia()).rejects.toBeInstanceOf(UnsupportedOperationError);
  });

  it('getMedia() writes ESC U, reads 63 bytes, and returns parsed SKU on 550', async () => {
    const sku = new Uint8Array(63);
    sku[0] = 0xb6;
    sku[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', sku.subarray(8, 20));
    sku[23] = 0x01;
    sku[40] = 0x3d;
    sku[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    sku[42] = 0x3b;
    sku[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, sku);
    const printer = await fromUSBDevice(device);
    const before = device.__transfers.length;
    const result = await printer.getMedia();
    const sent = device.__transfers[before]!.data;
    expect(Array.from(sent)).toEqual([0x1b, 0x55]);
    expect(result?.sku).toBe('30252');
    expect(result?.labelWidthMm).toBe(57.1);
  });

  it('getMedia() returns undefined when the SKU magic is wrong', async () => {
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, new Uint8Array(63));
    const printer = await fromUSBDevice(device);
    expect(await printer.getMedia()).toBeUndefined();
  });

  it('getStatus() preserves cached detectedMedia when a follow-up status omits it', async () => {
    const sku = new Uint8Array(63);
    sku[0] = 0xb6;
    sku[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', sku.subarray(8, 20));
    sku[23] = 0x01;
    sku[40] = 0x3d;
    sku[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    sku[42] = 0x3b;
    sku[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    const status = new Uint8Array(32);
    status[10] = 8;
    status[30] = 1;
    // Two scripted replies: the ESC U SKU read, then the ESC A status read.
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, [sku, status]);
    const printer = await fromUSBDevice(device);
    await printer.getMedia();
    const after = await printer.getStatus();
    expect(after.detectedMedia).toBeDefined();
  });

  it('getStatus() on the 550 carries decoded details[] rows', async () => {
    const bytes = new Uint8Array(32);
    bytes[10] = 8; // bay OK
    bytes[30] = 1; // voltage OK
    bytes[9] = 100; // density
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, bytes);
    const printer = await fromUSBDevice(device);
    const status = await printer.getStatus();
    expect(status.details).toBeDefined();
    expect(status.details?.find(d => d.label === 'Print status')).toBeDefined();
  });

  it('getMedia() merges roll-instance detail rows that getStatus() replays', async () => {
    const sku = new Uint8Array(63);
    sku[0] = 0xb6;
    sku[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', sku.subarray(8, 20));
    sku[22] = 0x03; // material: paper
    sku[23] = 0x01; // labelType: die
    sku[40] = 0x3d;
    sku[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    sku[42] = 0x3b;
    sku[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    const status = new Uint8Array(32);
    status[10] = 8;
    status[30] = 1;
    // ESC U SKU read first, then a follow-up ESC A status read.
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, [sku, status]);
    const printer = await fromUSBDevice(device);
    await printer.getMedia();
    const after = await printer.getStatus();
    // Roll rows survive the subsequent ESC A poll (not in the 32-byte frame).
    const rollRows = after.details?.filter(d => d.label.startsWith('Roll ')) ?? [];
    expect(rollRows.find(d => d.label === 'Roll SKU')?.value).toBe('30252');
    // ...and they sit ahead of the ESC A status rows.
    expect(after.details?.[0]?.label.startsWith('Roll ')).toBe(true);
    expect(after.details?.find(d => d.label === 'Print status')).toBeDefined();
  });

  it('getEngineVersion() throws UnsupportedOperationError on non-550 devices', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    await expect(printer.getEngineVersion()).rejects.toBeInstanceOf(UnsupportedOperationError);
  });

  it('getEngineVersion() writes ESC V, reads 34 bytes, and returns the parsed block on 550', async () => {
    const version = new Uint8Array(34);
    new TextEncoder().encodeInto('HW1.0', version.subarray(0, 16));
    new TextEncoder().encodeInto('FWAP', version.subarray(16, 20));
    new TextEncoder().encodeInto('0102', version.subarray(20, 24));
    new TextEncoder().encodeInto('0003', version.subarray(24, 28));
    new TextEncoder().encodeInto('0521', version.subarray(28, 32));
    version[32] = 0x02; // pid LE
    version[33] = 0x10;
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, version);
    const printer = await fromUSBDevice(device);
    const before = device.__transfers.length;
    const result = await printer.getEngineVersion();
    expect(Array.from(device.__transfers[before]!.data)).toEqual([0x1b, 0x56]);
    expect(result?.hwVersion).toBe('HW1.0');
    expect(result?.fwKind).toBe('application');
    expect(result?.pid).toBe(0x1002);
  });

  it('exposes a primary engine handle whose print() routes back through the adapter', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const printer = await fromUSBDevice(device);
    expect(Object.keys(printer.engines)).toEqual(['primary']);
    const before = device.__transfers.length;
    await printer.engines.primary!.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);
    expect(device.__transfers.length).toBeGreaterThan(before);
    expect(device.__transfers[before]!.data[0]).toBe(0x1b);
    expect(device.__transfers[before]!.data[1]).toBe(0x40);
  });
});

describe('fromUSBDeviceAll — multi-interface composite (LW 450 Duo)', () => {
  it('opens one transport per engine and returns a per-role adapter map', async () => {
    // The Duo declares `label` on IF 0 and `tape` on IF 1 — distinct
    // `bInterfaceNumber`s. fromUSBDeviceAll claims both and returns one
    // WebLabelWriterPrinter per engine, each scoped to its own engine.
    const device = createMockUSBDevice(
      LW_450_DUO.vid,
      LW_450_DUO.pid,
      new Uint8Array([0x00]),
      [0, 1],
    );
    const printers = await fromUSBDeviceAll(device);
    expect(Object.keys(printers).sort()).toEqual(['label', 'tape']);
    expect(printers.label!.engine.role).toBe('label');
    expect(printers.tape!.engine.role).toBe('tape');
    // Each adapter is scoped to its own engine protocol.
    expect(printers.label!.engine.protocol).toBe('lw-raster');
    expect(printers.tape!.engine.protocol).toBe('d1-tape');
    for (const role of Object.keys(printers)) await printers[role]!.close();
  });

  it('fromUSBDevice picks the lw-* primary (label) engine on the Duo', async () => {
    // The back-compat single-adapter entry prefers the label-class
    // engine over the tape engine and closes the unselected transport.
    const device = createMockUSBDevice(
      LW_450_DUO.vid,
      LW_450_DUO.pid,
      new Uint8Array([0x00]),
      [0, 1],
    );
    const primary = await fromUSBDevice(device);
    expect(primary.engine.protocol).toBe('lw-raster');
    await primary.close();
  });

  it('throws a partial-claim failure when no interface can be opened', async () => {
    // A Duo whose configuration declares neither IF — every per-engine
    // claim fails and fromUSBDeviceAll reports the aggregate failure.
    const device = createMockUSBDevice(LW_450_DUO.vid, LW_450_DUO.pid, new Uint8Array([0x00]), []);
    await expect(fromUSBDeviceAll(device)).rejects.toThrow(/could not open any USB interfaces/);
  });

  it('surfaces a partial-claim warning when one Duo interface opens and another fails', async () => {
    // IF 0 (label) is declared, IF 1 (tape) is not — the label engine
    // opens, the tape engine claim fails. fromUSBDeviceAll keeps the
    // working engine and logs a partial-claim warning ("rails not walls").
    const warn = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    const device = createMockUSBDevice(LW_450_DUO.vid, LW_450_DUO.pid, new Uint8Array([0x00]), [0]);
    const printers = await fromUSBDeviceAll(device);
    expect(Object.keys(printers)).toEqual(['label']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('partial-claim'));
    warn.mockRestore();
    await printers.label!.close();
  });
});

describe('WebLabelWriterPrinter — Duo tape engine adapter', () => {
  async function duoTape(): Promise<WebLabelWriterPrinter> {
    const device = createMockUSBDevice(
      LW_450_DUO.vid,
      LW_450_DUO.pid,
      new Uint8Array([0x40]),
      [0, 1],
    );
    const printers = await fromUSBDeviceAll(device);
    return printers.tape!;
  }

  it('getStatus() on the tape engine routes through d1-core (SYN request, 1-byte reply)', async () => {
    // The tape-scoped adapter dispatches by `engine.protocol === 'd1-tape'`
    // — it lazy-loads d1-core, writes the SYN frame and parses the
    // 1-byte reply. 0x40 = cassette inserted, ready.
    const tape = await duoTape();
    const status = await tape.getStatus();
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    await tape.close();
  });

  it('recover() on the tape engine is a no-op (d1-tape has no recovery sequence)', async () => {
    const tape = await duoTape();
    // Should resolve without throwing — the tape side resets mechanically.
    await expect(tape.recover()).resolves.toBeUndefined();
    await tape.close();
  });

  it('print() on the tape engine dispatches through the async d1-core encoder', async () => {
    const tape = await duoTape();
    await tape.print(solidRgba(128, 8), MEDIA.STANDARD_BLACK_ON_WHITE_12);
    await tape.close();
  });
});

describe('WebLabelWriterPrinter — engine-scoping and error paths', () => {
  it('constructor throws when the device declares no engines', () => {
    const transport = new RecordingTransport();
    const noEngines = { ...DEVICES.LW_450, key: 'BROKEN', engines: [] };
    expect(
      () => new WebLabelWriterPrinter(noEngines as unknown as typeof DEVICES.LW_450, transport),
    ).toThrow(/BROKEN has no engines/);
  });

  it('print() rejects a cross-engine request with an unknown role', async () => {
    // A single-engine LW_450 adapter asked to print on a non-existent
    // engine role — `resolveRequestedEngine` throws before any I/O.
    const transport = new RecordingTransport();
    const device = findDevice(LW_450.vid, LW_450.pid)!;
    const printer = new WebLabelWriterPrinter(device, transport);
    await expect(
      printer.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD, { engine: 'nonexistent' }),
    ).rejects.toThrow(/no engine with role "nonexistent"/);
  });

  it('print() rejects a cross-engine request that resolves to a different real engine', async () => {
    // The label-scoped Duo adapter asked to print on the `tape` engine
    // — that's a real engine, but a different one, so the adapter
    // refuses and tells the caller to use the tape adapter instead.
    const device = createMockUSBDevice(
      LW_450_DUO.vid,
      LW_450_DUO.pid,
      new Uint8Array([0x00]),
      [0, 1],
    );
    const printers = await fromUSBDeviceAll(device);
    await expect(
      printers.label!.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD, { engine: 'tape' }),
    ).rejects.toThrow(/cannot print on engine "tape"/);
    for (const role of Object.keys(printers)) await printers[role]!.close();
  });
});

describe('WebLabelWriterPrinter — 550 lock health', () => {
  it('print() refuses when the 550 lock acquire reports a bay error', async () => {
    // bay status 2 = no media → acquire550Lock surfaces the error and
    // print() throws before encoding the bitmap.
    const status = new Uint8Array(32);
    status[10] = 2; // no media present
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, status);
    const printer = await fromUSBDevice(device);
    await expect(printer.print(solidRgba(672, 4), MEDIA.ADDRESS_STANDARD)).rejects.toThrow(
      /Cannot print/,
    );
  });

  it('getStatus() after getMedia() keeps the cached detectedMedia through the lock acquire', async () => {
    // getMedia() caches detectedMedia; the subsequent print()'s lock
    // acquire parses a media-less ESC A frame but preserves the cache.
    const sku = new Uint8Array(63);
    sku[0] = 0xb6;
    sku[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', sku.subarray(8, 20));
    sku[23] = 0x01;
    sku[40] = 0x3d;
    sku[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    sku[42] = 0x3b;
    sku[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    const status = new Uint8Array(32);
    status[10] = 8;
    status[30] = 1;
    // ESC U SKU read, then the ESC A lock-acquire status read.
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, [sku, status]);
    const printer = await fromUSBDevice(device);
    await printer.getMedia();
    await printer.print(solidRgba(672, 4));
    // The print succeeded off the cached SKU media — no throw.
    expect(device.__transfers.length).toBeGreaterThan(0);
  });
});

describe('WebLabelWriterPrinter — 550 SKU / version short reads and faults', () => {
  it('getMedia() returns undefined when the ESC U read is shorter than 63 bytes', async () => {
    // RecordingTransport answers every read with a single byte — far
    // short of the 63-byte SKU dump, so doGetMedia bails to undefined.
    const transport = new RecordingTransport();
    const device = findDevice(LW_550.vid, LW_550.pid)!;
    const printer = new WebLabelWriterPrinter(device, transport);
    expect(await printer.getMedia()).toBeUndefined();
  });

  it('getEngineVersion() returns undefined when the ESC V read is shorter than 34 bytes', async () => {
    const transport = new RecordingTransport();
    const device = findDevice(LW_550.vid, LW_550.pid)!;
    const printer = new WebLabelWriterPrinter(device, transport);
    expect(await printer.getEngineVersion()).toBeUndefined();
  });

  it('print() falls through to MediaNotSpecifiedError when the SKU auto-fetch read faults', async () => {
    // The 550 print path best-effort fetches the SKU when no media is
    // given; a transport read fault inside that fetch is swallowed and
    // print() surfaces MediaNotSpecifiedError instead of the raw fault.
    class FaultyReadTransport implements Transport {
      connected = true;
      private reads = 0;
      write(): Promise<void> {
        return Promise.resolve();
      }
      read(): Promise<Uint8Array> {
        this.reads += 1;
        // First read = the ESC A lock acquire (32-byte healthy frame).
        if (this.reads === 1) {
          const ok = new Uint8Array(32);
          ok[10] = 8; // bay OK
          ok[30] = 1; // voltage OK
          return Promise.resolve(ok);
        }
        // Second read = the ESC U SKU fetch — fault here.
        return Promise.reject(new Error('USB read stalled'));
      }
      close(): Promise<void> {
        this.connected = false;
        return Promise.resolve();
      }
    }
    const device = findDevice(LW_550.vid, LW_550.pid)!;
    const printer = new WebLabelWriterPrinter(device, new FaultyReadTransport());
    await expect(printer.print(solidRgba(672, 4))).rejects.toBeInstanceOf(MediaNotSpecifiedError);
  });
});

describe('WebLabelWriterPrinter — createPreview with cached detected media', () => {
  it('uses the SKU-derived detectedMedia cached by getMedia()', async () => {
    const sku = new Uint8Array(63);
    sku[0] = 0xb6;
    sku[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', sku.subarray(8, 20));
    sku[23] = 0x01; // die-cut
    sku[40] = 0x3d;
    sku[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    sku[42] = 0x3b;
    sku[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid, sku);
    const printer = await fromUSBDevice(device);
    await printer.getMedia();
    // No explicit media override — createPreview picks up the cached
    // detectedMedia rather than falling back to DEFAULT_MEDIA.
    const preview = await printer.createPreview(solidRgba(8, 8));
    expect(preview.assumed).toBe(false);
    expect(preview.media.widthMm).toBe(57.1);
  });
});

describe('requestPrintersUsbLegacy', () => {
  it('shows the picker and returns the full per-engine adapter map', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const requestDevice = vi.fn(() => Promise.resolve(device));
    Object.defineProperty(globalThis, 'navigator', {
      value: { usb: { requestDevice } },
      configurable: true,
    });
    const printers = await requestPrintersUsbLegacy();
    expect(requestDevice).toHaveBeenCalledOnce();
    expect(Object.keys(printers).length).toBeGreaterThanOrEqual(1);
    for (const role of Object.keys(printers)) await printers[role]!.close();
  });
});

describe('requestPrinter', () => {
  it('shows the USB picker with default LabelWriter filters', async () => {
    const device = createMockUSBDevice(LW_450.vid, LW_450.pid);
    const requestDevice = vi.fn(() => Promise.resolve(device));
    Object.defineProperty(globalThis, 'navigator', {
      value: { usb: { requestDevice } },
      configurable: true,
    });

    await requestPrinter();

    expect(requestDevice).toHaveBeenCalledOnce();
    const call = (requestDevice.mock.calls as unknown as [{ filters: USBDeviceFilter[] }][])[0]![0];
    const pids = call.filters.map(f => f.productId);
    for (const d of Object.values(DEVICES)) {
      const u = d.transports.usb;
      if (!u) continue;
      expect(pids).toContain(Number.parseInt(u.pid, 16));
    }
  });

  it('accepts a custom filter set', async () => {
    const device = createMockUSBDevice(LW_550.vid, LW_550.pid);
    const requestDevice = vi.fn(() => Promise.resolve(device));
    Object.defineProperty(globalThis, 'navigator', {
      value: { usb: { requestDevice } },
      configurable: true,
    });

    await requestPrinter({
      filters: [{ vendorId: LW_550.vid, productId: LW_550.pid }],
    });

    const call = (requestDevice.mock.calls as unknown as [{ filters: USBDeviceFilter[] }][])[0]![0];
    expect(call.filters).toHaveLength(1);
    expect(call.filters[0]!.productId).toBe(LW_550.pid);
  });
});
