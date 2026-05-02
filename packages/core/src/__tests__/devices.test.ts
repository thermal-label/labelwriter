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

describe('300-series and pre-CUPS-driver descriptors', () => {
  it('LW_300 / LW_310 use 464-dot narrow head at 300 dpi', () => {
    for (const key of ['LW_300', 'LW_310'] as const) {
      const engine = DEVICES[key].engines[0]!;
      expect(engine.headDots).toBe(464);
      expect(engine.dpi).toBe(300);
    }
  });

  it('LW_330 and LW_330_TURBO share head and protocol (Turbo = motor speed)', () => {
    const a = DEVICES.LW_330.engines[0]!;
    const b = DEVICES.LW_330_TURBO.engines[0]!;
    expect(a.headDots).toBe(b.headDots);
    expect(a.dpi).toBe(b.dpi);
    expect(a.protocol).toBe(b.protocol);
  });

  it('203-dpi pre-CUPS models declare 203 dpi and lw-330 protocol', () => {
    for (const key of ['LW_TURBO', 'LW_EL40', 'LW_EL60'] as const) {
      const engine = DEVICES[key].engines[0]!;
      expect(engine.dpi).toBe(203);
      expect(engine.protocol).toBe('lw-330');
    }
  });

  it('LW_EL40 declares the narrow 320-dot head', () => {
    expect(DEVICES.LW_EL40.engines[0]?.headDots).toBe(320);
  });

  it('EL-series uses 19200 baud; 300/Turbo family uses 115200 baud', () => {
    for (const key of ['LW_EL40', 'LW_EL60'] as const) {
      expect(DEVICES[key].transports.serial?.defaultBaud).toBe(19200);
    }
    for (const key of ['LW_300', 'LW_310', 'LW_330', 'LW_330_TURBO', 'LW_TURBO'] as const) {
      expect(DEVICES[key].transports.serial?.defaultBaud).toBe(115200);
    }
  });

  it('serial-only descriptors omit transports.usb', () => {
    // LW_330_TURBO had `usb` added once 0x0008 was confirmed via lsusb;
    // it now reaches over both transports and is no longer serial-only.
    for (const key of ['LW_TURBO', 'LW_EL40', 'LW_EL60'] as const) {
      expect(DEVICES[key].transports.usb).toBeUndefined();
      expect(DEVICES[key].transports.serial).toBeDefined();
    }
  });

  it('serial-only descriptors do not appear in findDevice() lookups', () => {
    // Serial-only entries have no PID, so findDevice cannot match them.
    // Confirms the explicit deviceKey path is the only way in.
    for (const key of ['LW_TURBO', 'LW_EL40', 'LW_EL60'] as const) {
      const allMatching = Object.values(DEVICES).filter(d => d.key === key);
      for (const d of allMatching) {
        expect(d.transports.usb?.pid).toBeUndefined();
      }
    }
  });
});
