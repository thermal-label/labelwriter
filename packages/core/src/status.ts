import type { DeviceEntry, PrinterError, PrinterStatus } from '@thermal-label/contracts';

function deviceProtocol(device: DeviceEntry): string {
  const engine = device.engines[0];
  if (!engine) {
    throw new Error(`Device ${device.key} has no engines declared.`);
  }
  return engine.protocol;
}

/**
 * `ESC A` — Request Print Engine Status. Two-byte form on the 450
 * family (`1B 41`); three-byte form on the 550 family with a lock
 * parameter (`1B 41 <lock>`). Use `buildStatusRequest(device)` to
 * pick the right shape.
 *
 * Constant kept for back-compat — it's the 450 form, which is also
 * what the 550 firmware accepts as a no-lock heartbeat (the lock
 * byte defaults to 0).
 */
export const STATUS_REQUEST = new Uint8Array([0x1b, 0x41]);

/**
 * Build the status-request bytes for a given device, optionally with
 * a 550-family lock byte. On 450-protocol devices, the `lock`
 * argument is ignored — the firmware reads exactly two bytes.
 *
 * Lock semantics (550 only, per spec p.13):
 *   0 = heartbeat / between-label query (default)
 *   1 = acquire print lock before sending a job
 *   2 = status query between labels in an active job
 */
export function buildStatusRequest(device: DeviceEntry, lock: 0 | 1 | 2 = 0): Uint8Array {
  return deviceProtocol(device) === 'lw-550'
    ? new Uint8Array([0x1b, 0x41, lock])
    : new Uint8Array([0x1b, 0x41]);
}

/**
 * Parse a LabelWriter 450 status response (single byte).
 *
 * Per `LW 450 Series Technical Reference Manual` p.17 (Get Printer
 * Status, ESC A) the byte returns 1=true for each bit:
 *
 *   bit 0  Ready (paper in, no jam)
 *   bit 1  Top of form
 *   bit 2  Not used
 *   bit 3  Not used
 *   bit 4  Not used
 *   bit 5  No paper
 *   bit 6  Paper jam
 *   bit 7  Printer error (jam, invalid sequence, and so on)
 *
 * Healthy idle printer returns 0x03 (Ready + Top of form).
 *
 * Bit 0 is *active-high ready*, not *paper out* — a 0 means not ready,
 * a 1 means ready. Bit 1 (top of form) is informational, not an error.
 * Earlier revisions of this parser read bits 0/1/2 with the wrong
 * polarity and the wrong meanings, which surfaced "no paper" / "busy"
 * / "label too long" toasts on healthy 400-series and 330-era units.
 *
 * The LabelWriter 450 protocol has no media-type detection — that
 * arrives with the 550-family NFC bay-status parser in
 * `parseStatus550`. `detectedMedia` here is always undefined.
 */
function parseStatus450(bytes: Uint8Array): PrinterStatus {
  const b = bytes[0] ?? 0;
  const ready = (b & 0x01) !== 0;
  const noPaper = (b & 0x20) !== 0;
  const paperJam = (b & 0x40) !== 0;
  const printerError = (b & 0x80) !== 0;

  const errors: PrinterError[] = [];
  if (noPaper) errors.push({ code: 'no_media', message: 'No labels loaded' });
  if (paperJam) errors.push({ code: 'paper_jam', message: 'Label is jammed in the printer' });
  if (printerError && !noPaper && !paperJam) {
    errors.push({ code: 'printer_error', message: 'Printer reported an error' });
  }
  if (!ready && errors.length === 0) {
    errors.push({ code: 'not_ready', message: 'Printer not ready' });
  }

  return {
    ready: ready && errors.length === 0,
    mediaLoaded: !noPaper,
    errors,
    rawBytes: bytes,
  };
}

