import { DEVICES, findDevice, type DeviceEntry } from '@thermal-label/labelwriter-core';
import type { DiscoveredPrinter, OpenOptions, PrinterDiscovery } from '@thermal-label/contracts';
import { TcpTransport, UsbTransport } from '@thermal-label/transport/node';
import * as usb from 'usb';
import { LabelWriterPrinter } from './printer.js';

function parseHex(s: string): number {
  return Number.parseInt(s, 16);
}

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
  { device: usb.Device; descriptor: DeviceEntry; serialNumber: string | undefined }[]
> {
  const results: {
    device: usb.Device;
    descriptor: DeviceEntry;
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
      const descriptor = Object.values(DEVICES).find(d => d.transports.tcp !== undefined);
      if (!descriptor) throw new Error('No network-capable LabelWriter descriptor found.');
      return new LabelWriterPrinter(descriptor, transport, 'tcp');
    }

    const found = await enumerateUsbDevices();
    const match = found.find(entry => {
      const usbT = entry.descriptor.transports.usb;
      if (!usbT) return false;
      if (options.vid !== undefined && parseHex(usbT.vid) !== options.vid) return false;
      if (options.pid !== undefined && parseHex(usbT.pid) !== options.pid) return false;
      if (options.serialNumber !== undefined && entry.serialNumber !== options.serialNumber)
        return false;
      return true;
    });

    if (!match) throw new Error('No compatible Dymo LabelWriter printer found.');

    const matchUsb = match.descriptor.transports.usb;
    if (!matchUsb) throw new Error(`Device ${match.descriptor.key} has no USB transport.`);
    const transport = await UsbTransport.open(parseHex(matchUsb.vid), parseHex(matchUsb.pid));
    return new LabelWriterPrinter(match.descriptor, transport, 'usb');
  }
}

/**
 * Named export discovered by the unified `thermal-label-cli` — the CLI
 * walks installed drivers looking for `mod.discovery`.
 */
export const discovery = new LabelWriterDiscovery();
