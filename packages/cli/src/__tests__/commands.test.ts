/* eslint-disable import-x/consistent-type-specifier-style */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

const mockPrinter = vi.hoisted(() => ({
  getStatus: vi.fn(),
  printText: vi.fn(),
  printImage: vi.fn(),
  recover: vi.fn(),
  close: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  listPrinters: vi.fn(),
  openPrinter: vi.fn(),
  openPrinterTcp: vi.fn(),
}));

vi.mock('@thermal-label/labelwriter-node', () => ({
  listPrinters: mocks.listPrinters,
  openPrinter: mocks.openPrinter,
  openPrinterTcp: mocks.openPrinterTcp,
}));

import { runList } from '../commands/list.js';
import { runStatus } from '../commands/status.js';
import { runPrintText } from '../commands/print-text.js';
import { runPrintImage } from '../commands/print-image.js';
import { runRecover } from '../commands/recover.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrinter.getStatus.mockResolvedValue({ ready: true, paperOut: false, errors: [], rawBytes: new Uint8Array(1) });
  mockPrinter.printText.mockReturnValue(Promise.resolve());
  mockPrinter.printImage.mockReturnValue(Promise.resolve());
  mockPrinter.recover.mockReturnValue(Promise.resolve());
  mockPrinter.close.mockReturnValue(Promise.resolve());
  (mocks.openPrinter as MockInstance).mockReturnValue(Promise.resolve(mockPrinter));
  (mocks.openPrinterTcp as MockInstance).mockReturnValue(Promise.resolve(mockPrinter));
});

describe('runList', () => {
  it('prints message when no printers found', () => {
    mocks.listPrinters.mockReturnValue([]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => { /**/ });
    runList();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('lists printers when found', () => {
    mocks.listPrinters.mockReturnValue([
      {
        device: { name: 'LabelWriter 450', vid: 0x0922, pid: 0x0029 },
        serialNumber: 'ABC123',
        path: 'usb:1:2',
        transport: 'usb' as const,
      },
    ]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => { /**/ });
    runList();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('runStatus', () => {
  it('opens USB printer and calls getStatus', async () => {
    await runStatus({});
    expect(mocks.openPrinter).toHaveBeenCalled();
    expect(mockPrinter.getStatus).toHaveBeenCalled();
    expect(mockPrinter.close).toHaveBeenCalled();
  });

  it('opens TCP printer when host provided', async () => {
    await runStatus({ host: '192.168.1.1' });
    expect(mocks.openPrinterTcp).toHaveBeenCalledWith('192.168.1.1');
    expect(mockPrinter.getStatus).toHaveBeenCalled();
  });

  it('passes serial number to openPrinter', async () => {
    await runStatus({ serial: 'SN123' });
    expect(mocks.openPrinter).toHaveBeenCalledWith({ serialNumber: 'SN123' });
  });
});

describe('runPrintText', () => {
  it('calls printText with text', async () => {
    await runPrintText('Hello', {});
    expect(mockPrinter.printText).toHaveBeenCalledWith('Hello', expect.any(Object));
    expect(mockPrinter.close).toHaveBeenCalled();
  });

  it('passes invert option', async () => {
    await runPrintText('Hi', { invert: true });
    expect(mockPrinter.printText).toHaveBeenCalledWith('Hi', expect.objectContaining({ invert: true }));
  });

  it('passes density option', async () => {
    await runPrintText('Hi', { density: 'high' });
    expect(mockPrinter.printText).toHaveBeenCalledWith('Hi', expect.objectContaining({ density: 'high' }));
  });

  it('passes copies option', async () => {
    await runPrintText('Hi', { copies: '3' });
    expect(mockPrinter.printText).toHaveBeenCalledWith('Hi', expect.objectContaining({ copies: 3 }));
  });

  it('uses TCP transport when host provided', async () => {
    await runPrintText('Hi', { host: '10.0.0.1' });
    expect(mocks.openPrinterTcp).toHaveBeenCalledWith('10.0.0.1');
  });
});

describe('runPrintImage', () => {
  it('calls printImage with file path', async () => {
    await runPrintImage('/tmp/label.png', {});
    expect(mockPrinter.printImage).toHaveBeenCalledWith('/tmp/label.png', expect.any(Object));
    expect(mockPrinter.close).toHaveBeenCalled();
  });

  it('passes threshold option', async () => {
    await runPrintImage('/tmp/label.png', { threshold: '128' });
    expect(mockPrinter.printImage).toHaveBeenCalledWith('/tmp/label.png', expect.objectContaining({ threshold: 128 }));
  });

  it('passes rotate option', async () => {
    await runPrintImage('/tmp/label.png', { rotate: '90' });
    expect(mockPrinter.printImage).toHaveBeenCalledWith('/tmp/label.png', expect.objectContaining({ rotate: 90 }));
  });

  it('uses TCP transport when host provided', async () => {
    await runPrintImage('/tmp/label.png', { host: '10.0.0.1' });
    expect(mocks.openPrinterTcp).toHaveBeenCalledWith('10.0.0.1');
  });
});

describe('runRecover', () => {
  it('calls recover on printer', async () => {
    await runRecover({});
    expect(mockPrinter.recover).toHaveBeenCalled();
    expect(mockPrinter.close).toHaveBeenCalled();
  });

  it('uses TCP transport when host provided', async () => {
    await runRecover({ host: '10.0.0.1' });
    expect(mocks.openPrinterTcp).toHaveBeenCalledWith('10.0.0.1');
  });
});
