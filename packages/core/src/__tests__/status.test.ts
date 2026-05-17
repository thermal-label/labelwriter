import { describe, expect, it } from 'vitest';
import type { DeviceEntry } from '@thermal-label/contracts';
import { DEVICES } from '../devices.js';
import { STATUS_REQUEST, buildStatusRequest, parseStatus, statusByteCount } from '../status.js';

describe('STATUS_REQUEST', () => {
  it('is ESC A', () => {
    expect(Array.from(STATUS_REQUEST)).toEqual([0x1b, 0x41]);
  });
});

describe('statusByteCount', () => {
  it('returns 1 for 450-series devices', () => {
    expect(statusByteCount(DEVICES.LW_450)).toBe(1);
  });

  it('returns 32 for 550-series devices', () => {
    expect(statusByteCount(DEVICES.LW_550)).toBe(32);
  });
});

describe('buildStatusRequest', () => {
  it('450-protocol device: emits the two-byte ESC A form, ignoring the lock arg', () => {
    expect(Array.from(buildStatusRequest(DEVICES.LW_450))).toEqual([0x1b, 0x41]);
    // The 450 firmware reads exactly two bytes — the lock argument is dropped.
    expect(Array.from(buildStatusRequest(DEVICES.LW_450, 2))).toEqual([0x1b, 0x41]);
  });

  it('550-protocol device: emits the three-byte ESC A <lock> form', () => {
    expect(Array.from(buildStatusRequest(DEVICES.LW_550))).toEqual([0x1b, 0x41, 0]);
    expect(Array.from(buildStatusRequest(DEVICES.LW_550, 1))).toEqual([0x1b, 0x41, 1]);
    expect(Array.from(buildStatusRequest(DEVICES.LW_550, 2))).toEqual([0x1b, 0x41, 2]);
  });

  it('throws when the device declares no engines', () => {
    // `deviceProtocol` reads `engines[0]` — a device with an empty
    // engine list is a malformed registry entry and must fail loudly
    // rather than silently picking the 450 path.
    const noEngines = { key: 'BROKEN', engines: [] } as unknown as DeviceEntry;
    expect(() => buildStatusRequest(noEngines)).toThrow(/BROKEN has no engines/);
  });
});

describe('parseStatus — 450 series', () => {
  it('treats the canonical 0x03 (Ready + Top of form) as ready and idle', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x03]));
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors).toEqual([]);
    expect(status.detectedMedia).toBeUndefined();
  });

  it('reports not_ready when bit 0 is clear and no fault bit is set', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x00]));
    expect(status.ready).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('not_ready');
  });

  it('reports not_ready when only bit 0 is set (mid-job, not at top of form)', () => {
    // Mid-job, not at top of form, still has paper, still no jam — but
    // strict spec semantic is that "ready to print" requires bits 0+1
    // together (0x03). Surface not_ready so the harness doesn't dispatch
    // another job before the printer has fed to top-of-form.
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x01]));
    expect(status.ready).toBe(false);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors.map(e => e.code)).toContain('not_ready');
  });

  it('reports not_ready when only bit 1 is set (top of form but ready bit clear)', () => {
    // Edge case: bit 1 alone (0x02) — top-of-form asserted but the
    // ready bit is clear. Strict spec semantic requires both bits, so
    // this still surfaces not_ready.
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x02]));
    expect(status.ready).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('not_ready');
  });

  it('reports not_ready when bit 2 (reserved) is set with bit 0 but bit 1 is clear', () => {
    // Pre-spec units (LW 330 Turbo) sometimes return 0x05 (bits 0+2).
    // Bit 2 is "Not used" per the 450 spec, and the new strict ready
    // semantic requires bit 1 (top of form) — which 0x05 lacks — so
    // this should surface not_ready (mid-job).
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x05]));
    expect(status.ready).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('not_ready');
  });

  it('surfaces no_media when bit 5 (No paper) is set', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x20]));
    expect(status.ready).toBe(false);
    expect(status.mediaLoaded).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('no_media');
  });

  it('surfaces paper_jam when bit 6 (Paper jam) is set', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x40]));
    expect(status.ready).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('paper_jam');
  });

  it('surfaces printer_error when bit 7 is set without a more specific fault', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x80]));
    expect(status.errors.map(e => e.code)).toContain('printer_error');
  });

  it('does not double-report printer_error when no_media is already raised (bit 7 echoes paper-out)', () => {
    // Page 11 of the spec: bit 7 is also set when out of paper. Avoid
    // surfacing both no_media and printer_error for the same root cause.
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0xa0]));
    const codes = status.errors.map(e => e.code);
    expect(codes).toContain('no_media');
    expect(codes).not.toContain('printer_error');
  });

  it('exposes rawBytes for diagnostics', () => {
    const bytes = new Uint8Array([0x03]);
    const status = parseStatus(DEVICES.LW_450, bytes);
    expect(status.rawBytes).toBe(bytes);
  });

  it('treats an empty (zero-byte) response as not-ready without throwing', () => {
    // A clipped USB read or non-responsive device hands back zero bytes.
    // `bytes[0] ?? 0` must default the status byte to 0 so the parser
    // still returns a well-formed not_ready PrinterStatus.
    const status = parseStatus(DEVICES.LW_450, new Uint8Array(0));
    expect(status.ready).toBe(false);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors.map(e => e.code)).toContain('not_ready');
  });

  it('treats the LW 400 canonical 0x03 response as ready (regression: was misread as paper-out + busy)', () => {
    const status = parseStatus(DEVICES.LW_400, new Uint8Array([0x03]));
    expect(status.ready).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('LW 330 Turbo 0x05 response surfaces not_ready under the strict spec semantic', () => {
    // Original regression: this fixture was added when the parser
    // misread 0x05 as paper-out + label-too-long; the fix at the time
    // was to ignore bit 2 (reserved) and accept bit 0 alone as ready.
    // The new strict ready semantic requires bits 0+1 together (0x03),
    // and 0x05 = bits 0+2 lacks bit 1, so this now reports not_ready.
    //
    // TODO(maintainer): confirm whether the LW 330 Turbo genuinely
    // returns 0x05 on a healthy idle printer (in which case bit 2 may
    // mean "top of form" on that family — spec drift), or whether the
    // captured fixture was actually 0x07 (bits 0+1+2). If the former,
    // the parser needs a 330-Turbo branch; if the latter, flip this
    // fixture to 0x07 and re-assert ready=true.
    const status = parseStatus(DEVICES.LW_330_TURBO, new Uint8Array([0x05]));
    expect(status.ready).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('not_ready');
  });
});

