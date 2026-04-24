import { describe, expect, it, vi } from 'vitest';
import { MediaNotSpecifiedError, type Transport } from '@thermal-label/contracts';
import { DEVICES, MEDIA, buildErrorRecovery } from '@thermal-label/labelwriter-core';
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

function solidRgba(width: number, height: number): {
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

    it('matches detectedMedia against the registry on the 550', async () => {
      const bytes = new Uint8Array(32);
      bytes[4] = 28; // width mm
      bytes[6] = 89; // height mm
      const { transport } = makeTransport(bytes);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      const status = await printer.getStatus();
      expect(status.detectedMedia).toEqual(MEDIA.ADDRESS_STANDARD);
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

    it('prepends a job header for 550 devices', async () => {
      const { transport, written } = makeTransport();
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);

      expect(written).toHaveLength(1);
      expect(written[0]![0]).toBe(0x1b);
      expect(written[0]![1]).toBe(0x73);
    });

    it('uses detected media from previous getStatus when no media passed', async () => {
      const bytes = new Uint8Array(32);
      bytes[4] = 28;
      bytes[6] = 89;
      const { transport, written } = makeTransport(bytes);
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      await printer.getStatus();
      const writesBefore = written.length;
      await printer.print(solidRgba(672, 10));
      expect(written.length).toBe(writesBefore + 1);
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

  describe('recover', () => {
    it('sends error recovery sequence and drains the status response', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.recover();

      const writeCalls = vi.mocked(transport.write).mock.calls;
      const firstWrite = writeCalls[0]![0];
      expect(firstWrite).toEqual(buildErrorRecovery());
      expect(vi.mocked(transport.read)).toHaveBeenCalled();
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
});
