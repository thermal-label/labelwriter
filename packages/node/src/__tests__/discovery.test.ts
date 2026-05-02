import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('usb', async () => await import('./__mocks__/usb.js'));

const { usbOpen, tcpConnect, serialOpen } = vi.hoisted(() => ({
  usbOpen: vi.fn(),
  tcpConnect: vi.fn(),
  serialOpen: vi.fn(),
}));
vi.mock('@thermal-label/transport/node', () => ({
  UsbTransport: { open: usbOpen },
  TcpTransport: { connect: tcpConnect },
  SerialTransport: { open: serialOpen },
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
    serialOpen.mockReset();
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

    describe('TCP open', () => {
      it('opens a TCP printer when host + deviceKey are provided', async () => {
        tcpConnect.mockResolvedValue(fakeTransport());
        const printer = await discovery.openPrinter({
          host: '192.168.1.100',
          deviceKey: 'LW_550_TURBO',
        });
        expect(printer.transportType).toBe('tcp');
        expect(printer.device.key).toBe('LW_550_TURBO');
        expect(tcpConnect).toHaveBeenCalledWith('192.168.1.100', undefined);
      });

      it('passes port override to TcpTransport', async () => {
        tcpConnect.mockResolvedValue(fakeTransport());
        await discovery.openPrinter({
          host: '10.0.0.5',
          port: 9101,
          deviceKey: 'LW_5XL',
        });
        expect(tcpConnect).toHaveBeenCalledWith('10.0.0.5', 9101);
      });

      it('throws when deviceKey is missing', async () => {
        await expect(discovery.openPrinter({ host: '192.168.1.100' })).rejects.toThrow(
          /TCP open requires `deviceKey`/,
        );
      });

      it('throws when deviceKey is unknown', async () => {
        await expect(
          discovery.openPrinter({ host: '10.0.0.1', deviceKey: 'LW_FAKE_999' }),
        ).rejects.toThrow(/Unknown deviceKey/);
      });

      it('throws when descriptor has no TCP transport (e.g. plain LW_550)', async () => {
        // LW_550 (non-Turbo) is USB-only per the spec — no Ethernet.
        await expect(
          discovery.openPrinter({ host: '10.0.0.1', deviceKey: 'LW_550' }),
        ).rejects.toThrow(/has no TCP transport/);
      });

      it('routes 550 Turbo TCP to the 550 protocol path (would have been 450 pre-fix)', async () => {
        // Regression guard for the silent-misidentification bug:
        // pre-fix, opening any host picked LW_WIRELESS (lw-450) and
        // dispatched the 450 encoder, corrupting 550 jobs on the wire.
        tcpConnect.mockResolvedValue(fakeTransport());
        const printer = await discovery.openPrinter({
          host: '192.168.1.100',
          deviceKey: 'LW_550_TURBO',
        });
        expect(printer.device.engines[0]?.protocol).toBe('lw-550');
      });
    });

    describe('serial open', () => {
      it('opens via SerialTransport when serialPath + deviceKey are provided', async () => {
        serialOpen.mockResolvedValue(fakeTransport());
        const printer = await discovery.openPrinter({
          serialPath: '/dev/ttyUSB0',
          deviceKey: 'LW_330',
        });

        expect(serialOpen).toHaveBeenCalledWith('/dev/ttyUSB0', 115200);
        expect(printer.transportType).toBe('serial');
        expect(printer.device.key).toBe('LW_330');
      });

      it('falls back to descriptor.transports.serial.defaultBaud when baudRate omitted', async () => {
        serialOpen.mockResolvedValue(fakeTransport());
        await discovery.openPrinter({
          serialPath: '/dev/ttyUSB0',
          deviceKey: 'LW_EL40',
        });

        // EL40 defaultBaud per the registry is 19200
        expect(serialOpen).toHaveBeenCalledWith('/dev/ttyUSB0', 19200);
      });

      it('explicit baudRate overrides the descriptor default', async () => {
        serialOpen.mockResolvedValue(fakeTransport());
        await discovery.openPrinter({
          serialPath: '/dev/ttyUSB0',
          deviceKey: 'LW_330',
          baudRate: 9600,
        });
        expect(serialOpen).toHaveBeenCalledWith('/dev/ttyUSB0', 9600);
      });

      it('throws when deviceKey is missing', async () => {
        await expect(discovery.openPrinter({ serialPath: '/dev/ttyUSB0' })).rejects.toThrow(
          /Serial open requires `deviceKey`/,
        );
      });

      it('throws when deviceKey is unknown', async () => {
        await expect(
          discovery.openPrinter({
            serialPath: '/dev/ttyUSB0',
            deviceKey: 'LW_FAKE_999',
          }),
        ).rejects.toThrow(/Unknown deviceKey/);
      });

      it('throws when descriptor has no serial transport', async () => {
        // LW_4XL is USB+TCP only, no serial
        await expect(
          discovery.openPrinter({
            serialPath: '/dev/ttyUSB0',
            deviceKey: 'LW_4XL',
          }),
        ).rejects.toThrow(/has no serial transport/);
      });

      it('opens serial-only descriptors that have no USB PID', async () => {
        serialOpen.mockResolvedValue(fakeTransport());
        const printer = await discovery.openPrinter({
          serialPath: '/dev/ttyUSB0',
          deviceKey: 'LW_EL60',
        });
        expect(printer.device.transports.usb).toBeUndefined();
        expect(printer.device.transports.serial).toBeDefined();
        expect(serialOpen).toHaveBeenCalledWith('/dev/ttyUSB0', 19200);
      });
    });

    it('opens both interfaces for the LabelWriter Duo', async () => {
      __setDevices([makeDevice(0x0922, 0x0023)]);
      usbOpen.mockImplementation(() => Promise.resolve(fakeTransport()));

      const printer = await discovery.openPrinter({ pid: 0x0023 });

      expect(usbOpen).toHaveBeenCalledTimes(2);
      expect(usbOpen).toHaveBeenNthCalledWith(1, 0x0922, 0x0023, { bInterfaceNumber: 0 });
      expect(usbOpen).toHaveBeenNthCalledWith(2, 0x0922, 0x0023, { bInterfaceNumber: 1 });
      expect(Object.keys(printer.engines).sort()).toEqual(['label', 'tape']);
    });
  });
});
