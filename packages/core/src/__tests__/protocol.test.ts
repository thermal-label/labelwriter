import { describe, it, expect } from 'vitest';
import { createBitmap, type LabelBitmap } from '@mbtech-nl/bitmap';
import {
  buildReset,
  buildSetBytesPerLine,
  buildSetLabelLength,
  buildFormFeed,
  buildShortFormFeed,
  buildJobHeader,
  buildRasterRow,
  buildErrorRecovery,
  buildDensity,
  buildMode,
  buildSelectRoll,
  buildStatusRequest,
  encodeLabel,
} from '../protocol.js';
import { DEVICES } from '../devices.js';

describe('buildReset', () => {
  it('produces [0x1B, 0x40]', () => {
    expect(Array.from(buildReset())).toEqual([0x1b, 0x40]);
  });
});

describe('buildSetBytesPerLine', () => {
  it('encodes correct byte value', () => {
    expect(Array.from(buildSetBytesPerLine(84))).toEqual([0x1b, 0x44, 84]);
    expect(Array.from(buildSetBytesPerLine(156))).toEqual([0x1b, 0x44, 156]);
  });
});

describe('buildSetLabelLength', () => {
  it('encodes little-endian 16-bit', () => {
    expect(Array.from(buildSetLabelLength(200))).toEqual([0x1b, 0x4c, 0xc8, 0x00]);
  });

  it('handles values > 255', () => {
    expect(Array.from(buildSetLabelLength(300))).toEqual([0x1b, 0x4c, 0x2c, 0x01]);
  });
});

describe('buildFormFeed', () => {
  it('produces [0x1B, 0x45]', () => {
    expect(Array.from(buildFormFeed())).toEqual([0x1b, 0x45]);
  });
});

describe('buildJobHeader', () => {
  it('starts with 0x1B 0x73 and includes 4 ID bytes', () => {
    const result = buildJobHeader(0x01020304);
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x73);
    expect(result.length).toBe(6);
    expect(result[2]).toBe(0x04);
    expect(result[3]).toBe(0x03);
    expect(result[4]).toBe(0x02);
    expect(result[5]).toBe(0x01);
  });
});

describe('buildRasterRow', () => {
  it('uncompressed: first byte 0x16, length = 1 + bytesPerRow', () => {
    const row = new Uint8Array(84);
    const result = buildRasterRow(row);
    expect(result[0]).toBe(0x16);
    expect(result.length).toBe(85);
  });

  it('compressed: first byte 0x17', () => {
    const row = new Uint8Array(84);
    const result = buildRasterRow(row, true);
    expect(result[0]).toBe(0x17);
  });

  it('compressed RLE: all-white 8-byte row encodes as single run', () => {
    const row = new Uint8Array(1);
    const result = buildRasterRow(row, true);
    expect(result[0]).toBe(0x17);
    expect(result[1]).toBe(0x00 | 7);
  });

  it('compressed RLE: all-black 8-byte row encodes as single run', () => {
    const row = new Uint8Array([0xff]);
    const result = buildRasterRow(row, true);
    expect(result[0]).toBe(0x17);
    expect(result[1]).toBe(0x80 | 7);
  });
});

describe('buildShortFormFeed', () => {
  it('produces [0x1B, 0x47]', () => {
    expect(Array.from(buildShortFormFeed())).toEqual([0x1b, 0x47]);
  });
});

describe('buildStatusRequest', () => {
  it('produces [0x1B, 0x41]', () => {
    expect(Array.from(buildStatusRequest())).toEqual([0x1b, 0x41]);
  });
});

describe('buildDensity', () => {
  it('light → 0x63', () => {
    expect(buildDensity('light')[1]).toBe(0x63);
  });
  it('medium → 0x64', () => {
    expect(buildDensity('medium')[1]).toBe(0x64);
  });
  it('normal → 0x65', () => {
    expect(buildDensity('normal')[1]).toBe(0x65);
  });
  it('high → 0x67', () => {
    expect(buildDensity('high')[1]).toBe(0x67);
  });
});

describe('buildMode', () => {
  it('text → 0x68', () => {
    expect(buildMode('text')[1]).toBe(0x68);
  });
  it('graphics → 0x69', () => {
    expect(buildMode('graphics')[1]).toBe(0x69);
  });
});

describe('buildSelectRoll', () => {
  it("auto byte 0x30 (ASCII '0') → [0x1B, 0x71, 0x30]", () => {
    expect(Array.from(buildSelectRoll(0x30))).toEqual([0x1b, 0x71, 0x30]);
  });
  it("left byte 0x31 (ASCII '1') → [0x1B, 0x71, 0x31]", () => {
    expect(Array.from(buildSelectRoll(0x31))).toEqual([0x1b, 0x71, 0x31]);
  });
  it("right byte 0x32 (ASCII '2') → [0x1B, 0x71, 0x32]", () => {
    expect(Array.from(buildSelectRoll(0x32))).toEqual([0x1b, 0x71, 0x32]);
  });
});

describe('buildErrorRecovery', () => {
  it('starts with exactly 85 0x1B bytes followed by [0x1B, 0x41]', () => {
    const result = buildErrorRecovery();
    expect(result.length).toBe(87);
    for (let i = 0; i < 85; i++) {
      expect(result[i]).toBe(0x1b);
    }
    expect(result[85]).toBe(0x1b);
    expect(result[86]).toBe(0x41);
  });
});

