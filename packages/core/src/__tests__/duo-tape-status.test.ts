import { describe, expect, it } from 'vitest';
import { DUO_TAPE_STATUS_BYTE_COUNT, parseDuoTapeStatus } from '../duo-tape-status.js';

function statusBytes(byte0: number): Uint8Array {
  const b = new Uint8Array(DUO_TAPE_STATUS_BYTE_COUNT);
  b[0] = byte0;
  return b;
}

describe('DUO_TAPE_STATUS_BYTE_COUNT', () => {
  it('is 8 (PDF p.25)', () => {
    expect(DUO_TAPE_STATUS_BYTE_COUNT).toBe(8);
  });
});

describe('parseDuoTapeStatus', () => {
  it('cassette present, no errors → ready', () => {
    const status = parseDuoTapeStatus(statusBytes(0x40));
    expect(status.ready).toBe(true);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('no cassette → no_media error, not ready', () => {
    const status = parseDuoTapeStatus(statusBytes(0x00));
    expect(status.ready).toBe(false);
    expect(status.mediaLoaded).toBe(false);
    expect(status.errors.map(e => e.code)).toEqual(['no_media']);
  });

  it('cutter jam (with cassette) → cutter_jam error, not ready', () => {
    const status = parseDuoTapeStatus(statusBytes(0x40 | 0x10));
    expect(status.ready).toBe(false);
    expect(status.mediaLoaded).toBe(true);
    expect(status.errors.map(e => e.code)).toContain('cutter_jam');
  });

  it('general error (with cassette) → printer_error, not ready', () => {
    const status = parseDuoTapeStatus(statusBytes(0x40 | 0x04));
    expect(status.ready).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('printer_error');
  });

  it('cutter_jam message warns about exposed blade', () => {
    const status = parseDuoTapeStatus(statusBytes(0x40 | 0x10));
    const cj = status.errors.find(e => e.code === 'cutter_jam');
    expect(cj?.message).toMatch(/blade/i);
  });

  it('reports cassette absent and cutter jam together', () => {
    const status = parseDuoTapeStatus(statusBytes(0x10));
    const codes = status.errors.map(e => e.code);
    expect(codes).toContain('no_media');
    expect(codes).toContain('cutter_jam');
  });

  it('ignores the always-set bits 0,1,3,5,7', () => {
    // 0xab = 10101011 — bits 0,1,3,5,7 set, none of CASSETTE/CJ/GE
    const status = parseDuoTapeStatus(statusBytes(0xab));
    // Cassette bit is 6, not set → no_media is the only consequence
    expect(status.errors.map(e => e.code)).toEqual(['no_media']);
  });

  it('exposes all 8 bytes via rawBytes', () => {
    const bytes = new Uint8Array([0x40, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
    const status = parseDuoTapeStatus(bytes);
    expect(status.rawBytes).toBe(bytes);
    expect(status.rawBytes.length).toBe(8);
  });

  it('handles short input gracefully (defensive)', () => {
    // Future firmware might shorten the response — defensive default
    // is "no info" rather than throwing.
    const status = parseDuoTapeStatus(new Uint8Array(0));
    expect(status.mediaLoaded).toBe(false);
    expect(status.errors.map(e => e.code)).toContain('no_media');
  });
});