describe('parseStatus — 550 series', () => {
  function make550(
    overrides: Partial<{
      printStatus: number;
      jobId: number;
      labelIndex: number;
      headStatus: number;
      density: number;
      bayStatus: number;
      errorId: number;
      labelsRemaining: number;
      externalPower: number;
      headVoltage: number;
    }> = {},
  ): Uint8Array {
    const bytes = new Uint8Array(32);
    bytes[0] = overrides.printStatus ?? 0;
    if (overrides.jobId !== undefined) {
      bytes[1] = overrides.jobId & 0xff;
      bytes[2] = (overrides.jobId >> 8) & 0xff;
      bytes[3] = (overrides.jobId >> 16) & 0xff;
      bytes[4] = (overrides.jobId >> 24) & 0xff;
    }
    if (overrides.labelIndex !== undefined) {
      bytes[5] = overrides.labelIndex & 0xff;
      bytes[6] = (overrides.labelIndex >> 8) & 0xff;
    }
    bytes[8] = overrides.headStatus ?? 0;
    bytes[9] = overrides.density ?? 100;
    bytes[10] = overrides.bayStatus ?? 8; // default: media present, ok
    if (overrides.errorId !== undefined) {
      bytes[23] = overrides.errorId & 0xff;
      bytes[24] = (overrides.errorId >> 8) & 0xff;
      bytes[25] = (overrides.errorId >> 16) & 0xff;
      bytes[26] = (overrides.errorId >> 24) & 0xff;
    }
    if (overrides.labelsRemaining !== undefined) {
      bytes[27] = overrides.labelsRemaining & 0xff;
      bytes[28] = (overrides.labelsRemaining >> 8) & 0xff;
    }
    bytes[29] = overrides.externalPower ?? 1; // default: external power present
    bytes[30] = overrides.headVoltage ?? 1; // default: head voltage ok
    return bytes;
  }

  it('reports ready when print status is idle and bay/head/voltage are healthy', () => {
    const status = parseStatus(DEVICES.LW_550, make550());
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('treats print status 1 (printing) as ready (not an error condition)', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ printStatus: 1 }));
    expect(status.ready).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('reports detectedMedia=undefined — SKU lookup goes through ESC U, not status', () => {
    const status = parseStatus(DEVICES.LW_550, make550());
    expect(status.detectedMedia).toBeUndefined();
  });

  describe('main bay status (byte 10)', () => {
    it('1 (bay open) → cover_open', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 1 }));
      expect(status.errors.map(e => e.code)).toContain('cover_open');
      expect(status.mediaLoaded).toBe(false);
    });

    it('2 (no media present) → no_media', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 2 }));
      expect(status.errors.map(e => e.code)).toContain('no_media');
      expect(status.mediaLoaded).toBe(false);
    });

    it('3 (media not seated) → no_media', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 3 }));
      expect(status.errors.map(e => e.code)).toContain('no_media');
    });

    it('5 (media empty) → no_media', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 5 }));
      expect(status.errors.map(e => e.code)).toContain('no_media');
    });

    it('6 (critically low) → low_media warning, still mediaLoaded', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 6 }));
      expect(status.errors.map(e => e.code)).toContain('low_media');
      expect(status.mediaLoaded).toBe(true);
    });

    it('7 (low) → low_media warning', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 7 }));
      expect(status.errors.map(e => e.code)).toContain('low_media');
    });

    it('8 (ok) → ready, no errors', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 8 }));
      expect(status.errors).toEqual([]);
      expect(status.mediaLoaded).toBe(true);
      expect(status.ready).toBe(true);
    });

    it('9 (jammed) → paper_jam', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 9 }));
      expect(status.errors.map(e => e.code)).toContain('paper_jam');
    });

    it('10 (counterfeit) → counterfeit_media (NFC auth failure)', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ bayStatus: 10 }));
      expect(status.errors.map(e => e.code)).toContain('counterfeit_media');
    });
  });

  describe('print head + voltage', () => {
    it('print head status 1 (overheated) → overheated error', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ headStatus: 1 }));
      expect(status.errors.map(e => e.code)).toContain('overheated');
    });

    it('head voltage 2 (low) → low_voltage', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ headVoltage: 2 }));
      expect(status.errors.map(e => e.code)).toContain('low_voltage');
    });

    it('head voltage 4 (too low) → low_voltage with stronger message', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ headVoltage: 4 }));
      const v = status.errors.find(e => e.code === 'low_voltage');
      expect(v?.message).toMatch(/too low/i);
    });

    it('head voltage 0 (unknown) is not surfaced as an error', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ headVoltage: 0 }));
      expect(status.errors.map(e => e.code)).not.toContain('low_voltage');
    });
  });

  describe('error ID fallback', () => {
    it('printStatus 2 + non-zero errorId with no other diagnostic → printer_error', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ printStatus: 2, errorId: 0xdeadbeef }));
      const e = status.errors.find(err => err.code === 'printer_error');
      expect(e).toBeDefined();
      expect(e?.message).toMatch(/0xdeadbeef/i);
    });

    it('printStatus 2 + bay error → bay error wins, no generic printer_error', () => {
      const status = parseStatus(
        DEVICES.LW_550,
        make550({ printStatus: 2, errorId: 0x1, bayStatus: 9 }),
      );
      expect(status.errors.map(e => e.code)).toContain('paper_jam');
      expect(status.errors.map(e => e.code)).not.toContain('printer_error');
    });

    it('printStatus 2 + errorId=0 + no other diagnostic → not_ready fallback (no silent state)', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ printStatus: 2, errorId: 0 }));
      expect(status.ready).toBe(false);
      expect(status.errors.map(e => e.code)).toContain('not_ready');
    });

    it('printStatus 4 (busy) with everything else healthy → not_ready fallback', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ printStatus: 4 }));
      expect(status.ready).toBe(false);
      expect(status.errors.map(e => e.code)).toContain('not_ready');
    });

    it('printStatus 3 (cancel) and 5 (Unlock) also fall through to not_ready', () => {
      for (const ps of [3, 5]) {
        const status = parseStatus(DEVICES.LW_550, make550({ printStatus: ps }));
        expect(status.ready).toBe(false);
        expect(status.errors.map(e => e.code)).toContain('not_ready');
      }
    });
  });

  it('exposes the full 32-byte response in rawBytes (SKU lookup uses bytes 11-22)', () => {
    const bytes = make550();
    // Place a fake SKU in bytes 11..22 to confirm rawBytes preserves it
    const sku = '12345678ABCD';
    for (let i = 0; i < 12; i++) bytes[11 + i] = sku.charCodeAt(i);
    const status = parseStatus(DEVICES.LW_550, bytes);
    expect(status.rawBytes).toBe(bytes);
    expect(status.rawBytes.length).toBe(32);
  });

  describe('details[]', () => {
    function detail(status: ReturnType<typeof parseStatus>, label: string): string | undefined {
      return status.details?.find(d => d.label === label)?.value;
    }

    it('emits a details[] row set for the 550 branch', () => {
      const status = parseStatus(DEVICES.LW_550, make550());
      expect(status.details).toBeDefined();
      expect(status.details?.length).toBeGreaterThan(0);
    });

    it('decodes print status, job ID, label index, density, labels remaining', () => {
      const status = parseStatus(
        DEVICES.LW_550,
        make550({
          printStatus: 1,
          jobId: 0x1a2b3c4d,
          labelIndex: 7,
          density: 130,
          labelsRemaining: 47,
        }),
      );
      expect(detail(status, 'Print status')).toBe('printing (1)');
      expect(detail(status, 'Job ID')).toBe('0x1a2b3c4d');
      expect(detail(status, 'Label index')).toBe('7');
      expect(detail(status, 'Print density')).toBe('130%');
      expect(detail(status, 'Labels remaining')).toBe('47');
    });

    it('decodes bay status, head status, head voltage, external power', () => {
      const status = parseStatus(
        DEVICES.LW_550,
        make550({ bayStatus: 8, headStatus: 0, headVoltage: 1, externalPower: 1 }),
      );
      expect(detail(status, 'Bay status')).toBe('media OK (8)');
      expect(detail(status, 'Print head')).toBe('OK (0)');
      expect(detail(status, 'Head voltage')).toBe('OK (1)');
      expect(detail(status, 'External power')).toBe('present');
    });

    it('flags an error-state print status as severity error', () => {
      const status = parseStatus(DEVICES.LW_550, make550({ printStatus: 2, errorId: 0xdeadbeef }));
      const printRow = status.details?.find(d => d.label === 'Print status');
      const errorRow = status.details?.find(d => d.label === 'Error ID');
      expect(printRow?.severity).toBe('error');
      expect(errorRow?.value).toBe('0xdeadbeef');
      expect(errorRow?.severity).toBe('error');
    });

    it('flags a critically low head voltage as severity error, low voltage as warn', () => {
      const critical = parseStatus(DEVICES.LW_550, make550({ headVoltage: 3 }));
      expect(critical.details?.find(d => d.label === 'Head voltage')?.severity).toBe('error');
      const low = parseStatus(DEVICES.LW_550, make550({ headVoltage: 2 }));
      expect(low.details?.find(d => d.label === 'Head voltage')?.severity).toBe('warn');
    });

    it('450 branch leaves details undefined', () => {
      const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x03]));
      expect(status.details).toBeUndefined();
    });

    it('labels out-of-range enum bytes as "unknown" across every decoded row', () => {
      // Unknown print-status / bay-status / head-status / head-voltage
      // values (firmware drift, corrupt frame) must surface as a labelled
      // "unknown (<n>)" row rather than `undefined (<n>)`.
      const status = parseStatus(
        DEVICES.LW_550,
        make550({ printStatus: 99, bayStatus: 99, headStatus: 99, headVoltage: 15 }),
      );
      expect(detail(status, 'Print status')).toBe('unknown (99)');
      expect(detail(status, 'Bay status')).toBe('unknown (99)');
      expect(detail(status, 'Print head')).toBe('unknown (99)');
      // headVoltage is masked to its low nibble — 15 is past the table.
      expect(detail(status, 'Head voltage')).toBe('unknown (15)');
    });

    it('decodes a truncated 550 frame without throwing (every byte field defaults to 0)', () => {
      // A short read — non-responsive device or a clipped USB transfer —
      // hands the parser fewer than 32 bytes. Every `bytes[n] ?? 0`
      // accessor must fall back to 0 rather than producing NaN/undefined
      // rows. parseStatus550 + build550Details must still return a
      // well-formed PrinterStatus.
      const status = parseStatus(DEVICES.LW_550, new Uint8Array(0));
      expect(status.details).toBeDefined();
      expect(detail(status, 'Print status')).toBe('idle (0)');
      expect(detail(status, 'Job ID')).toBe('0x00000000');
      expect(detail(status, 'Label index')).toBe('0');
      expect(detail(status, 'Bay status')).toBe('unknown (0)');
      expect(detail(status, 'Print head')).toBe('OK (0)');
      expect(detail(status, 'Head voltage')).toBe('unknown (0)');
      expect(detail(status, 'Print density')).toBe('0%');
      expect(detail(status, 'Error ID')).toBe('0x00000000');
      expect(detail(status, 'Labels remaining')).toBe('0');
      expect(detail(status, 'External power')).toBe('absent');
      // bayStatus 0 = "unknown" → not media-present, printStatus 0 = idle
      // with no errors → ready stays true even on the degenerate frame.
      expect(status.mediaLoaded).toBe(false);
      expect(status.errors).toEqual([]);
    });
  });
});
