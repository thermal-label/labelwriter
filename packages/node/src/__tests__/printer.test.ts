/* eslint-disable import-x/consistent-type-specifier-style */
import { describe, expect, it, vi } from 'vitest';
import { DEVICES, buildErrorRecovery } from '@thermal-label/labelwriter-core';
import type { LabelBitmap } from '@thermal-label/labelwriter-core';
import { LabelWriterPrinter } from '../printer.js';
import type { Transport } from '../transport.js';

function makeBitmap(widthPx: number, heightPx: number): LabelBitmap {
  return { widthPx, heightPx, data: new Uint8Array(Math.ceil(widthPx / 8) * heightPx) };
}

function makeTransport(statusBytes: Uint8Array = new Uint8Array([0x00])): {
  transport: Transport;
  written: Uint8Array[];
} {
  const written: Uint8Array[] = [];
  let statusIdx = 0;

  const transport: Transport = {
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

describe('LabelWriterPrinter', () => {
  const device450 = DEVICES.LW_450;
  const device550 = DEVICES.LW_550;

  describe('getStatus', () => {
    it('reads 1 byte for 450 protocol device', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      const status = await printer.getStatus();

      expect(vi.mocked(transport.read)).toHaveBeenCalledWith(1);
      expect(status.ready).toBe(true);
      expect(status.rawBytes.length).toBe(1);
      await printer.close();
    });

    it('reads 32 bytes for 550 protocol device', async () => {
      const { transport } = makeTransport(new Uint8Array(32));
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      const status = await printer.getStatus();

      expect(vi.mocked(transport.read)).toHaveBeenCalledWith(32);
      expect(status.rawBytes.length).toBe(32);
      await printer.close();
    });

    it('reports paper-out when bit 0 set (450)', async () => {
      const { transport } = makeTransport(new Uint8Array([0x01]));
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      const status = await printer.getStatus();
      expect(status.paperOut).toBe(true);
      expect(status.ready).toBe(false);
      await printer.close();
    });
  });

  describe('print', () => {
    it('sends correct byte sequence for 450 device (no job header)', async () => {
      const { transport, written } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      const bitmap = makeBitmap(672, 10);
      await printer.print(bitmap);

      expect(written.length).toBe(1);
      expect(written[0]![0]).toBe(0x1b);
      expect(written[0]![1]).toBe(0x40);
      await printer.close();
    });

    it('sends job header for 550 device', async () => {
      const { transport, written } = makeTransport();
      const printer = new LabelWriterPrinter(device550, transport, 'usb');
      const bitmap = makeBitmap(672, 10);
      await printer.print(bitmap);

      expect(written.length).toBe(1);
      expect(written[0]![0]).toBe(0x1b);
      expect(written[0]![1]).toBe(0x73);
      await printer.close();
    });
  });

  describe('recover', () => {
    it('sends error recovery sequence and reads status', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.recover();

      const writeCalls = vi.mocked(transport.write).mock.calls;
      const firstWrite = writeCalls[0]![0];
      expect(firstWrite).toEqual(buildErrorRecovery());
      expect(vi.mocked(transport.read)).toHaveBeenCalled();
      await printer.close();
    });
  });

  describe('close', () => {
    it('calls transport close', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.close();
      expect(vi.mocked(transport.close)).toHaveBeenCalled();
    });
  });

  describe('printText', () => {
    it('sends bytes to transport', async () => {
      const { transport } = makeTransport();
      const printer = new LabelWriterPrinter(device450, transport, 'usb');
      await printer.printText('Hello');
      expect(vi.mocked(transport.write)).toHaveBeenCalled();
      await printer.close();
    });
  });
});
