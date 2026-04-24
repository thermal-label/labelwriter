import { DEVICES, findDevice, type LabelWriterDevice } from '@thermal-label/labelwriter-core';
/* eslint-disable import-x/consistent-type-specifier-style */
import type { DiscoveredPrinter, OpenOptions, PrinterDiscovery } from '@thermal-label/contracts';
import { TcpTransport, UsbTransport } from '@thermal-label/transport/node';
import * as usb from 'usb';
import { LabelWriterPrinter } from './printer.js';

async function readSerialNumber(device: usb.Device): Promise<string | undefined> {
  const idx = device.deviceDescriptor.iSerialNumber;
  if (!idx) return undefined;
  return new Promise(resolve => {
    device.getStringDescriptor(idx, (err, value) => {
      resolve(err ? undefined : value);
    });
  });
}

async function enumerateUsbDevices(): Promise<
  { device: usb.Device; descriptor: LabelWriterDevice; serialNumber: string | undefined }[]
> {
  const results: {
    device: usb.Device;
    descriptor: LabelWriterDevice;
    serialNumber: string | undefined;
  }[] = [];

  for (const device of usb.getDeviceList()) {
    const { idVendor, idProduct, iSerialNumber } = device.deviceDescriptor;
    const descriptor = findDevice(idVendor, idProduct);
    if (!descriptor) continue;

    let serialNumber: string | undefined;
    if (iSerialNumber) {
      device.open();
      try {
        serialNumber = await readSerialNumber(device);
      } finally {
        device.close();
      }
    }

    results.push({ device, descriptor, serialNumber });
  }

  return results;
}

/**
 * `PrinterDiscovery` implementation for Dymo LabelWriter printers.
 *
 * `listPrinters()` only enumerates USB — there is no mDNS / DNS-SD
 * implementation for the networked 550 Turbo / 5XL / Wireless. Network
 * printers are opened by explicit `openPrinter({ host, port })`.
 */
export class LabelWriterDiscovery implements PrinterDiscovery {
  readonly family = 'labelwriter';

  async listPrinters(): Promise<DiscoveredPrinter[]> {
    const found = await enumerateUsbDevices();
    return found.map(({ device, descriptor, serialNumber }) => ({
      device: descriptor,
      ...(serialNumber === undefined ? {} : { serialNumber }),
      transport: 'usb' as const,
      connectionId: `${String(device.busNumber)}:${String(device.deviceAddress)}`,
    }));
  }

  async openPrinter(options: OpenOptions = {}): Promise<LabelWriterPrinter> {
    if (options.host !== undefined) {
      const transport = await TcpTransport.connect(options.host, options.port);
      const descriptor = Object.values(DEVICES).find(d => d.network !== 'none');
      if (!descriptor) throw new Error('No network-capable LabelWriter descriptor found.');
      return new LabelWriterPrinter(descriptor, transport, 'tcp');
    }

    const found = await enumerateUsbDevices();
    const match = found.find(entry => {
      if (options.vid !== undefined && entry.descriptor.vid !== options.vid) return false;
      if (options.pid !== undefined && entry.descriptor.pid !== options.pid) return false;
      if (options.serialNumber !== undefined && entry.serialNumber !== options.serialNumber)
        return false;
      return true;
    });

    if (!match) throw new Error('No compatible Dymo LabelWriter printer found.');

    const transport = await UsbTransport.open(match.descriptor.vid, match.descriptor.pid);
    return new LabelWriterPrinter(match.descriptor, transport, 'usb');
  }
}

/**
 * Named export discovered by the unified `thermal-label-cli` — the CLI
 * walks installed drivers looking for `mod.discovery`.
 */
export const discovery = new LabelWriterDiscovery();
