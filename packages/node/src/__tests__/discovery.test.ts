import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('usb', async () => await import('./__mocks__/usb.js'));

const { usbOpen, tcpConnect } = vi.hoisted(() => ({
  usbOpen: vi.fn(),
  tcpConnect: vi.fn(),
}));
vi.mock('@thermal-label/transport/node', () => ({
  UsbTransport: { open: usbOpen },
  TcpTransport: { connect: tcpConnect },
}));

import { __setDevices, makeDevice } from './__mocks__/usb.js';
import { discovery } from '../discovery.js';

function fakeTransport(): {
  connected: boolean;
  write: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  return {
    connected: true,
    write: vi.fn(),
    read: vi.fn(),
    close: vi.fn(),
  };
}

describe('LabelWriterDiscovery', () => {
  beforeEach(() => {
    __setDevices([]);
    usbOpen.mockReset();
    tcpConnect.mockReset();
  });

  it('exposes the labelwriter family', () => {
    expect(discovery.family).toBe('labelwriter');
  });

  describe('listPrinters', () => {
    it('returns empty array when no devices connected', async () => {
      expect(await discovery.listPrinters()).toEqual([]);
    });

    it('filters out non-LabelWriter devices', async () => {
      __setDevices([makeDevice(0x0922, 0x9999), makeDevice(0x1234, 0x0020)]);
      expect(await discovery.listPrinters()).toHaveLength(0);
    });

    it('returns known LabelWriter devices with connection metadata', async () => {
      __setDevices([makeDevice(0x0922, 0x0020, undefined, 3, 5)]);
      const printers = await discovery.listPrinters();
      expect(printers).toHaveLength(1);
      expect(printers[0]!.device.name).toBe('LabelWriter 450');
      expect(printers[0]!.transport).toBe('usb');
      expect(printers[0]!.connectionId).toBe('3:5');
    });

    it('returns multiple devices', async () => {
      __setDevices([makeDevice(0x0922, 0x0020), makeDevice(0x0922, 0x0028)]);
      expect(await discovery.listPrinters()).toHaveLength(2);
    });
  });

  describe('openPrinter', () => {
    it('throws when no device is attached', async () => {
      await expect(discovery.openPrinter()).rejects.toThrow();
    });

    it('opens the first matching USB device via UsbTransport', async () => {
      __setDevices([makeDevice(0x0922, 0x0020)]);
      usbOpen.mockResolvedValue(fakeTransport());

      const printer = await discovery.openPrinter();
      expect(printer.device.transports.usb?.pid).toBe('0x0020');
      expect(usbOpen).toHaveBeenCalledWith(0x0922, 0x0020);
    });

    it('filters by pid', async () => {
      __setDevices([makeDevice(0x0922, 0x0020), makeDevice(0x0922, 0x002a)]);
      usbOpen.mockResolvedValue(fakeTransport());

      const printer = await discovery.openPrinter({ pid: 0x002a });
      expect(printer.device.transports.usb?.pid).toBe('0x002a');
      expect(usbOpen).toHaveBeenCalledWith(0x0922, 0x002a);
    });

    it('matches by serial number', async () => {
      __setDevices([makeDevice(0x0922, 0x0020, 'SN-A'), makeDevice(0x0922, 0x0020, 'SN-TARGET')]);
      usbOpen.mockResolvedValue(fakeTransport());

      const printer = await discovery.openPrinter({ serialNumber: 'SN-TARGET' });
      expect(printer.device.transports.usb?.pid).toBe('0x0020');
    });

    it('opens a TCP printer when host is provided', async () => {
      tcpConnect.mockResolvedValue(fakeTransport());

      const printer = await discovery.openPrinter({ host: '192.168.1.100' });
      expect(printer.transportType).toBe('tcp');
      expect(tcpConnect).toHaveBeenCalledWith('192.168.1.100', undefined);
    });

    it('passes port override to TcpTransport', async () => {
      tcpConnect.mockResolvedValue(fakeTransport());

      await discovery.openPrinter({ host: '10.0.0.5', port: 9101 });
      expect(tcpConnect).toHaveBeenCalledWith('10.0.0.5', 9101);
    });
  });
});
