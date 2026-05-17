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

  describe('transport: usb — explicit deviceKey', () => {
    it('trusts an explicit deviceKey and returns the adapter map', async () => {
      // With `deviceKey` supplied the factory skips auto-identify and
      // trusts the caller's pick — VID/PID still has to match the
      // registry entry `fromUSBDeviceAll` re-checks.
      const device = createMockUSBDevice();
      const usbStub = { requestDevice: vi.fn().mockResolvedValue(device) };
      vi.stubGlobal('navigator', { usb: usbStub });

      const printers = await requestPrinters({ transport: 'usb', deviceKey: 'LW_450' });
      expect(Object.keys(printers).length).toBeGreaterThanOrEqual(1);
      for (const role of Object.keys(printers)) {
        expect(printers[role]!.family).toBe('labelwriter');
        await printers[role]!.close();
      }
    });

    it('throws on an unknown deviceKey', async () => {
      const device = createMockUSBDevice();
      const usbStub = { requestDevice: vi.fn().mockResolvedValue(device) };
      vi.stubGlobal('navigator', { usb: usbStub });

      await expect(
        requestPrinters({ transport: 'usb', deviceKey: 'LW_BOGUS_999' }),
      ).rejects.toThrow(/unknown deviceKey "LW_BOGUS_999"/);
    });
  });

  describe('DeviceIdentificationRequiredError.continueWith', () => {
    it('continueWith(deviceKey) opens the originally-picked USBDevice', async () => {
      // The picked device has an unknown VID/PID, so auto-identify
      // fails — but the picked USBDevice is actually a real LW_450.
      // The operator resolves the ambiguity by calling `continueWith`
      // with the chosen key; the closure reuses the same USBDevice.
      const device = createMockUSBDevice(0x0922, 0x0020); // real LW_450 ids
      const usbStub = { requestDevice: vi.fn().mockResolvedValue(device) };
      vi.stubGlobal('navigator', { usb: usbStub });

      let err: unknown;
      try {
        // Force the unknown-VID branch by spying the registry lookup is
        // overkill — instead pick a device whose ids are unknown.
        const unknown = createMockUSBDevice(0xdead, 0xbeef);
        usbStub.requestDevice.mockResolvedValueOnce(unknown);
        await requestPrinters({ transport: 'usb' });
      } catch (e) {
        err = e;
      }
      if (!(err instanceof DeviceIdentificationRequiredError)) {
        throw new Error('expected DeviceIdentificationRequiredError');
      }
      // continueWith reuses the already-picked USBDevice (the unknown
      // one) — `fromUSBDeviceAll` re-checks its VID/PID and throws the
      // unsupported-device error because 0xdead:0xbeef is not registered.
      await expect(err.continueWith('LW_450')).rejects.toThrow(/Unsupported USB device/);
    });

    it('continueWith rejects an unknown deviceKey', async () => {
      const unknown = createMockUSBDevice(0xdead, 0xbeef);
      const usbStub = { requestDevice: vi.fn().mockResolvedValue(unknown) };
      vi.stubGlobal('navigator', { usb: usbStub });

      let err: unknown;
      try {
        await requestPrinters({ transport: 'usb' });
      } catch (e) {
        err = e;
      }
      if (!(err instanceof DeviceIdentificationRequiredError)) {
        throw new Error('expected DeviceIdentificationRequiredError');
      }
      await expect(err.continueWith('LW_BOGUS_999')).rejects.toThrow(
        /continueWith: unknown deviceKey "LW_BOGUS_999"/,
      );
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
