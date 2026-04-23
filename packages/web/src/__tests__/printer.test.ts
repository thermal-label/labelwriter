/* eslint-disable import-x/consistent-type-specifier-style */
import { describe, expect, it, vi } from 'vitest';
import { DEVICES } from '@thermal-label/labelwriter-core';
import type { DeviceDescriptor } from '@thermal-label/labelwriter-core';
import { WebLabelWriterPrinter, fromUSBDevice } from '../printer.js';

function makeUSBDevice(descriptor: DeviceDescriptor): USBDevice {
  const statusResponse = new DataView(new ArrayBuffer(32));

  return {
    vendorId: descriptor.vid,
    productId: descriptor.pid,
    opened: true,
    transferOut: vi.fn(() => Promise.resolve({ bytesWritten: 0, status: 'ok' })),
    transferIn: vi.fn(() => Promise.resolve({ data: statusResponse, status: 'ok' })),
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    claimInterface: vi.fn(() => Promise.resolve()),
    releaseInterface: vi.fn(() => Promise.resolve()),
    selectConfiguration: vi.fn(() => Promise.resolve()),
    selectAlternateInterface: vi.fn(() => Promise.resolve()),
    controlTransferOut: vi.fn(() => Promise.resolve({ bytesWritten: 0, status: 'ok' })),
    controlTransferIn: vi.fn(() =>
      Promise.resolve({ data: new DataView(new ArrayBuffer(0)), status: 'ok' }),
    ),
    clearHalt: vi.fn(() => Promise.resolve()),
    reset: vi.fn(() => Promise.resolve()),
    isochronousTransferIn: vi.fn(),
    isochronousTransferOut: vi.fn(),
    configurations: [],
    configuration: {
      configurationValue: 1,
      configurationName: undefined,
      interfaces: [{
        interfaceNumber: 0,
        alternate: {
          alternateSetting: 0,
          interfaceClass: 7,
          interfaceSubclass: 1,
          interfaceProtocol: 2,
          interfaceName: undefined,
          endpoints: [
            { endpointNumber: 1, direction: 'out' as const, type: 'bulk' as const, packetSize: 64 },
            { endpointNumber: 2, direction: 'in' as const, type: 'bulk' as const, packetSize: 64 },
          ],
        },
        alternates: [],
        claimed: false,
      }],
    } as unknown as USBConfiguration,
    deviceClass: 0,
    deviceSubclass: 0,
    deviceProtocol: 0,
    deviceVersionMajor: 0,
    deviceVersionMinor: 0,
    deviceVersionSubminor: 0,
    usbVersionMajor: 2,
    usbVersionMinor: 0,
    usbVersionSubminor: 0,
    manufacturerName: undefined,
    productName: undefined,
    serialNumber: undefined,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    forget: vi.fn(() => Promise.resolve()),
  } as unknown as USBDevice;
}

describe('WebLabelWriterPrinter — 450 protocol', () => {
  const device450 = DEVICES.LW_450;

  it('getStatus reads 1 byte for 450 device', async () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    const status = await printer.getStatus();

    expect(vi.mocked(usbDevice.transferIn)).toHaveBeenCalledWith(2, 1);
    expect(status.rawBytes.length).toBe(1);
  });

  it('print sends reset command first (no job header) for 450', async () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    const bitmap = { widthPx: 672, heightPx: 10, data: new Uint8Array(Math.ceil(672 / 8) * 10) };
    await printer.print(bitmap);

    const calls = vi.mocked(usbDevice.transferOut).mock.calls;
    const firstData = calls[0]?.[1] as Uint8Array;
    expect(firstData[0]).toBe(0x1b);
    expect(firstData[1]).toBe(0x40);
  });

  it('isConnected returns device opened state', () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    expect(printer.isConnected()).toBe(true);
  });

  it('disconnect closes transport', async () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    await printer.disconnect();
    expect(vi.mocked(usbDevice.close)).toHaveBeenCalled();
  });

  it('recover sends error recovery and reads status', async () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    await printer.recover();
    expect(vi.mocked(usbDevice.transferOut)).toHaveBeenCalled();
    expect(vi.mocked(usbDevice.transferIn)).toHaveBeenCalledWith(2, 1);
  });
});

describe('fromUSBDevice', () => {
  it('wraps a known device in WebLabelWriterPrinter', () => {
    const usbDevice = makeUSBDevice(DEVICES.LW_450);
    const printer = fromUSBDevice(usbDevice);
    expect(printer.descriptor.pid).toBe(DEVICES.LW_450.pid);
  });

  it('throws for unknown device', () => {
    const unknownDevice = makeUSBDevice({ ...DEVICES.LW_450, vid: 0x9999, pid: 0x9999 });
    expect(() => fromUSBDevice(unknownDevice)).toThrow();
  });
});

