import { describe, expect, it } from 'vitest';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
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
  function make550(overrides?: {
    status?: number;
    err1?: number;
    err2?: number;
    widthMm?: number;
    heightMm?: number;
  }): Uint8Array {
    const bytes = new Uint8Array(32);
    bytes[0] = overrides?.status ?? 0;
    bytes[1] = overrides?.err1 ?? 0;
    bytes[2] = overrides?.err2 ?? 0;
    bytes[4] = overrides?.widthMm ?? 0;
    bytes[6] = overrides?.heightMm ?? 0;
    return bytes;
  }

  it('reports ready when all zero', () => {
    const status = parseStatus(DEVICES.LW_550, make550());
    expect(status.ready).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('resolves detected media from the width/height bytes', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ widthMm: 28, heightMm: 89 }));
    expect(status.detectedMedia).toEqual(MEDIA.ADDRESS_STANDARD);
    expect(status.mediaLoaded).toBe(true);
  });

  it('leaves detectedMedia undefined for unknown dimensions', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ widthMm: 40, heightMm: 77 }));
    expect(status.detectedMedia).toBeUndefined();
  });

  it('reports mediaLoaded=false when width is zero', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ widthMm: 0 }));
    expect(status.mediaLoaded).toBe(false);
  });

  it('surfaces no_media from err1 bit 0', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ err1: 0x01 }));
    expect(status.errors.map(e => e.code)).toContain('no_media');
    expect(status.ready).toBe(false);
  });

  it('surfaces paper_jam from err1 bit 1', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ err1: 0x02 }));
    expect(status.errors.map(e => e.code)).toContain('paper_jam');
  });

  it('surfaces cover_open from err1 bit 2', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ err1: 0x04 }));
    expect(status.errors.map(e => e.code)).toContain('cover_open');
  });

  it('surfaces label_too_long from err2 bit 0', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ err2: 0x01 }));
    expect(status.errors.map(e => e.code)).toContain('label_too_long');
  });

  it('reports not_ready when the status byte is non-zero', () => {
    const status = parseStatus(DEVICES.LW_550, make550({ status: 0x01 }));
    expect(status.errors.map(e => e.code)).toContain('not_ready');
    expect(status.ready).toBe(false);
  });
});
