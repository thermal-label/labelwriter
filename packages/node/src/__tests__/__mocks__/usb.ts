/**
 * Minimal `node-usb` mock for discovery tests.
 *
 * Since USB open/claim lives in the shared `UsbTransport`, the driver's
 * discovery code only needs `getDeviceList()` + `device.open/close` +
 * `getStringDescriptor`. The `UsbTransport.open` call is mocked
 * separately at the test level.
 */
import { vi } from 'vitest';

export interface MockDevice {
  deviceDescriptor: {
    idVendor: number;
    idProduct: number;
    iSerialNumber: number;
  };
  busNumber: number;
  deviceAddress: number;
  open(): void;
  close(): void;
  getStringDescriptor(index: number, callback: (err: Error | null, value?: string) => void): void;
}

const devices: MockDevice[] = [];

export function __setDevices(next: MockDevice[]): void {
  devices.splice(0, devices.length, ...next);
}

export function getDeviceList(): MockDevice[] {
  return [...devices];
}

export function makeDevice(
  idVendor: number,
  idProduct: number,
  serialNumber?: string,
  busNumber = 1,
  deviceAddress = 2,
): MockDevice {
  return {
    deviceDescriptor: { idVendor, idProduct, iSerialNumber: serialNumber ? 3 : 0 },
    busNumber,
    deviceAddress,
    open: vi.fn(),
    close: vi.fn(),
    getStringDescriptor: vi.fn((_idx: number, cb: (err: null, val?: string) => void) => {
      cb(null, serialNumber);
    }),
  };
}

/**
 * Build a mock device that declares a serial-number descriptor index
 * but fails the `getStringDescriptor` read — the callback fires with an
 * error. `readSerialNumber` must resolve to `undefined` in that case
 * rather than rejecting.
 */
export function makeDeviceWithSerialReadError(
  idVendor: number,
  idProduct: number,
  busNumber = 1,
  deviceAddress = 2,
): MockDevice {
  return {
    deviceDescriptor: { idVendor, idProduct, iSerialNumber: 3 },
    busNumber,
    deviceAddress,
    open: vi.fn(),
    close: vi.fn(),
    getStringDescriptor: vi.fn((_idx: number, cb: (err: Error | null, val?: string) => void) => {
      cb(new Error('descriptor read failed'));
    }),
  };
}
