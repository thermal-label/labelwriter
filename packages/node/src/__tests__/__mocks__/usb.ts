/* eslint-disable import-x/consistent-type-specifier-style */
import { vi } from 'vitest';
import type { MockInstance } from 'vitest';

export interface MockOutEndpoint {
  direction: 'out';
  transferAsync: MockInstance;
}

export interface MockInEndpoint {
  direction: 'in';
  transferAsync: MockInstance;
}

export type MockEndpoint = MockOutEndpoint | MockInEndpoint;

export interface MockInterface {
  endpoints: MockEndpoint[];
  isKernelDriverActive: MockInstance;
  detachKernelDriver: MockInstance;
  claim: MockInstance;
  releaseAsync: MockInstance;
}

export interface MockDevice {
  deviceDescriptor: {
    idVendor: number;
    idProduct: number;
    iSerialNumber?: number;
  };
  busNumber: number;
  deviceAddress: number;
  open: MockInstance;
  close: MockInstance;
  getStringDescriptor: MockInstance;
  interface: MockInstance & ((n: number) => MockInterface);
}

const devices: MockDevice[] = [];

export function __setDevices(next: MockDevice[]): void {
  devices.splice(0, devices.length, ...next);
}

export function getDeviceList(): MockDevice[] {
  return [...devices];
}

export function findByIds(vid: number, pid: number): MockDevice | undefined {
  return devices.find(d => d.deviceDescriptor.idVendor === vid && d.deviceDescriptor.idProduct === pid);
}

export function makeDevice(
  idVendor: number,
  idProduct: number,
  serialNumber?: string,
  busNumber = 1,
  deviceAddress = 2,
): MockDevice {
  const outEndpoint: MockOutEndpoint = {
    direction: 'out',
    transferAsync: vi.fn(() => Promise.resolve(0)),
  };
  const inEndpoint: MockInEndpoint = {
    direction: 'in',
    transferAsync: vi.fn((length: number) => Promise.resolve(Buffer.alloc(length))),
  };

  const mockInterface: MockInterface = {
    endpoints: [outEndpoint, inEndpoint],
    isKernelDriverActive: vi.fn(() => false),
    detachKernelDriver: vi.fn(),
    claim: vi.fn(),
    releaseAsync: vi.fn(() => Promise.resolve()),
  };

  return {
    deviceDescriptor: { idVendor, idProduct, iSerialNumber: serialNumber ? 3 : 0 },
    busNumber,
    deviceAddress,
    open: vi.fn(),
    close: vi.fn(),
    getStringDescriptor: vi.fn((_idx: number, cb: (err: null, val?: string) => void) => { cb(null, serialNumber); }),
    interface: vi.fn(() => mockInterface),
  };
}
