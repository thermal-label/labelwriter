import type { DeviceEntry, PrinterError, PrinterStatus } from '@thermal-label/contracts';
import { findMediaByDimensions } from './media.js';

function deviceProtocol(device: DeviceEntry): string {
  const engine = device.engines[0];
  if (!engine) {
    throw new Error(`Device ${device.key} has no engines declared.`);
  }
  return engine.protocol;
}

/** `ESC A` — identical on 450 and 550 series. */
export const STATUS_REQUEST = new Uint8Array([0x1b, 0x41]);

/**
 * Parse a LabelWriter 450 status response (single byte).
 *
 * Bit layout:
 *   bit 0 → paper out
 *   bit 1 → paused / not ready
 *   bit 2 → label too long
 *
 * The 450 has no media detection — `detectedMedia` is always undefined.
 */
function parseStatus450(bytes: Uint8Array): PrinterStatus {
  const b = bytes[0] ?? 0;
  const paperOut = (b & 0x01) !== 0;
  const notReady = (b & 0x02) !== 0;
  const labelTooLong = (b & 0x04) !== 0;

  const errors: PrinterError[] = [];
  if (notReady) errors.push({ code: 'not_ready', message: 'Printer busy' });
  if (paperOut) errors.push({ code: 'no_media', message: 'No labels loaded' });
  if (labelTooLong) errors.push({ code: 'label_too_long', message: 'Label exceeded max length' });

  return {
    ready: b === 0,
    mediaLoaded: !paperOut,
    errors,
    rawBytes: bytes,
  };
}

/**
 * Parse a LabelWriter 550 status response (32 bytes).
 *
 * Layout (little-endian where multi-byte):
 *   byte 0   → status flags
 *   byte 1-2 → error flags (non-zero ⇒ diagnostic in `errors`)
 *   byte 4-5 → media width in mm
 *   byte 6-7 → media length in mm (0 for continuous)
 *
 * Media is matched against the `MEDIA` registry so `detectedMedia`
 * returns a friendly descriptor. Unknown sizes leave it `undefined`.
 */
function parseStatus550(bytes: Uint8Array): PrinterStatus {
  const status = bytes[0] ?? 0;
  const err1 = bytes[1] ?? 0;
  const err2 = bytes[2] ?? 0;
  const widthMm = (bytes[4] ?? 0) | ((bytes[5] ?? 0) << 8);
  const heightMm = (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8);

  const errors: PrinterError[] = [];
  if (status !== 0) errors.push({ code: 'not_ready', message: 'Printer busy' });
  if ((err1 & 0x01) !== 0) errors.push({ code: 'no_media', message: 'No labels loaded' });
  if ((err1 & 0x02) !== 0) errors.push({ code: 'paper_jam', message: 'Paper jam detected' });
  if ((err1 & 0x04) !== 0) errors.push({ code: 'cover_open', message: 'Cover is open' });
  if ((err2 & 0x01) !== 0)
    errors.push({ code: 'label_too_long', message: 'Label exceeded max length' });

  const detected = widthMm > 0 ? findMediaByDimensions(widthMm, heightMm) : undefined;

  return {
    ready: status === 0 && err1 === 0 && err2 === 0,
    mediaLoaded: widthMm > 0,
    ...(detected === undefined ? {} : { detectedMedia: detected }),
    errors,
    rawBytes: bytes,
  };
}

/**
 * Dispatch to the right protocol parser.
 *
 * Call `byteCount(device)` first to know how many bytes to read from
 * the transport. The two protocols differ — 450 is one byte, 550 is 32.
 */
export function parseStatus(device: DeviceEntry, bytes: Uint8Array): PrinterStatus {
  return deviceProtocol(device) === 'lw-550' ? parseStatus550(bytes) : parseStatus450(bytes);
}

/**
 * How many bytes to read from the transport for this device's status
 * response.
 */
export function statusByteCount(device: DeviceEntry): number {
  return deviceProtocol(device) === 'lw-550' ? 32 : 1;
}
