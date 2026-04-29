import { describe, it, expect } from 'vitest';
import { DEVICES, findDevice } from '../devices.js';

describe('findDevice', () => {
  it('resolves all known PIDs', () => {
    for (const device of Object.values(DEVICES)) {
      expect(findDevice(device.vid, device.pid)).toEqual(device);
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
  it('all 450 protocol devices have nfcLock: false', () => {
    for (const device of Object.values(DEVICES)) {
      if (device.protocol === '450') {
        expect(device.nfcLock).toBe(false);
      }
    }
  });

  it('all 550 protocol devices have nfcLock: true', () => {
    for (const device of Object.values(DEVICES)) {
      if (device.protocol === '550') {
        expect(device.nfcLock).toBe(true);
      }
    }
  });

  it('LW_5XL has bytesPerRow: 156', () => {
    expect(DEVICES.LW_5XL.bytesPerRow).toBe(156);
  });

  it('all non-XXL devices have bytesPerRow: 84', () => {
    const others = Object.entries(DEVICES).filter(([k]) => k !== 'LW_5XL' && k !== 'LW_4XL');
    for (const [, device] of others) {
      expect(device.bytesPerRow).toBe(84);
    }
  });
});
