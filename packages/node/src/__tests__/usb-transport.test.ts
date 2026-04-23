import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('usb', async () => await import('./__mocks__/usb.js'));

import { __setDevices, makeDevice } from './__mocks__/usb.js';
import { UsbTransport } from '../transport.js';

describe('UsbTransport', () => {
  beforeEach(() => {
    __setDevices([]);
  });

  it('throws when device not found', () => {
    __setDevices([]);
    expect(() => UsbTransport.open(0x0922, 0x0020)).toThrow();
  });

  it('opens device and claims interface', async () => {
    const device = makeDevice(0x0922, 0x0020);
    __setDevices([device]);

    const transport = UsbTransport.open(0x0922, 0x0020);
    expect(device.open).toHaveBeenCalled();

    await transport.close();
  });

  it('write sends data to bulk OUT endpoint', async () => {
    const device = makeDevice(0x0922, 0x0020);
    __setDevices([device]);

    const transport = UsbTransport.open(0x0922, 0x0020);
    const data = new Uint8Array([0x1b, 0x40]);
    await transport.write(data);

    const iface = device.interface(0);
    const outEndpoint = iface.endpoints.find(e => e.direction === 'out');
    expect(outEndpoint?.transferAsync).toHaveBeenCalled();

    await transport.close();
  });

  it('read returns Uint8Array from bulk IN endpoint', async () => {
    const device = makeDevice(0x0922, 0x0020);
    __setDevices([device]);

    const transport = UsbTransport.open(0x0922, 0x0020);
    const result = await transport.read(1);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(1);

    await transport.close();
  });

  it('close releases interface and closes device', async () => {
    const device = makeDevice(0x0922, 0x0020);
    __setDevices([device]);

    const transport = UsbTransport.open(0x0922, 0x0020);
    await transport.close();

    const iface = device.interface(0);
    expect(iface.releaseAsync).toHaveBeenCalled();
  });
});