/**
 * Parse the LabelWriter 550 status response (32 bytes).
 *
 * Layout per `LW 550 Technical Reference.pdf` p.13-15:
 *
 *   byte 0       Print status enum (0=idle, 1=printing, 2=error,
 *                3=cancel, 4=busy, 5=unlock)
 *   bytes 1-4    Print job ID (u32, echoes ESC s)
 *   bytes 5-6    Label index (u16, echoes ESC n)
 *   byte 7       Reserved
 *   byte 8       Print head status (0=ok, 1=overheated, 2=unknown)
 *   byte 9       Print density (u8 percent, default 100)
 *   byte 10      Main bay status (0..10 — see below)
 *   bytes 11-22  SKU info (12-char, identifies the loaded consumable)
 *   bytes 23-26  Error ID (u32, 0 = none)
 *   bytes 27-28  Label count remaining on roll (u16)
 *   byte 29      EPS status (bit 0 = external power supply present)
 *   byte 30      Print head voltage (0=unknown, 1=ok, 2=low,
 *                3=critical, 4=too low for printing)
 *   byte 31      Reserved (default 0xFF)
 *
 * Main bay status (byte 10) carries the rich media diagnostics:
 *   0  unknown                              (no signal)
 *   1  bay open, media presence unknown     → cover_open
 *   2  no media present                     → no_media
 *   3  media not inserted properly          → no_media + tip about reload
 *   4  media present, status unknown        (treat as loaded)
 *   5  media present, empty                 → no_media (roll exhausted)
 *   6  media present, critically low        → low_media (warn)
 *   7  media present, low                   → low_media (warn)
 *   8  media present, ok                    → ready
 *   9  media present, jammed                → paper_jam
 *   10 media present, counterfeit           → counterfeit_media (NFC fail)
 *
 * Media identity: byte 11-22 is a 12-char SKU string. Detected media
 * round-trip should go through `ESC U` (Get SKU Information) which
 * returns the full 63-byte NFC dump — this parser only flags
 * presence/jam/counterfeit and returns the SKU string in `rawBytes`
 * for the caller to look up.
 */
function parseStatus550(bytes: Uint8Array): PrinterStatus {
  const printStatus = bytes[0] ?? 0;
  const headStatus = bytes[8] ?? 0;
  const bayStatus = bytes[10] ?? 0;
  const errorId =
    ((bytes[23] ?? 0) |
      ((bytes[24] ?? 0) << 8) |
      ((bytes[25] ?? 0) << 16) |
      ((bytes[26] ?? 0) << 24)) >>>
    0;
  const headVoltage = (bytes[30] ?? 0) & 0x0f;

  const errors: PrinterError[] = [];

  // Bay-status branching. Note: status 4 (media present, status
  // unknown) is treated as "loaded but unknown" — neither error nor
  // a low-media warning. Status 0 (bay status unknown) likewise
  // surfaces no error; the printer hasn't decided yet.
  switch (bayStatus) {
    case 1:
      errors.push({ code: 'cover_open', message: 'Printer cover is open' });
      break;
    case 2:
      errors.push({ code: 'no_media', message: 'No label roll loaded' });
      break;
    case 3:
      errors.push({ code: 'no_media', message: 'Label roll not seated correctly' });
      break;
    case 5:
      errors.push({ code: 'no_media', message: 'Label roll is empty' });
      break;
    case 6:
      errors.push({ code: 'low_media', message: 'Label roll is critically low' });
      break;
    case 7:
      errors.push({ code: 'low_media', message: 'Label roll is low' });
      break;
    case 9:
      errors.push({ code: 'paper_jam', message: 'Label is jammed in the printer' });
      break;
    case 10:
      errors.push({
        code: 'counterfeit_media',
        message: 'Loaded label roll failed Dymo NFC authentication',
      });
      break;
  }

  if (headStatus === 1) {
    errors.push({ code: 'overheated', message: 'Print head is overheated' });
  }
  if (headVoltage === 2) {
    errors.push({ code: 'low_voltage', message: 'Print head voltage is low' });
  } else if (headVoltage === 3) {
    errors.push({ code: 'low_voltage', message: 'Print head voltage is critically low' });
  } else if (headVoltage === 4) {
    errors.push({
      code: 'low_voltage',
      message: 'Print head voltage is too low to print',
    });
  }

  // Print status 2 = error: errorId carries the specific code. Surface
  // it as a generic printer_error if no bay/head error already
  // explained the situation.
  if (printStatus === 2 && errorId !== 0 && errors.length === 0) {
    errors.push({
      code: 'printer_error',
      message: `Printer reported error ID 0x${errorId.toString(16).padStart(8, '0')}`,
    });
  }

  // The bay status enum's "media present" range (4..8) all imply
  // physical media is loaded; everything else (0, 1, 2, 3, 9, 10) is
  // either no-media or an error condition.
  const mediaLoaded = bayStatus >= 4 && bayStatus <= 8;
  const ready = errors.length === 0 && (printStatus === 0 || printStatus === 1);

  // Final fallback: if the printer is not idle/printing and nothing
  // else surfaced a reason, emit a generic not_ready so the UI has
  // something to show. Covers printStatus 2 (error) with errorId=0,
  // 3 (cancel), 4 (busy), 5 (Unlock).
  if (!ready && errors.length === 0) {
    errors.push({ code: 'not_ready', message: 'Printer not ready' });
  }

  return {
    ready,
    mediaLoaded,
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
 * response. 1 byte for the 450 family, 32 for the 550 family
 * (per `LW 550 Technical Reference.pdf` p.8 + 13-15).
 */
export function statusByteCount(device: DeviceEntry): number {
  return deviceProtocol(device) === 'lw-550' ? 32 : 1;
}

export { deviceProtocol };
