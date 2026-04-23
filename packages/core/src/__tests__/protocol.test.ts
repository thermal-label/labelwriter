import { describe, it, expect } from 'vitest';
import { createBitmap, type LabelBitmap } from '@mbtech-nl/bitmap';
import {
  buildReset,
  buildSetBytesPerLine,
  buildSetLabelLength,
  buildFormFeed,
  buildJobHeader,
  buildRasterRow,
  buildErrorRecovery,
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
        i += 1 + device450.bytesPerRow;
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

  it('Twin Turbo: roll select command present when roll option given', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(DEVICES.LW_450_TWIN_TURBO, bm, { roll: 1 });
    let found = false;
    for (let i = 0; i < result.length - 2; i++) {
      if (result[i] === 0x1b && result[i + 1] === 0x71 && result[i + 2] === 1) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
