import { DEVICES, findDevice, type DeviceEntry } from '@thermal-label/labelwriter-core';
import type { DiscoveredPrinter, OpenOptions, PrinterDiscovery } from '@thermal-label/contracts';
import { SerialTransport, TcpTransport, UsbTransport } from '@thermal-label/transport/node';
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
    if (options.serialPath !== undefined) {
      return openSerial(options);
    }

    if (options.host !== undefined) {
      return openTcp(options);
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
    const vid = parseHex(matchUsb.vid);
    const pid = parseHex(matchUsb.pid);

    const labelBind = match.descriptor.engines.find(e => e.role === 'label')?.bind?.usb;
    const labelInterface = labelBind?.bInterfaceNumber;
    const transport =
      labelInterface !== undefined
        ? await UsbTransport.open(vid, pid, { bInterfaceNumber: labelInterface })
        : await UsbTransport.open(vid, pid);

    // Composite-USB devices (Duo) declare a second engine with its own
    // `bInterfaceNumber`. Open it as a sibling transport so the tape
    // engine becomes drivable. The shared device cache in
    // `@thermal-label/transport` reference-counts the underlying libusb
    // handle so closing one transport does not invalidate the other.
    const tapeBind = match.descriptor.engines.find(e => e.role === 'tape')?.bind?.usb;
    if (tapeBind?.bInterfaceNumber !== undefined) {
      const tapeTransport = await UsbTransport.open(vid, pid, {
        bInterfaceNumber: tapeBind.bInterfaceNumber,
      });
      return new LabelWriterPrinter(match.descriptor, transport, 'usb', {
        engineTransports: { tape: tapeTransport },
      });
    }

    return new LabelWriterPrinter(match.descriptor, transport, 'usb');
  }
}

/**
 * Open a printer over TCP.
 *
 * TCP, like serial, has no transport-level model signal — multiple
 * LabelWriter generations (450 wireless, 550 Turbo, 5XL) all answer
 * on port 9100 with their own protocol dialect. The caller must
 * declare which model is on the other end via `deviceKey`.
 *
 * Pre-fix behaviour silently picked the first registry entry with a
 * TCP transport (`LW_WIRELESS`, a 450-protocol device), so a real
 * 550 Turbo / 5XL opened by `host` got dispatched to the 450
 * encoder and produced a corrupt job stream. Failing loudly here
 * is correct.
 */
async function openTcp(opts: OpenOptions): Promise<LabelWriterPrinter> {
  if (opts.host === undefined) {
    throw new Error('openTcp requires `host`.');
  }
  if (opts.deviceKey === undefined) {
    const tcpKeys = Object.values(DEVICES)
      .filter(d => d.transports.tcp !== undefined)
      .map(d => d.key)
      .sort();
    throw new Error(
      `TCP open requires \`deviceKey\` — port 9100 carries no model signal, so the model must be declared. ` +
        `Available TCP-capable LabelWriter keys: ${tcpKeys.join(', ')}.`,
    );
  }

  const descriptor = (DEVICES as Record<string, DeviceEntry | undefined>)[opts.deviceKey];
  if (!descriptor) {
    throw new Error(
      `Unknown deviceKey "${opts.deviceKey}". Available LabelWriter keys: ${Object.keys(DEVICES).sort().join(', ')}.`,
    );
  }

  if (!descriptor.transports.tcp) {
    throw new Error(
      `Device ${descriptor.key} has no TCP transport — it cannot be opened over \`host\`.`,
    );
  }

  const transport = await TcpTransport.connect(opts.host, opts.port);
  return new LabelWriterPrinter(descriptor, transport, 'tcp');
}

/**
 * Open a printer over a serial port.
 *
 * RS-232 has no enumeration, so the caller must declare which model is
 * on the other end via `deviceKey`. Trying to probe blindly would mean
 * writing arbitrary bytes to an unidentified UART, which is rude and
 * not always reversible — fail loudly instead.
 *
 * The baud rate falls back to the descriptor's `transports.serial.defaultBaud`
 * (per the plan, 115 200 for 300/330/Turbo, 19 200 for EL40/EL60,
 * 9 600 for SE450). Pass `baudRate` to override.
 */
async function openSerial(opts: OpenOptions): Promise<LabelWriterPrinter> {
  if (opts.serialPath === undefined) {
    throw new Error('openSerial requires `serialPath`.');
  }
  if (opts.deviceKey === undefined) {
    const serialKeys = Object.values(DEVICES)
      .filter(d => d.transports.serial !== undefined)
      .map(d => d.key)
      .sort();
    throw new Error(
      `Serial open requires \`deviceKey\` — RS-232 has no enumeration, so the model must be declared. ` +
        `Available serial-capable LabelWriter keys: ${serialKeys.join(', ')}.`,
    );
  }

  const descriptor = (DEVICES as Record<string, DeviceEntry | undefined>)[opts.deviceKey];
  if (!descriptor) {
    throw new Error(
      `Unknown deviceKey "${opts.deviceKey}". Available LabelWriter keys: ${Object.keys(DEVICES).sort().join(', ')}.`,
    );
  }

  const serialT = descriptor.transports.serial;
  if (!serialT) {
    throw new Error(
      `Device ${descriptor.key} has no serial transport — it cannot be opened over \`serialPath\`.`,
    );
  }

  const baudRate = opts.baudRate ?? serialT.defaultBaud;
  const transport = await SerialTransport.open(opts.serialPath, baudRate);
  return new LabelWriterPrinter(descriptor, transport, 'serial');
}

/**
 * Named export discovered by the unified `thermal-label-cli` — the CLI
 * walks installed drivers looking for `mod.discovery`.
 */
export const discovery = new LabelWriterDiscovery();
