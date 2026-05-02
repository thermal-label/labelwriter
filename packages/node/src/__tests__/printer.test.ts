import { describe, expect, it, vi } from 'vitest';
import { MediaNotSpecifiedError, type Transport } from '@thermal-label/contracts';
import {
  DEVICES,
  DUO_TAPE_MEDIA,
  MEDIA,
  buildErrorRecovery,
} from '@thermal-label/labelwriter-core';
import { LabelWriterPrinter } from '../printer.js';

function makeTransport(statusBytes: Uint8Array = new Uint8Array([0x00])): {
  transport: Transport;
  written: Uint8Array[];
} {
  const written: Uint8Array[] = [];
  let statusIdx = 0;

  const transport: Transport = {
    get connected() {
      return true;
    },
    write: vi.fn((data: Uint8Array) => {
      written.push(new Uint8Array(data));
      return Promise.resolve();
    }),
    read: vi.fn((byteCount: number) => {
      const slice = statusBytes.slice(statusIdx, statusIdx + byteCount);
      statusIdx += byteCount;
      const result = new Uint8Array(byteCount);
      result.set(slice);
      return Promise.resolve(result);
    }),
    close: vi.fn(() => Promise.resolve()),
  };

  return { transport, written };
}

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

describe('LabelWriterPrinter', () => {
  const device450 = DEVICES.LW_450;
  const device550 = DEVICES.LW_550;

  describe('adapter metadata', () => {
    it('exposes family, model, connected, and device', () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      expect(printer.family).toBe('labelwriter');
      expect(printer.model).toBe('LabelWriter 450');
      expect(printer.connected).toBe(true);
      expect(printer.device).toBe(device450);
      expect(printer.transportType).toBe('usb');
    });
  });

  describe('getStatus', () => {
    it('reads 1 byte for 450 protocol device', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      const status = await printer.getStatus();

      expect(vi.mocked(transport.read)).toHaveBeenCalledWith(1);
      expect(status.ready).toBe(true);
      expect(status.detectedMedia).toBeUndefined();
      expect(status.rawBytes.length).toBe(1);
    });

    it('reads 32 bytes for 550 protocol device', async () => {
      const { transport } = makeTransport(new Uint8Array(32));
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      const status = await printer.getStatus();

      expect(vi.mocked(transport.read)).toHaveBeenCalledWith(32);
      expect(status.rawBytes.length).toBe(32);
    });

    it('surfaces no_media when the 450 reports paper-out (bit 0)', async () => {
      const { transport } = makeTransport(new Uint8Array([0x01]));
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      const status = await printer.getStatus();
      expect(status.ready).toBe(false);
      expect(status.mediaLoaded).toBe(false);
      expect(status.errors.map(e => e.code)).toContain('no_media');
    });

    it('reports ready on the 550 when bay status byte 10 is 8 (media ok)', async () => {
      // 550 status doesn't carry media dimensions — that lives on
      // ESC U (NFC SKU dump). The status response only signals
      // bay/head/voltage health; detectedMedia stays undefined here.
      const bytes = new Uint8Array(32);
      bytes[10] = 8; // main bay status: media present, ok
      bytes[30] = 1; // head voltage: ok
      const { transport } = makeTransport(bytes);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      const status = await printer.getStatus();
      expect(status.ready).toBe(true);
      expect(status.mediaLoaded).toBe(true);
      expect(status.detectedMedia).toBeUndefined();
    });
  });

  describe('print', () => {
    it('throws MediaNotSpecifiedError without media or status', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await expect(printer.print(solidRgba(672, 10))).rejects.toBeInstanceOf(
        MediaNotSpecifiedError,
      );
    });

    it('sends an ESC reset as the first byte for 450 (no job header)', async () => {
      const { transport, written } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);

      expect(written).toHaveLength(1);
      expect(written[0]![0]).toBe(0x1b);
      expect(written[0]![1]).toBe(0x40);
    });

    it('prepends a job header for 550 devices (after the lock-acquire ESC A 1)', async () => {
      // Lock-acquire preamble reads 32 bytes; supply a healthy status
      // (bay=8 ok, voltage=1 ok) so acquire550Lock proceeds.
      const status = new Uint8Array(32);
      status[10] = 8;
      status[30] = 1;
      const { transport, written } = makeTransport(status);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);

      // First write is the lock-acquire ESC A 1; second write is the
      // print job which starts with ESC s.
      expect(written.length).toBe(2);
      expect(Array.from(written[0]!)).toEqual([0x1b, 0x41, 0x01]);
      expect(written[1]![0]).toBe(0x1b);
      expect(written[1]![1]).toBe(0x73);
    });

    it('550 print without explicit media throws (status carries no detectedMedia today)', async () => {
      // The 550 spec routes media identity through ESC U (NFC SKU dump),
      // not the status response. Until ESC U is wired into the driver,
      // callers must pass media explicitly — we no longer fall back to
      // a (wrong) width/height read from status bytes.
      const bytes = new Uint8Array(32);
      bytes[10] = 8;
      bytes[30] = 1;
      const { transport } = makeTransport(bytes);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.getStatus();
      await expect(printer.print(solidRgba(672, 10))).rejects.toBeInstanceOf(
        MediaNotSpecifiedError,
      );
    });
  });

  describe('createPreview', () => {
    it('returns a single black plane with explicit media', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      const preview = await printer.createPreview(solidRgba(8, 8), {
        media: MEDIA.SHIPPING_STANDARD,
      });
      expect(preview.planes).toHaveLength(1);
      expect(preview.planes[0]!.name).toBe('black');
      expect(preview.assumed).toBe(false);
    });

    it('falls back to DEFAULT_MEDIA with assumed=true', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      const preview = await printer.createPreview(solidRgba(8, 8));
      expect(preview.assumed).toBe(true);
      expect(preview.media).toBe(MEDIA.ADDRESS_STANDARD);
    });
  });

  describe('550 status request shape (lock-aware)', () => {
    it('450 device sends 2-byte ESC A', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.getStatus();
      const firstWrite = vi.mocked(transport.write).mock.calls[0]![0];
      expect(Array.from(firstWrite)).toEqual([0x1b, 0x41]);
    });

    it('550 device sends 3-byte ESC A <lock=0>', async () => {
      const bytes = new Uint8Array(32);
      bytes[10] = 8;
      bytes[30] = 1;
      const { transport } = makeTransport(bytes);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.getStatus();
      const firstWrite = vi.mocked(transport.write).mock.calls[0]![0];
      expect(Array.from(firstWrite)).toEqual([0x1b, 0x41, 0x00]);
    });
  });

  describe('getMedia (550 ESC U)', () => {
    function makeSku(): Uint8Array {
      const buf = new Uint8Array(63);
      buf[0] = 0xb6;
      buf[1] = 0xca; // magic
      new TextEncoder().encodeInto('30252       ', buf.subarray(8, 20));
      buf[20] = 0x00; // brand DYMO
      buf[23] = 0x01; // labelType: die
      buf[40] = 89; // labelLengthMm
      buf[42] = 28; // labelWidthMm
      return buf;
    }

    it('throws UnsupportedOperationError on non-550 devices', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await expect(printer.getMedia()).rejects.toThrow(/lw-550/);
    });

    it('550: writes ESC U, reads 63 bytes, returns parsed SKU', async () => {
      const { transport } = makeTransport(makeSku());
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      const sku = await printer.getMedia();
      const firstWrite = vi.mocked(transport.write).mock.calls[0]![0];
      expect(Array.from(firstWrite)).toEqual([0x1b, 0x55]);
      expect(vi.mocked(transport.read)).toHaveBeenCalledWith(63);
      expect(sku?.sku).toBe('30252');
      expect(sku?.labelWidthMm).toBe(28);
    });

    it('550: returns undefined when magic is wrong (no media / counterfeit)', async () => {
      const buf = new Uint8Array(63); // all zeros — magic is 0x0000, not 0xCAB6
      const { transport } = makeTransport(buf);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      const sku = await printer.getMedia();
      expect(sku).toBeUndefined();
    });

    it('550: caches detectedMedia onto lastStatus for subsequent print() calls', async () => {
      // Sequence: getMedia consumes 63-byte SKU, then print() consumes
      // 32-byte status for lock acquire, then writes the job.
      const sku = makeSku();
      const status = new Uint8Array(32);
      status[10] = 8;
      status[30] = 1;
      const buf = new Uint8Array(sku.length + status.length);
      buf.set(sku, 0);
      buf.set(status, sku.length);
      const { transport } = makeTransport(buf);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.getMedia();
      // No explicit media on print; should reuse cached SKU media
      // (no extra ESC U fetch — cache hit). Two writes after getMedia:
      // ESC A 1 (lock acquire) and the print job itself.
      const writesBefore = vi.mocked(transport.write).mock.calls.length;
      await printer.print(solidRgba(672, 4));
      const writesAfter = vi.mocked(transport.write).mock.calls.length;
      expect(writesAfter - writesBefore).toBe(2);
    });
  });

  describe('550 print without explicit media auto-fetches SKU', () => {
    function skuMock(): Uint8Array {
      const buf = new Uint8Array(63);
      buf[0] = 0xb6;
      buf[1] = 0xca;
      new TextEncoder().encodeInto('30252       ', buf.subarray(8, 20));
      buf[23] = 0x01;
      buf[40] = 89;
      buf[42] = 28;
      return buf;
    }

    it('writes ESC A 1 (lock), then ESC U, then the print job', async () => {
      // Buffer order matches read order: 32-byte status (lock check),
      // then 63-byte SKU dump.
      const status = new Uint8Array(32);
      status[10] = 8;
      status[30] = 1;
      const sku = skuMock();
      const buf = new Uint8Array(status.length + sku.length);
      buf.set(status, 0);
      buf.set(sku, status.length);
      const { transport } = makeTransport(buf);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.print(solidRgba(672, 4));
      const writes = vi.mocked(transport.write).mock.calls.map(c => c[0]);
      // First write: ESC A 1 (lock acquire)
      expect(Array.from(writes[0]!)).toEqual([0x1b, 0x41, 0x01]);
      // Second write: ESC U (SKU fetch)
      expect(Array.from(writes[1]!)).toEqual([0x1b, 0x55]);
      // Third write: print job starting with ESC s
      expect(writes[2]![0]).toBe(0x1b);
      expect(writes[2]![1]).toBe(0x73);
    });

    it('still throws MediaNotSpecifiedError when SKU fetch returns garbage', async () => {
      // Status (lock OK) + 63 bytes of garbage (no SKU magic).
      const status = new Uint8Array(32);
      status[10] = 8;
      status[30] = 1;
      const buf = new Uint8Array(status.length + 63);
      buf.set(status, 0);
      const { transport } = makeTransport(buf);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await expect(printer.print(solidRgba(672, 4))).rejects.toBeInstanceOf(MediaNotSpecifiedError);
    });
  });

  describe('550 lock acquisition before print', () => {
    it('throws when the printer reports the lock is held by another host', async () => {
      // byte 0 = 5 means PRINT_STATUS_LOCK_NOT_GRANTED per spec p.13-14
      const status = new Uint8Array(32);
      status[0] = 5;
      const { transport } = makeTransport(status);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await expect(printer.print(solidRgba(672, 4), MEDIA.ADDRESS_STANDARD)).rejects.toThrow(
        /held by another host/,
      );
    });

    it('throws when the printer reports no media before sending the job', async () => {
      // bay status 2 = "no media present"
      const status = new Uint8Array(32);
      status[10] = 2;
      const { transport, written } = makeTransport(status);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await expect(printer.print(solidRgba(672, 4), MEDIA.ADDRESS_STANDARD)).rejects.toThrow(
        /no_media/,
      );
      // Only the lock-acquire write happened — no print job was sent.
      expect(written.length).toBe(1);
    });

    it('throws when the printer reports a paper jam', async () => {
      const status = new Uint8Array(32);
      status[10] = 9; // jammed
      status[30] = 1;
      const { transport } = makeTransport(status);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await expect(printer.print(solidRgba(672, 4), MEDIA.ADDRESS_STANDARD)).rejects.toThrow(
        /paper_jam/,
      );
    });

    it('throws when print head voltage is critically low', async () => {
      const status = new Uint8Array(32);
      status[10] = 8;
      status[30] = 3; // critically low
      const { transport } = makeTransport(status);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await expect(printer.print(solidRgba(672, 4), MEDIA.ADDRESS_STANDARD)).rejects.toThrow(
        /low_voltage/,
      );
    });

    it('does not acquire a lock on 450 devices (ESC A 1 is a 550 concept)', async () => {
      const { transport, written } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);
      // 450 path is a single write of the print job — no preamble ESC A.
      expect(written.length).toBe(1);
      expect(written[0]![0]).toBe(0x1b);
      expect(written[0]![1]).toBe(0x40); // ESC @ (450 reset, not ESC A)
    });
  });

  describe('recover', () => {
    it('450 device sends the legacy 85×ESC + ESC A recovery sequence', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.recover();

      const writeCalls = vi.mocked(transport.write).mock.calls;
      const firstWrite = writeCalls[0]![0];
      expect(firstWrite).toEqual(buildErrorRecovery());
      expect(vi.mocked(transport.read)).toHaveBeenCalledWith(1);
    });

    it('550 device sends ESC Q (release job + lock) and reads 32-byte status', async () => {
      const { transport } = makeTransport(new Uint8Array(32));
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.recover();

      const writeCalls = vi.mocked(transport.write).mock.calls;
      const firstWrite = writeCalls[0]![0];
      expect(Array.from(firstWrite)).toEqual([0x1b, 0x51]);
      expect(vi.mocked(transport.read)).toHaveBeenCalledWith(32);
    });

    it('550 recovery never emits the 450 sync-flush sequence', async () => {
      const { transport } = makeTransport(new Uint8Array(32));
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.recover();

      const firstWrite = vi.mocked(transport.write).mock.calls[0]![0];
      // 85×ESC + ESC A is 87 bytes; the 550 path writes exactly 2.
      expect(firstWrite.length).toBe(2);
    });
  });

  describe('close', () => {
    it('awaits the transport close', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.close();
      expect(vi.mocked(transport.close)).toHaveBeenCalled();
    });
  });

  describe('engines', () => {
    it('exposes a primary handle on single-engine devices', () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      expect(Object.keys(printer.engines)).toEqual(['primary']);
      expect(printer.engines.primary?.role).toBe('primary');
    });

    it('exposes left + right handles on Twin Turbo', () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_TWIN_TURBO, transport, 'usb');
      expect(Object.keys(printer.engines).sort()).toEqual(['left', 'right']);
    });

    it('Duo exposes only the label engine when no tape transport is provided', () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, transport, 'usb');
      expect(Object.keys(printer.engines)).toEqual(['label']);
    });

    it('Duo exposes both engines when a tape transport is provided', () => {
      const { transport: labelT } = makeTransport();
      const { transport: tapeT } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, labelT, 'usb', {
        engineTransports: { tape: tapeT },
      });
      expect(Object.keys(printer.engines).sort()).toEqual(['label', 'tape']);
    });

    it('Duo tape engine.print writes to the tape transport, not the label transport', async () => {
      const { transport: labelT, written: labelWritten } = makeTransport();
      const { transport: tapeT, written: tapeWritten } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, labelT, 'usb', {
        engineTransports: { tape: tapeT },
      });
      await printer.engines.tape!.print(solidRgba(128, 8), DUO_TAPE_MEDIA.TAPE_12MM);
      expect(labelWritten).toHaveLength(0);
      expect(tapeWritten).toHaveLength(1);
      // Tape stream starts with ESC @ (reset) per duo-tape encoder
      expect(tapeWritten[0]![0]).toBe(0x1b);
      expect(tapeWritten[0]![1]).toBe(0x40);
      // ESC E (cut) is the last opcode
      const last = tapeWritten[0]!;
      expect(last.at(-2)).toBe(0x1b);
      expect(last.at(-1)).toBe(0x45);
    });

    it("Duo tape engine.print derives ESC C selector from media's tapeColour", async () => {
      const { transport: labelT } = makeTransport();
      const { transport: tapeT, written } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, labelT, 'usb', {
        engineTransports: { tape: tapeT },
      });
      const colouredTape = { ...DUO_TAPE_MEDIA.TAPE_12MM, tapeColour: 5 };
      await printer.engines.tape!.print(solidRgba(128, 4), colouredTape);
      // Wire layout: ESC @, ESC C n, ESC D ...
      expect(written[0]![4]).toBe(0x05);
    });

    it('Duo tape engine.print rejects non-tape media', async () => {
      const { transport: labelT } = makeTransport();
      const { transport: tapeT } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, labelT, 'usb', {
        engineTransports: { tape: tapeT },
      });
      await expect(
        printer.engines.tape!.print(solidRgba(128, 4), MEDIA.ADDRESS_STANDARD),
      ).rejects.toThrow(/type "tape"/);
    });

    it('Duo tape engine.getStatus reads 8 bytes via parseDuoTapeStatus', async () => {
      const { transport: labelT } = makeTransport();
      const tapeStatus = new Uint8Array(8);
      tapeStatus[0] = 0x40; // CASSETTE present, no errors
      const { transport: tapeT } = makeTransport(tapeStatus);
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, labelT, 'usb', {
        engineTransports: { tape: tapeT },
      });
      const status = await printer.engines.tape!.getStatus!();
      expect(vi.mocked(tapeT.read)).toHaveBeenCalledWith(8);
      expect(status.ready).toBe(true);
      expect(status.mediaLoaded).toBe(true);
    });

    it('Duo close() closes both transports', async () => {
      const { transport: labelT } = makeTransport();
      const { transport: tapeT } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, labelT, 'usb', {
        engineTransports: { tape: tapeT },
      });
      await printer.close();
      expect(vi.mocked(labelT.close)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(tapeT.close)).toHaveBeenCalledTimes(1);
    });

    it('Duo print({ engine: "tape" }) without a tape transport throws clearly', async () => {
      const { transport: labelT } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_DUO, labelT, 'usb');
      await expect(
        printer.print(solidRgba(128, 4), DUO_TAPE_MEDIA.TAPE_12MM, { engine: 'tape' }),
      ).rejects.toThrow(/has no transport/);
    });

    it('engines.right.print(...) emits ESC q 0x32', async () => {
      const { transport, written } = makeTransport();
      const printer = new LabelWriterPrinter(DEVICES.LW_450_TWIN_TURBO, transport, 'usb');
      await printer.engines.right!.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);
      const out = written[0]!;
      let found: number | undefined;
      for (let i = 0; i < out.length - 2; i++) {
        if (out[i] === 0x1b && out[i + 1] === 0x71) {
          found = out[i + 2];
          break;
        }
      }
      expect(found).toBe(0x32);
    });
  });
});
