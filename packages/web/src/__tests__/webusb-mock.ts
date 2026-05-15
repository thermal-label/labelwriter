import { vi } from 'vitest';

export interface MockUSBDevice extends USBDevice {
  __transfers: { endpointNumber: number; data: Uint8Array }[];
}

/**
 * Build a mock `USBDevice` for the WebUSB transport tests.
 *
 * @param responses - Bulk-IN reply message(s). A real request/response
 *   bulk endpoint terminates each transfer with a short packet at the
 *   message boundary, so one `transferIn` returns exactly one message
 *   regardless of how many bytes the host requested — an over-aligned
 *   read never bleeds into the next reply. Pass an array to script a
 *   sequence of distinct replies; the last entry is sticky (repeated for
 *   any further reads, like a device answering every status poll). A
 *   bare `Uint8Array` is a single sticky reply.
 */
export function createMockUSBDevice(
  vendorId = 0x0922,
  productId = 0x0020,
  responses: Uint8Array | Uint8Array[] = new Uint8Array([0x00]),
): MockUSBDevice {
  const transfers: { endpointNumber: number; data: Uint8Array }[] = [];
  let opened = false;
  const replies = Array.isArray(responses) ? [...responses] : [responses];
  let replyIndex = 0;

  const endpoints = [
    { endpointNumber: 1, direction: 'out' },
    { endpointNumber: 2, direction: 'in', packetSize: 64 },
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
      // One transfer == one message. A real bulk-IN request/response
      // device ends the transfer with a short packet at the message
      // boundary, so an over-aligned request (the transport rounds up to
      // `wMaxPacketSize`) never merges two replies. The last scripted
      // reply is sticky so repeated polls keep getting an answer.
      const message = replies[Math.min(replyIndex, replies.length - 1)] ?? new Uint8Array(0);
      replyIndex += 1;
      const out = message.subarray(0, Math.min(length, message.length));
      return Promise.resolve({
        data: new DataView(out.buffer, out.byteOffset, out.byteLength),
        status: 'ok' as const,
      });
    }),
    __transfers: transfers,
  } as unknown as MockUSBDevice;

  return device;
}
