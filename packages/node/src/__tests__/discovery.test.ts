import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('usb', async () => await import('./__mocks__/usb.js'));

import { __setDevices, makeDevice } from './__mocks__/usb.js';
import { listPrinters } from '../discovery.js';

describe('listPrinters', () => {
  beforeEach(() => {
    __setDevices([]);
  });

  it('returns empty array when no devices connected', () => {
    expect(listPrinters()).toEqual([]);
  });

  it('filters out non-LabelWriter devices', () => {
    __setDevices([
      makeDevice(0x0922, 0x9999),
      makeDevice(0x1234, 0x0029),
    ]);
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
    __setDevices([
      makeDevice(0x0922, 0x0029),
      makeDevice(0x0922, 0x0052),
    ]);
    expect(listPrinters()).toHaveLength(2);
  });
});