describe('encodeLabel', () => {
  const device450 = DEVICES.LW_450;
  const device550 = DEVICES.LW_550;

  function makeBitmap(widthPx: number, heightPx: number): LabelBitmap {
    return createBitmap(widthPx, heightPx);
  }

  it('450 device: no job header, starts with reset', () => {
    const bm = makeBitmap(672, 100);
    const result = encodeLabel(device450, bm);
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x40);
  });

  it('550 device: starts with job header before reset', () => {
    const bm = makeBitmap(672, 100);
    const result = encodeLabel(device550, bm);
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x73);
    const jobHeaderEnd = 6;
    expect(result[jobHeaderEnd]).toBe(0x1b);
    expect(result[jobHeaderEnd + 1]).toBe(0x40);
  });

  it('correct row count matches bitmap height after rotation', () => {
    const heightPx = 100;
    const bm = makeBitmap(672, heightPx);
    const result = encodeLabel(device450, bm);
    let rowCount = 0;
    let i = 0;
    while (i < result.length) {
      if (result[i] === 0x16) {
        rowCount++;
        i += 1 + 84;
      } else {
        i++;
      }
    }
    expect(rowCount).toBe(heightPx);
  });

  it('copies=2: two form feeds', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(device450, bm, { copies: 2 });
    let formFeeds = 0;
    for (let i = 0; i < result.length - 1; i++) {
      if (result[i] === 0x1b && result[i + 1] === 0x45) formFeeds++;
    }
    expect(formFeeds).toBe(2);
  });

  it('bitmap narrower than head: pads to head width', () => {
    const bm = makeBitmap(100, 10);
    const result = encodeLabel(device450, bm);
    let rowCount = 0;
    let i = 0;
    while (i < result.length) {
      if (result[i] === 0x16) {
        rowCount++;
        i += 1 + 84;
      } else {
        i++;
      }
    }
    expect(rowCount).toBe(10);
  });

  it('bitmap wider than head: crops to head width', () => {
    const bm = makeBitmap(800, 10);
    const result = encodeLabel(device450, bm);
    let rowCount = 0;
    let i = 0;
    while (i < result.length) {
      if (result[i] === 0x16) {
        rowCount++;
        i += 1 + 84;
      } else {
        i++;
      }
    }
    expect(rowCount).toBe(10);
  });

  it('density and mode options are encoded', () => {
    const bm = makeBitmap(672, 5);
    const result = encodeLabel(device450, bm, { density: 'high', mode: 'graphics' });
    const bytes = Array.from(result);
    const densityIdx = bytes.findIndex((_b, i) => bytes[i] === 0x1b && bytes[i + 1] === 0x67);
    const modeIdx = bytes.findIndex((_b, i) => bytes[i] === 0x1b && bytes[i + 1] === 0x69);
    expect(densityIdx).toBeGreaterThan(-1);
    expect(modeIdx).toBeGreaterThan(-1);
  });

  it('compressed raster rows when compress=true', () => {
    const bm = makeBitmap(672, 5);
    const result = encodeLabel(device450, bm, { compress: true });
    const hasCompressed = Array.from(result).includes(0x17);
    expect(hasCompressed).toBe(true);
  });

  function findEscQByte(bytes: Uint8Array): number | undefined {
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x1b && bytes[i + 1] === 0x71) {
        return bytes[i + 2];
      }
    }
    return undefined;
  }

  it("Twin Turbo: explicit engine 'right' emits 0x32 (ASCII '2')", () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(DEVICES.LW_450_TWIN_TURBO, bm, { engine: 'right' });
    expect(findEscQByte(result)).toBe(0x32);
  });

  it("Twin Turbo: explicit engine 'left' emits 0x31 (ASCII '1')", () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(DEVICES.LW_450_TWIN_TURBO, bm, { engine: 'left' });
    expect(findEscQByte(result)).toBe(0x31);
  });

  it("Twin Turbo: engine 'auto' emits 0x30 (ASCII '0')", () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(DEVICES.LW_450_TWIN_TURBO, bm, { engine: 'auto' });
    expect(findEscQByte(result)).toBe(0x30);
  });

  it('Twin Turbo: omitted engine defaults to auto (0x30)', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(DEVICES.LW_450_TWIN_TURBO, bm);
    expect(findEscQByte(result)).toBe(0x30);
  });

  it('single-engine device: no ESC q on the wire even with engine: auto', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(device450, bm, { engine: 'auto' });
    expect(findEscQByte(result)).toBeUndefined();
  });

  it('single-engine device: no ESC q on the wire when engine omitted', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(device450, bm);
    expect(findEscQByte(result)).toBeUndefined();
  });

  it('Duo: no ESC q (Duo uses interface routing, not address byte)', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(DEVICES.LW_450_DUO, bm);
    expect(findEscQByte(result)).toBeUndefined();
  });

  it('throws when engine role does not exist on device', () => {
    const bm = makeBitmap(672, 10);
    expect(() => encodeLabel(DEVICES.LW_450_TWIN_TURBO, bm, { engine: 'middle' })).toThrow(
      /no engine with role "middle"/,
    );
  });

  it("throws UnsupportedOperationError on Duo's tape engine (d1-tape protocol)", () => {
    const bm = makeBitmap(128, 10);
    expect(() => encodeLabel(DEVICES.LW_450_DUO, bm, { engine: 'tape' })).toThrow(
      /protocol "d1-tape"/,
    );
  });
});
