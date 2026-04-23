/* eslint-disable import-x/consistent-type-specifier-style */
import { DEVICES, findDevice } from '@thermal-label/labelwriter-core';
import * as usb from 'usb';
import { LabelWriterPrinter } from './printer.js';
import { UsbTransport, TcpTransport } from './transport.js';
import type { OpenOptions, PrinterInfo } from './types.js';

async function readSerialNumber(device: usb.Device): Promise<string | undefined> {
  const idx = device.deviceDescriptor.iSerialNumber;
  if (!idx) return undefined;
  return new Promise(resolve => {
    device.getStringDescriptor(idx, (err, value) => {
      resolve(err ? undefined : value);
    });
  });
}

export function listPrinters(): PrinterInfo[] {
  const devices = usb.getDeviceList();
  const results: PrinterInfo[] = [];

  for (const device of devices) {
    const { idVendor, idProduct } = device.deviceDescriptor;
    const descriptor = findDevice(idVendor, idProduct);
    if (!descriptor) continue;

    results.push({
      device: descriptor,
      serialNumber: undefined,
      path: `${String(device.busNumber)}:${String(device.deviceAddress)}`,
      transport: 'usb',
    });
  }

  return results;
}

export async function openPrinter(options: OpenOptions = {}): Promise<LabelWriterPrinter> {
  const devices = usb.getDeviceList();

  for (const device of devices) {
    const { idVendor, idProduct } = device.deviceDescriptor;
    const descriptor = findDevice(idVendor, idProduct);
    if (!descriptor) continue;
    if (options.vid !== undefined && idVendor !== options.vid) continue;
    if (options.pid !== undefined && idProduct !== options.pid) continue;

    device.open();

    if (options.serialNumber !== undefined) {
      const serial = await readSerialNumber(device);
      if (serial !== options.serialNumber) {
        device.close();
        continue;
      }
    }

    try {
      const xport = UsbTransport.open(idVendor, idProduct);
      return new LabelWriterPrinter(descriptor, xport, 'usb');
    } catch (err) {
      device.close();
      throw err;
    }
  }

  throw new Error('No compatible Dymo LabelWriter printer found.');
}

export async function openPrinterTcp(host: string, port?: number): Promise<LabelWriterPrinter> {
  const xport = await TcpTransport.connect(host, port);

  const knownNetworkDevices = Object.values(DEVICES).filter(d => d.network !== 'none');
  const descriptor = knownNetworkDevices[0];
  if (!descriptor) throw new Error('No network-capable device descriptor found');

  return new LabelWriterPrinter(descriptor, xport, 'tcp');
}
