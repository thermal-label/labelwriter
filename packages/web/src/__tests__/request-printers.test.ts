import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceIdentificationRequiredError } from '@thermal-label/contracts';
import { DEVICES } from '@thermal-label/labelwriter-core';
import { devicesForTransport, requestPrinters } from '../request-printers.js';
import { createMockUSBDevice } from './webusb-mock.js';

describe('requestPrinters(opts) — labelwriter generic factory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('non-USB transports', () => {
    it('rejects serial', async () => {
      await expect(requestPrinters({ transport: 'serial' })).rejects.toThrow(/not supported/);
    });

    it('rejects bluetooth-spp', async () => {
      await expect(requestPrinters({ transport: 'bluetooth-spp' })).rejects.toThrow(
        /not supported/,
      );
    });

    it('rejects bluetooth-gatt', async () => {
      await expect(requestPrinters({ transport: 'bluetooth-gatt' })).rejects.toThrow(
        /not supported/,
      );
    });
  });

  describe('transport: usb — auto-identify', () => {
    it('returns adapter map when picked USBDevice matches the registry', async () => {
      // Default mock VID/PID is LW_450 (0x0922 / 0x0020).
      const device = createMockUSBDevice();
      const usbStub = { requestDevice: vi.fn().mockResolvedValue(device) };
      vi.stubGlobal('navigator', { usb: usbStub });

      const printers = await requestPrinters({ transport: 'usb' });
      expect(Object.keys(printers).length).toBeGreaterThanOrEqual(1);
      for (const role of Object.keys(printers)) {
        expect(printers[role]!.family).toBe('labelwriter');
        await printers[role]!.close();
      }
    });

    it('throws DeviceIdentificationRequiredError when picked device has unknown VID/PID', async () => {
      const device = createMockUSBDevice(0xdead, 0xbeef);
      const usbStub = { requestDevice: vi.fn().mockResolvedValue(device) };
      vi.stubGlobal('navigator', { usb: usbStub });

      await expect(requestPrinters({ transport: 'usb' })).rejects.toBeInstanceOf(
        DeviceIdentificationRequiredError,
      );
    });

    it('candidate list is non-empty for usb transport', async () => {
      const device = createMockUSBDevice(0xdead, 0xbeef);
      const usbStub = { requestDevice: vi.fn().mockResolvedValue(device) };
      vi.stubGlobal('navigator', { usb: usbStub });
      try {
        await requestPrinters({ transport: 'usb' });
        throw new Error('expected DeviceIdentificationRequiredError');
      } catch (err) {
        if (!(err instanceof DeviceIdentificationRequiredError)) throw err;
        expect(err.candidates.length).toBeGreaterThan(0);
        for (const c of err.candidates) expect(c.transports.usb).toBeDefined();
      }
    });
  });
});

describe('devicesForTransport — labelwriter', () => {
  it('returns only entries declaring the queried transport', () => {
    const usb = devicesForTransport('usb');
    for (const entry of usb) expect(entry.transports.usb).toBeDefined();
    for (const t of ['bluetooth-gatt', 'bluetooth-spp', 'serial'] as const) {
      for (const entry of devicesForTransport(t)) {
        expect(entry.transports[t]).toBeDefined();
      }
    }
  });

  it('finds at least one known model (LW_450)', () => {
    const usb = devicesForTransport('usb');
    expect(usb.some(d => d.key === DEVICES.LW_450.key)).toBe(true);
  });
});
