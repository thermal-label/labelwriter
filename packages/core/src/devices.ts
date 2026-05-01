import type { DeviceEntry, DeviceRegistry } from '@thermal-label/contracts';
import { DEVICES, REGISTRY, type DeviceKey } from './_generated/registry.js';

/**
 * Aggregated LabelWriter device registry.
 *
 * The data is authored as one `data/devices/<KEY>.json5` file per
 * device; `scripts/compile-data.mjs` validates and aggregates them
 * into the build artifact `data/devices.json` and the typed
 * `src/_generated/registry.ts` re-exported here.
 */
export const REGISTRY_LW: DeviceRegistry = REGISTRY;

/**
 * Map of device key → entry, for ergonomic dotted access
 * (`DEVICES.LW_450`). Keys are literal so accessing a known device
 * does not surface `undefined` to callers.
 */
export { DEVICES };
export type { DeviceKey };

function parseHex(s: string): number {
  return Number.parseInt(s, 16);
}

// Re-export the contracts type so callers don't need a second import
// when typing variables that hold a registry entry.
export type { DeviceEntry };

/**
 * Find a registry entry by USB VID and PID.
 *
 * VIDs and PIDs in the registry are stored as hex strings (`'0x0922'`)
 * matching what every datasheet, lsusb output, and forum post uses.
 * Callers passing JS numbers (e.g. `usbDevice.vendorId`) are matched
 * after parsing.
 */
export function findDevice(vid: number, pid: number): DeviceEntry | undefined {
  // Every entry in REGISTRY happens to declare a USB transport today,
  // but the contracts shape allows network-only devices, so the guard
  // stays for forward-compatibility.
  return REGISTRY.devices.find(d => {
    const usb = d.transports.usb;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment above
    if (!usb) return false;
    return parseHex(usb.vid) === vid && parseHex(usb.pid) === pid;
  });
}
