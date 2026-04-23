import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('usb', async () => await import('./__mocks__/usb.js'));

import { __setDevices, makeDevice } from './__mocks__/usb.js';
import { listPrinters, openPrinter } from '../discovery.js';

describe('listPrinters', () => {
  beforeEach(() => {
    __setDevices([]);
  });

  it('returns empty array when no devices connected', () => {
    expect(listPrinters()).toEqual([]);
  });

  it('filters out non-LabelWriter devices', () => {
    __setDevices([makeDevice(0x0922, 0x9999), makeDevice(0x1234, 0x0029)]);
    expect(listPrinters()).toHaveLength(0);
  });

  it('returns known LabelWriter devices', () => {
    __setDevices([makeDevice(0x0922, 0x0029)]);
    const printers = listPrinters();
    expect(printers).toHaveLength(1);
    expect(printers[0]!.device.name).toBe('LabelWriter 450');
    expect(printers[0]!.transport).toBe('usb');
  });

  it('returns correct path as busNumber:deviceAddress', () => {
    __setDevices([makeDevice(0x0922, 0x0029, undefined, 3, 5)]);
    const printers = listPrinters();
    expect(printers[0]!.path).toBe('3:5');
  });

  it('returns multiple devices', () => {
    __setDevices([makeDevice(0x0922, 0x0029), makeDevice(0x0922, 0x0052)]);
    expect(listPrinters()).toHaveLength(2);
  });
});

describe('openPrinter', () => {
  beforeEach(() => {
    __setDevices([]);
  });

  it('throws when no device found', async () => {
    __setDevices([]);
    await expect(openPrinter()).rejects.toThrow();
  });

  it('returns LabelWriterPrinter for first known device', async () => {
    __setDevices([makeDevice(0x0922, 0x0029)]);
    const printer = await openPrinter();
    expect(printer.device.pid).toBe(0x0029);
    await printer.close();
  });

  it('skips unknown devices', async () => {
    __setDevices([makeDevice(0x9999, 0x9999), makeDevice(0x0922, 0x0029)]);
    const printer = await openPrinter();
    expect(printer.device.pid).toBe(0x0029);
    await printer.close();
  });

  it('filters by pid', async () => {
    __setDevices([makeDevice(0x0922, 0x0029), makeDevice(0x0922, 0x002a)]);
    const printer = await openPrinter({ pid: 0x002a });
    expect(printer.device.pid).toBe(0x002a);
    await printer.close();
  });

  it('matches device by serial number', async () => {
    __setDevices([makeDevice(0x0922, 0x0029, 'SN-TARGET')]);
    const printer = await openPrinter({ serialNumber: 'SN-TARGET' });
    expect(printer.device.pid).toBe(0x0029);
    await printer.close();
  });

  it('skips device when serial does not match', async () => {
    __setDevices([makeDevice(0x0922, 0x0029, 'OTHER-SN')]);
    await expect(openPrinter({ serialNumber: 'NOT-FOUND' })).rejects.toThrow();
  });
});
