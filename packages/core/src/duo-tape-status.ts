import type { PrinterError, PrinterStatus } from '@thermal-label/contracts';

/**
 * Status response shape for the LabelWriter Duo's tape engine.
 *
 * Per LW 450 Series Tech Ref Appendix B p.25, `ESC A` returns
 * **8 bytes** of status. Only byte 0 carries data on current Duo
 * firmware ("the LabelWriter Duo printer only uses the first byte");
 * bytes 1-7 are reserved for future use. We capture all 8 in
 * `rawBytes` for forward compat but only branch on byte 0.
 *
 * Bit layout of byte 0:
 *   bit 6 (CASSETTE) — 1 = cassette inserted, 0 = no cassette
 *   bit 4 (CJ)       — 1 = cutter jammed (blade may be exposed!)
 *   bit 2 (GE)       — 1 = general error (motor stalled / tape jam)
 *   bits 0,1,3,5,7   — ignored
 */

export const DUO_TAPE_STATUS_BYTE_COUNT = 8;

const CASSETTE_BIT = 0x40;
const CUTTER_JAM_BIT = 0x10;
const GENERAL_ERROR_BIT = 0x04;

/**
 * Parse the 8-byte Duo tape status response.
 *
 * Cutter-jam and cassette-absent are mapped to distinct
 * `PrinterError.code` values rather than collapsing into
 * `paper_jam` — the cutter-jam state has a safety caveat
 * (PDF p.25: "the cutter blade is not retracted and may present
 * a very sharp, dangerous edge") that warrants its own UI
 * treatment.
 */
export function parseDuoTapeStatus(bytes: Uint8Array): PrinterStatus {
  const b = bytes[0] ?? 0;
  const cassettePresent = (b & CASSETTE_BIT) !== 0;
  const cutterJammed = (b & CUTTER_JAM_BIT) !== 0;
  const generalError = (b & GENERAL_ERROR_BIT) !== 0;

  const errors: PrinterError[] = [];
  if (!cassettePresent) {
    errors.push({ code: 'no_media', message: 'No tape cassette inserted' });
  }
  if (cutterJammed) {
    errors.push({
      code: 'cutter_jam',
      message: 'Cutter blade is jammed and may be exposed — clear with care',
    });
  }
  if (generalError) {
    errors.push({
      code: 'printer_error',
      message: 'Tape printer reported a general error (motor stall or tape jam)',
    });
  }

  return {
    ready: cassettePresent && !cutterJammed && !generalError,
    mediaLoaded: cassettePresent,
    errors,
    rawBytes: bytes,
  };
}
