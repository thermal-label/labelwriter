/* eslint-disable import-x/consistent-type-specifier-style */
import { describe, expect, it, vi } from 'vitest';
import { DEVICES } from '@thermal-label/labelwriter-core';
import type { DeviceDescriptor } from '@thermal-label/labelwriter-core';
import { WebLabelWriterPrinter } from '../printer.js';

function makeUSBDevice(descriptor: DeviceDescriptor): USBDevice {
  const statusResponse = new DataView(new ArrayBuffer(32));

  return {
    vendorId: descriptor.vid,
    productId: descriptor.pid,
    opened: true,
    transferOut: vi.fn(() => Promise.resolve({ bytesWritten: 0, status: 'ok' })),
    transferIn: vi.fn(() =>
      Promise.resolve({ data: statusResponse, status: 'ok' }),
    ),
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    claimInterface: vi.fn(() => Promise.resolve()),
    releaseInterface: vi.fn(() => Promise.resolve()),
    selectConfiguration: vi.fn(() => Promise.resolve()),
    selectAlternateInterface: vi.fn(() => Promise.resolve()),
    controlTransferOut: vi.fn(() => Promise.resolve({ bytesWritten: 0, status: 'ok' })),
    controlTransferIn: vi.fn(() => Promise.resolve({ data: new DataView(new ArrayBuffer(0)), status: 'ok' })),
    clearHalt: vi.fn(() => Promise.resolve()),
    reset: vi.fn(() => Promise.resolve()),
    isochronousTransferIn: vi.fn(),
    isochronousTransferOut: vi.fn(),
    configurations: [],
    configuration: undefined,
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
});
