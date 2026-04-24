import { vi } from 'vitest';

export interface MockUSBDevice extends USBDevice {
  __transfers: { endpointNumber: number; data: Uint8Array }[];
  __statusBytes: Uint8Array;
}

export function createMockUSBDevice(
  vendorId = 0x0922,
  productId = 0x0020,
  statusBytes: Uint8Array = new Uint8Array([0x00]),
): MockUSBDevice {
  const transfers: { endpointNumber: number; data: Uint8Array }[] = [];
  let opened = false;

  const endpoints = [
    { endpointNumber: 1, direction: 'out' },
    { endpointNumber: 2, direction: 'in' },
  ] as unknown as USBEndpoint[];

  const configuration: USBConfiguration = {
    configurationValue: 1,
    configurationName: null,
    interfaces: [
      {
        interfaceNumber: 0,
        alternate: {
          alternateSetting: 0,
          interfaceClass: 7,
          interfaceSubclass: 1,
          interfaceProtocol: 2,
          interfaceName: null,
          endpoints,
        },
        alternates: [],
        claimed: false,
      },
    ],
  };

  const device = {
    vendorId,
    productId,
    serialNumber: undefined,
    get opened() {
      return opened;
    },
    configuration,
    open: vi.fn(() => {
      opened = true;
      return Promise.resolve();
    }),
    close: vi.fn(() => {
      opened = false;
      return Promise.resolve();
    }),
    selectConfiguration: vi.fn(() => Promise.resolve()),
    claimInterface: vi.fn(() => Promise.resolve()),
    releaseInterface: vi.fn(() => Promise.resolve()),
    transferOut: vi.fn((endpointNumber: number, data: BufferSource) => {
      const array = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
      transfers.push({ endpointNumber, data: Uint8Array.from(array) });
      return Promise.resolve({ bytesWritten: array.byteLength, status: 'ok' as const });
    }),
    transferIn: vi.fn((_endpointNumber: number, length: number) => {
      const out = new Uint8Array(length);
      out.set(device.__statusBytes.subarray(0, length));
      return Promise.resolve({
        data: new DataView(out.buffer),
        status: 'ok' as const,
      });
    }),
    __transfers: transfers,
    __statusBytes: statusBytes,
  } as unknown as MockUSBDevice;

  return device;
}
