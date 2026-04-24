import { describe, expect, it } from 'vitest';
import { MediaNotSpecifiedError } from '@thermal-label/contracts';
import { DEVICES, MEDIA } from '@thermal-label/labelwriter-core';
import { fromUSBDevice } from '../printer.js';
import { createMockUSBDevice } from './webusb-mock.js';

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

describe('WebLabelWriterPrinter', () => {
  it('exposes adapter metadata', async () => {
    const device = createMockUSBDevice(DEVICES.LW_450.vid, DEVICES.LW_450.pid);
    const printer = await fromUSBDevice(device);
    expect(printer.family).toBe('labelwriter');
    expect(printer.model).toBe('LabelWriter 450');
    expect(printer.device).toEqual(DEVICES.LW_450);
  });

  it('print() writes encoded bytes to WebUSB with explicit media', async () => {
    const device = createMockUSBDevice(DEVICES.LW_450.vid, DEVICES.LW_450.pid);
    const printer = await fromUSBDevice(device);
    await printer.print(solidRgba(672, 10), MEDIA.ADDRESS_STANDARD);

    expect(device.__transfers.length).toBeGreaterThan(0);
    expect(device.__transfers[0]!.data[0]).toBe(0x1b);
    expect(device.__transfers[0]!.data[1]).toBe(0x40);
  });

  it('print() throws MediaNotSpecifiedError without media', async () => {
    const device = createMockUSBDevice(DEVICES.LW_450.vid, DEVICES.LW_450.pid);
    const printer = await fromUSBDevice(device);
    await expect(printer.print(solidRgba(672, 10))).rejects.toBeInstanceOf(MediaNotSpecifiedError);
  });

  it('getStatus returns the contracts shape on the 450', async () => {
    const device = createMockUSBDevice(DEVICES.LW_450.vid, DEVICES.LW_450.pid);
    const printer = await fromUSBDevice(device);
    const status = await printer.getStatus();
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('getStatus reads 32 bytes on the 550 and detects media', async () => {
    const bytes = new Uint8Array(32);
    bytes[4] = 28;
    bytes[6] = 89;
    const device = createMockUSBDevice(DEVICES.LW_550.vid, DEVICES.LW_550.pid, bytes);
    const printer = await fromUSBDevice(device);
    const status = await printer.getStatus();
    expect(status.rawBytes.length).toBe(32);
    expect(status.detectedMedia).toEqual(MEDIA.ADDRESS_STANDARD);
  });

  it('close() closes the transport', async () => {
    const device = createMockUSBDevice(DEVICES.LW_450.vid, DEVICES.LW_450.pid);
    const printer = await fromUSBDevice(device);
    await printer.close();
    expect(device.opened).toBe(false);
    expect(printer.connected).toBe(false);
  });

  it('throws for unknown USB devices', async () => {
    const device = createMockUSBDevice(0x1234, 0x5678);
    await expect(fromUSBDevice(device)).rejects.toThrow('Unsupported USB device');
  });
});
