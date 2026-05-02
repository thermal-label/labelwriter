import { describe, expect, it } from 'vitest';
import { DEVICES } from '../devices.js';
import { STATUS_REQUEST, parseStatus, statusByteCount } from '../status.js';

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

describe('parseStatus — 450 series', () => {
  it('reports ready when the single byte is zero', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x00]));
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors).toEqual([]);
    expect(status.detectedMedia).toBeUndefined();
  });

  it('surfaces no_media when bit 0 is set', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x01]));
    expect(status.ready).toBe(false);
    expect(status.mediaLoaded).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('no_media');
  });

  it('surfaces not_ready when bit 1 is set', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x02]));
    expect(status.ready).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('not_ready');
  });

  it('surfaces label_too_long when bit 2 is set', () => {
    const status = parseStatus(DEVICES.LW_450, new Uint8Array([0x04]));
    expect(status.errors.map(e => e.code)).toContain('label_too_long');
  });

  it('exposes rawBytes for diagnostics', () => {
    const bytes = new Uint8Array([0x03]);
    const status = parseStatus(DEVICES.LW_450, bytes);
    expect(status.rawBytes).toBe(bytes);
  });
});

describe('parseStatus — 550 series', () => {
  function make550(
    overrides: Partial<{
      printStatus: number;
      headStatus: number;
      bayStatus: number;
      errorId: number;
      headVoltage: number;
    }> = {},
  ): Uint8Array {
    const bytes = new Uint8Array(32);
    bytes[0] = overrides.printStatus ?? 0;
    bytes[8] = overrides.headStatus ?? 0;
    bytes[10] = overrides.bayStatus ?? 8; // default: media present, ok
    if (overrides.errorId !== undefined) {
      bytes[23] = overrides.errorId & 0xff;
      bytes[24] = (overrides.errorId >> 8) & 0xff;
      bytes[25] = (overrides.errorId >> 16) & 0xff;
      bytes[26] = (overrides.errorId >> 24) & 0xff;
    }
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
});
