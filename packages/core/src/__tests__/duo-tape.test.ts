import { describe, it, expect } from 'vitest';
import { createBitmap, type LabelBitmap } from '@mbtech-nl/bitmap';
import {
  buildDuoReset,
  buildDuoSetTapeType,
  buildDuoBytesPerLine,
  buildDuoCutTape,
  buildDuoStatusRequest,
  buildDuoRasterRow,
  encodeDuoTapeLabel,
  isDuoTapeEngine,
} from '../duo-tape.js';
import { DEVICES } from '../devices.js';

describe('buildDuoReset', () => {
  it('produces [0x1B, 0x40]', () => {
    expect(Array.from(buildDuoReset())).toEqual([0x1b, 0x40]);
  });
});

describe('buildDuoSetTapeType', () => {
  it('encodes selector 0 (black on white/clear)', () => {
    expect(Array.from(buildDuoSetTapeType(0))).toEqual([0x1b, 0x43, 0x00]);
  });

  it('encodes selector 12 (red on white)', () => {
    expect(Array.from(buildDuoSetTapeType(12))).toEqual([0x1b, 0x43, 0x0c]);
  });

  it('rejects values > 12', () => {
    expect(() => buildDuoSetTapeType(13)).toThrow(RangeError);
  });

  it('rejects negative values', () => {
    expect(() => buildDuoSetTapeType(-1)).toThrow(RangeError);
  });

  it('rejects non-integers', () => {
    expect(() => buildDuoSetTapeType(1.5)).toThrow(RangeError);
  });
});

describe('buildDuoBytesPerLine', () => {
  it('128-dot head accepts up to 16', () => {
    expect(Array.from(buildDuoBytesPerLine(16, 128))).toEqual([0x1b, 0x44, 16]);
  });

  it('96-dot head accepts up to 12', () => {
    expect(Array.from(buildDuoBytesPerLine(12, 96))).toEqual([0x1b, 0x44, 12]);
  });

  it('128-dot head rejects 17', () => {
    expect(() => buildDuoBytesPerLine(17, 128)).toThrow(RangeError);
  });

  it('96-dot head rejects 13', () => {
    expect(() => buildDuoBytesPerLine(13, 96)).toThrow(RangeError);
  });

  it('accepts 0 (blank line)', () => {
    expect(Array.from(buildDuoBytesPerLine(0, 128))).toEqual([0x1b, 0x44, 0]);
  });
});

describe('buildDuoCutTape', () => {
  it('produces [0x1B, 0x45]', () => {
    expect(Array.from(buildDuoCutTape())).toEqual([0x1b, 0x45]);
  });
});

describe('buildDuoStatusRequest', () => {
  it('produces [0x1B, 0x41]', () => {
    expect(Array.from(buildDuoStatusRequest())).toEqual([0x1b, 0x41]);
  });
});

describe('buildDuoRasterRow', () => {
  it('prepends 0x16 (SYN) to row bytes', () => {
    const row = new Uint8Array([0xff, 0x00, 0xaa]);
    const result = buildDuoRasterRow(row);
    expect(Array.from(result)).toEqual([0x16, 0xff, 0x00, 0xaa]);
  });

  it('handles a 16-byte 128-dot row', () => {
    const row = new Uint8Array(16);
    expect(buildDuoRasterRow(row).length).toBe(17);
    expect(buildDuoRasterRow(row)[0]).toBe(0x16);
  });
});

describe('isDuoTapeEngine', () => {
  it('matches engines with protocol "d1-tape"', () => {
    const tapeEngine = DEVICES.LW_450_DUO.engines.find(e => e.role === 'tape');
    expect(tapeEngine).toBeDefined();
    expect(isDuoTapeEngine(tapeEngine!)).toBe(true);
  });

  it('rejects label-protocol engines', () => {
    const labelEngine = DEVICES.LW_450_DUO.engines.find(e => e.role === 'label');
    expect(labelEngine).toBeDefined();
    expect(isDuoTapeEngine(labelEngine!)).toBe(false);
  });

  it('rejects non-Duo engines', () => {
    const lw450engine = DEVICES.LW_450.engines[0];
    expect(isDuoTapeEngine(lw450engine!)).toBe(false);
  });
});

describe('encodeDuoTapeLabel', () => {
  function makeBitmap(widthPx: number, heightPx: number): LabelBitmap {
    return createBitmap(widthPx, heightPx);
  }

  it('emits reset, set-tape-type, set-bytes-per-line, raster, cut', () => {
    const bm = makeBitmap(128, 4);
    const result = encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm);
    const bytes = Array.from(result);

    // Header: ESC @, ESC C 0, ESC D 16
    expect(bytes.slice(0, 8)).toEqual([0x1b, 0x40, 0x1b, 0x43, 0x00, 0x1b, 0x44, 16]);

    // 4 raster rows, each 1 + 16 bytes (SYN + row) = 68 bytes total
    // Header is 8 bytes, raster block 68 bytes, then ESC E
    expect(result.length).toBe(8 + 4 * 17 + 2);
    expect(bytes[8]).toBe(0x16); // first row starts with SYN

    // Trailer: ESC E
    expect(bytes.at(-2)).toBe(0x1b);
    expect(bytes.at(-1)).toBe(0x45);
  });

  it('uses 96-dot head sizing for LW_DUO_96', () => {
    const bm = makeBitmap(96, 2);
    const result = encodeDuoTapeLabel(DEVICES.LW_DUO_96, bm);
    // ESC D should reflect 12 (96/8), not 16
    expect(result[7]).toBe(12);
    // Each row carries 12 bytes
    const headerLen = 8;
    expect(result[headerLen]).toBe(0x16);
    expect(result.length).toBe(headerLen + 2 * 13 + 2);
  });

  it('honours tapeType selector', () => {
    const bm = makeBitmap(128, 1);
    const result = encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm, { tapeType: 7 });
    expect(result[4]).toBe(0x07); // ESC C 7 (black on fluorescent green)
  });

  it('repeats the full header+raster+cut block for each copy', () => {
    const bm = makeBitmap(128, 1);
    const single = encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm);
    const double = encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm, { copies: 2 });
    expect(double.length).toBe(single.length * 2);
  });

  it('right-pads bitmaps narrower than head width', () => {
    const bm = makeBitmap(64, 1);
    const result = encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm);
    // Still 16 bytes per line (head width), padding is zeros
    expect(result.length).toBe(8 + 17 + 2);
  });

  it('crops bitmaps wider than head width', () => {
    const bm = makeBitmap(256, 1);
    const result = encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm);
    expect(result.length).toBe(8 + 17 + 2);
  });

  it('throws when device has no tape engine', () => {
    expect(() => encodeDuoTapeLabel(DEVICES.LW_450, makeBitmap(672, 4))).toThrow(
      /no engine with protocol "d1-tape"/,
    );
  });

  it('throws when explicitly requested role is not the tape engine', () => {
    expect(() =>
      encodeDuoTapeLabel(DEVICES.LW_450_DUO, makeBitmap(672, 4), { engine: 'label' }),
    ).toThrow(/not "d1-tape"/);
  });
});
