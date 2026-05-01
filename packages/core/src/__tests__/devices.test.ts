import { describe, it, expect } from 'vitest';
import { DEVICES, findDevice } from '../devices.js';

import type { DeviceEntry } from '@thermal-label/contracts';

function usbOf(device: DeviceEntry): { vid: number; pid: number } {
  const usb = device.transports.usb;
  if (!usb) throw new Error(`${device.key} has no usb transport`);
  return { vid: Number.parseInt(usb.vid, 16), pid: Number.parseInt(usb.pid, 16) };
}

describe('findDevice', () => {
  it('resolves all known PIDs', () => {
    for (const device of Object.values(DEVICES)) {
      const usb = device.transports.usb;
      if (!usb) continue;
      const { vid, pid } = usbOf(device);
      expect(findDevice(vid, pid)).toBeDefined();
    }
  });

  it('returns undefined for unknown PID', () => {
    expect(findDevice(0x0922, 0x9999)).toBeUndefined();
  });

  it('returns undefined for unknown VID', () => {
    expect(findDevice(0xffff, 0x0020)).toBeUndefined();
  });
});

describe('device properties', () => {
  it('lw-450 protocol engines do not declare genuineMediaRequired', () => {
    for (const device of Object.values(DEVICES)) {
      const protocols = device.engines.map(e => e.protocol);
      if (protocols.every(p => p === 'lw-450')) {
        for (const e of device.engines) {
          expect(e.capabilities?.genuineMediaRequired).toBeFalsy();
        }
      }
    }
  });

  it('lw-550 protocol engines declare genuineMediaRequired: true', () => {
    for (const device of Object.values(DEVICES)) {
      for (const engine of device.engines) {
        if (engine.protocol === 'lw-550') {
          expect(engine.capabilities?.genuineMediaRequired).toBe(true);
        }
      }
    }
  });

  it('XL devices use a 1248-dot head', () => {
    expect(DEVICES.LW_5XL.engines[0]?.headDots).toBe(1248);
    expect(DEVICES.LW_4XL.engines[0]?.headDots).toBe(1248);
  });

  it('lw-450 / lw-550 single-roll devices use a 672-dot head', () => {
    const skip = new Set(['LW_5XL', 'LW_4XL', 'LW_300', 'LW_310', 'LW_SE450']);
    for (const [key, device] of Object.entries(DEVICES)) {
      if (skip.has(key)) continue;
      const primary = device.engines.find(e => e.role === 'primary' || e.role === 'label');
      if (!primary) continue;
      if (primary.protocol === 'lw-450' || primary.protocol === 'lw-550') {
        expect(primary.headDots).toBe(672);
      }
    }
  });
});