describe('WebLabelWriterPrinter — 550 protocol', () => {
  const device550 = DEVICES.LW_550;

  it('getStatus reads 32 bytes for 550 device', async () => {
    const usbDevice = makeUSBDevice(device550);
    const printer = new WebLabelWriterPrinter(usbDevice, device550);
    await printer.getStatus();
    expect(vi.mocked(usbDevice.transferIn)).toHaveBeenCalledWith(2, 32);
  });

  it('print sends job header first for 550', async () => {
    const usbDevice = makeUSBDevice(device550);
    const printer = new WebLabelWriterPrinter(usbDevice, device550);
    const bitmap = { widthPx: 672, heightPx: 10, data: new Uint8Array(Math.ceil(672 / 8) * 10) };
    await printer.print(bitmap);

    const calls = vi.mocked(usbDevice.transferOut).mock.calls;
    const firstData = calls[0]?.[1] as Uint8Array;
    expect(firstData[0]).toBe(0x1b);
    expect(firstData[1]).toBe(0x73);
  });

  it('printText sends bytes to transport', async () => {
    const usbDevice = makeUSBDevice(device550);
    const printer = new WebLabelWriterPrinter(usbDevice, device550);
    await printer.printText('Hello');
    expect(vi.mocked(usbDevice.transferOut)).toHaveBeenCalled();
  });

  it('recover reads 32 bytes for 550', async () => {
    const usbDevice = makeUSBDevice(device550);
    const printer = new WebLabelWriterPrinter(usbDevice, device550);
    await printer.recover();
    expect(vi.mocked(usbDevice.transferIn)).toHaveBeenCalledWith(2, 32);
  });
});

describe('WebLabelWriterPrinter — printImage', () => {
  const device450 = DEVICES.LW_450;

  it('printImage calls transferOut with image data', async () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    const imageData = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4),
      colorSpace: 'srgb' as const,
    } as unknown as ImageData;
    await printer.printImage(imageData);
    expect(vi.mocked(usbDevice.transferOut)).toHaveBeenCalled();
  });

  it('printImage passes threshold option', async () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    const imageData = {
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4),
      colorSpace: 'srgb' as const,
    } as unknown as ImageData;
    await printer.printImage(imageData, { threshold: 64, invert: true, dither: true, rotate: 90 });
    expect(vi.mocked(usbDevice.transferOut)).toHaveBeenCalled();
  });
});

describe('WebLabelWriterPrinter — printImageURL', () => {
  const device450 = DEVICES.LW_450;

  it('throws when canvas context is unavailable (jsdom has no canvas)', async () => {
    const usbDevice = makeUSBDevice(device450);
    const printer = new WebLabelWriterPrinter(usbDevice, device450);

    // jsdom does not load images; mock Image to call onload immediately
    const origImage = globalThis.Image;
    globalThis.Image = class MockImg {
      naturalWidth = 8;
      naturalHeight = 8;
      set src(_: string) {
        requestAnimationFrame(() => {
          this.onload?.();
        });
      }
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
    } as unknown as typeof Image;

    // Stub getContext to return null directly, avoiding jsdom's "not implemented"
    // warning for HTMLCanvasElement.getContext. The printer must reject when 2d
    // context is unavailable.
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);

    await expect(printer.printImageURL('data:image/png;base64,abc')).rejects.toThrow();

    getContextSpy.mockRestore();
    globalThis.Image = origImage;
  });
});

describe('requestPrinter', () => {
  it('calls navigator.usb.requestDevice and wraps result', async () => {
    const { requestPrinter: req } = await import('../printer.js');
    const fakeDevice = makeUSBDevice(DEVICES.LW_450);
    Object.defineProperty(navigator, 'usb', {
      value: { requestDevice: vi.fn(() => Promise.resolve(fakeDevice)) },
      writable: true,
      configurable: true,
    });
    const printer = await req();
    expect(printer.descriptor.pid).toBe(DEVICES.LW_450.pid);
  });
});

describe('WebLabelWriterPrinter — status parsing', () => {
  it('reports cover-open when bit 0x08 set', async () => {
    const device450 = DEVICES.LW_450;
    const statusData = new DataView(new ArrayBuffer(1));
    statusData.setUint8(0, 0x08);
    const usbDevice = makeUSBDevice(device450);
    vi.mocked(usbDevice.transferIn).mockReturnValue(
      Promise.resolve({ data: statusData, status: 'ok' }),
    );
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    const status = await printer.getStatus();
    expect(status.errors).toContain('Cover open');
    expect(status.ready).toBe(false);
  });

  it('paper-out when bit 0x01 set', async () => {
    const device450 = DEVICES.LW_450;
    const statusData = new DataView(new ArrayBuffer(1));
    statusData.setUint8(0, 0x01);
    const usbDevice = makeUSBDevice(device450);
    vi.mocked(usbDevice.transferIn).mockReturnValue(
      Promise.resolve({ data: statusData, status: 'ok' }),
    );
    const printer = new WebLabelWriterPrinter(usbDevice, device450);
    const status = await printer.getStatus();
    expect(status.paperOut).toBe(true);
  });
});
