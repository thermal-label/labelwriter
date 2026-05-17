import {
  DeviceIdentificationRequiredError,
  type ConnectOptions,
  type DeviceEntry,
  type PrinterAdapterMap,
  type TransportType,
} from '@thermal-label/contracts';
import { DEVICES, findDevice } from '@thermal-label/labelwriter-core';
import { DEFAULT_FILTERS, fromUSBDeviceAll } from './printer.js';

/**
 * Unified browser-picker factory for the labelwriter driver family.
 *
 * LabelWriter devices are USB-only — the registry declares no other
 * transports. Non-USB transports throw immediately.
 *
 * USB path: opens the picker, auto-identifies via VID/PID against the
 * registry. Composite devices (LW 450 Duo) get one transport per
 * engine (label on IF 0, tape on IF 1) so the returned
 * `PrinterAdapterMap` has one entry per engine role. Single-engine
 * devices return a 1-key map.
 *
 * Throws `DeviceIdentificationRequiredError` (with USB-capable
 * candidates + a `continueWith` closure reusing the picked
 * USBDevice) when the picked device's VID/PID is not in the
 * labelwriter registry.
 */
export async function requestPrinters(opts: ConnectOptions): Promise<PrinterAdapterMap> {
  if (opts.transport !== 'usb') {
    throw new Error(`labelwriter: transport "${opts.transport}" is not supported (USB only)`);
  }
  return requestPrintersUsb(opts);
}

async function requestPrintersUsb(
  opts: Extract<ConnectOptions, { transport: 'usb' }>,
): Promise<PrinterAdapterMap> {
  const usbDevice = await navigator.usb.requestDevice({ filters: DEFAULT_FILTERS });

  if (opts.deviceKey !== undefined) {
    const entry = entryByKey(opts.deviceKey);
    if (!entry) throw new Error(`requestPrinters(usb): unknown deviceKey "${opts.deviceKey}"`);
    // fromUSBDeviceAll re-checks VID/PID via findDevice — when the
    // caller passes an explicit deviceKey we trust their pick and
    // let any mismatch surface as the existing error.
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- internal use of legacy helper; the deprecation guidance is for external callers
    return fromUSBDeviceAll(usbDevice);
  }

  const entry = findDevice(usbDevice.vendorId, usbDevice.productId);
  if (entry) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- internal use of legacy helper
    return fromUSBDeviceAll(usbDevice);
  }

  throw new DeviceIdentificationRequiredError(
    devicesForTransport('usb'),
    async (deviceKey: string) => {
      const chosen = entryByKey(deviceKey);
      if (!chosen) throw new Error(`continueWith: unknown deviceKey "${deviceKey}"`);
      // fromUSBDeviceAll keys off VID/PID; when the operator's pick
      // doesn't match, the helper will throw — that's the right
      // behaviour (we don't want to drive a non-matching adapter).
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- internal use of legacy helper
      return fromUSBDeviceAll(usbDevice);
    },
  );
}

/**
 * Filter the registry to entries declaring `transport`. Used to
 * populate `DeviceIdentificationRequiredError.candidates`.
 */
export function devicesForTransport(transport: TransportType): readonly DeviceEntry[] {
  return Object.values(DEVICES).filter(d => transport in d.transports);
}

function entryByKey(key: string): DeviceEntry | undefined {
  return (DEVICES as Record<string, DeviceEntry | undefined>)[key];
}
