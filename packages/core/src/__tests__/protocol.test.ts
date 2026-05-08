import { describe, it, expect } from 'vitest';
import { createBitmap, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { DeviceEntry, PrintableArea } from '@thermal-label/contracts';
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

  it('550 device: dispatched to 550 protocol module — no ESC @ in the stream', () => {
    // The 550 spec defines ESC @ as "Restart Print Engine" (destructive).
    // Detailed 550 encoder behaviour is asserted in protocol-550.test.ts;
    // this is the dispatch-side guarantee that encodeLabel never falls
    // through to the 450 path for an lw-550 engine.
    const bm = makeBitmap(672, 100);
    const result = encodeLabel(device550, bm);
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x73);
    // Ends with ESC Q (job trailer), not ESC E (form feed) like the 450.
    expect(result.at(-2)).toBe(0x1b);
    expect(result.at(-1)).toBe(0x51);
    // No ESC @ reboot anywhere in the stream.
    for (let i = 0; i < result.length - 1; i++) {
      if (result[i] === 0x1b && result[i + 1] === 0x40) {
        throw new Error(`ESC @ found at offset ${String(i)} — would reboot the print engine`);
      }
    }
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

  // Per LW SE450 Tech Ref p.9: ESC G (short form feed) and ESC q (roll
  // select) are rejected by the SE450 and the 300-series firmware. The
  // encoder must never emit them for any single-roll device in this
  // family; this is a regression-guard against accidentally enabling
  // them via a future code path.
  describe('300-series + SE450: never emits ESC G or ESC q', () => {
    function findEscByte(bytes: Uint8Array, opcode: number): number | undefined {
      for (let i = 0; i < bytes.length - 1; i++) {
        if (bytes[i] === 0x1b && bytes[i + 1] === opcode) return i;
      }
      return undefined;
    }

    const singleRollKeys = [
      'LW_300',
      'LW_310',
      'LW_330',
      'LW_330_TURBO',
      'LW_TURBO',
      'LW_EL40',
      'LW_EL60',
      'LW_SE450',
    ] as const;

    for (const key of singleRollKeys) {
      it(`${key}: no ESC G (0x1b 0x47)`, () => {
        const dev = DEVICES[key];
        const headDots = dev.engines[0]!.headDots;
        const bm = makeBitmap(headDots, 8);
        const out = encodeLabel(dev, bm, { copies: 2 });
        expect(findEscByte(out, 0x47)).toBeUndefined();
      });

      it(`${key}: no ESC q (0x1b 0x71)`, () => {
        const dev = DEVICES[key];
        const headDots = dev.engines[0]!.headDots;
        const bm = makeBitmap(headDots, 8);
        const out = encodeLabel(dev, bm);
        expect(findEscByte(out, 0x71)).toBeUndefined();
      });

      it(`${key}: ESC D byte matches headDots / 8`, () => {
        const dev = DEVICES[key];
        const headDots = dev.engines[0]!.headDots;
        const bm = makeBitmap(headDots, 4);
        const out = encodeLabel(dev, bm);
        const escD = findEscByte(out, 0x44);
        expect(escD).toBeDefined();
        expect(out[escD! + 2]).toBe(headDots / 8);
      });
    }
  });

  // Plan 08 §6 (Labelwriter subsection): the encoder now resolves
  // `printableArea` and crops/pads the wire bitmap accordingly. With
  // every DEVICES entry shipping `printableArea: undefined` today,
  // resolved area is `ZERO_PRINTABLE_AREA` and the wire output must
  // be byte-identical to the previous fit-to-head behaviour.
  describe('printable-area integration (plan 08 §6)', () => {
    it('field-absent: row count equals bitmap height (skip-rows is a no-op at zero)', () => {
      const headDots = device450.engines[0]!.headDots;
      const heightPx = 200;
      const bm = makeBitmap(headDots, heightPx);
      const out = encodeLabel(device450, bm);
      let rowCount = 0;
      let i = 0;
      while (i < out.length) {
        if (out[i] === 0x16) {
          rowCount++;
          i += 1 + headDots / 8;
        } else {
          i++;
        }
      }
      expect(rowCount).toBe(heightPx);
    });

    it('field-absent: ESC L label-length byte equals bitmap height', () => {
      const headDots = device450.engines[0]!.headDots;
      const heightPx = 250;
      const bm = makeBitmap(headDots, heightPx);
      const out = encodeLabel(device450, bm);
      // ESC L emits little-endian u16; find the bytes directly.
      let escL = -1;
      for (let i = 0; i < out.length - 3; i++) {
        if (out[i] === 0x1b && out[i + 1] === 0x4c) {
          escL = i;
          break;
        }
      }
      expect(escL).toBeGreaterThan(-1);
      const length = (out[escL + 2] ?? 0) | ((out[escL + 3] ?? 0) << 8);
      expect(length).toBe(heightPx);
    });

    /**
     * Synthesize a single-engine LW device with a populated
     * `printableArea`. Works against the LW 330 Turbo measured values
     * (lever-arch, May 2026) the plan calls out, but the field stays
     * absent on the registry entry until a follow-up data-population
     * PR — the dead-zone-aware path is exercised by overriding here.
     */
    function deviceWithPrintableArea(printableArea: PrintableArea): DeviceEntry {
      const base = DEVICES.LW_330_TURBO;
      const baseEngine = base.engines[0]!;
      return {
        ...base,
        engines: [{ ...baseEngine, printableArea }],
      };
    }

    it('populated fields: wire row count drops by leading + trailing dots', () => {
      // LW 330 Turbo: 300 dpi → 70 dots ≈ 5.93 mm leading,
      //                          18 dots ≈ 1.52 mm trailing,
      //                          18 dots ≈ 1.52 mm left,
      //                           0 dots right.
      const dpi = 300;
      const leadingMm = (70 * 25.4) / dpi; // back-solves to exactly 70 dots
      const trailingMm = (18 * 25.4) / dpi;
      const leftMm = (18 * 25.4) / dpi;
      const dev = deviceWithPrintableArea({
        leading: leadingMm,
        trailing: trailingMm,
        left: leftMm,
        right: 0,
      });
      const headDots = dev.engines[0]!.headDots; // 672
      const bytesPerRow = headDots / 8;

      const heightPx = 1051; // ADDRESS_LARGE-style label rows at 300 dpi
      const expectedWireRows = heightPx - 70 - 18; // 963

      const bm = makeBitmap(headDots, heightPx);
      const out = encodeLabel(dev, bm);

      // Count `0x16` raster prefix bytes.
      let rowCount = 0;
      let i = 0;
      while (i < out.length) {
        if (out[i] === 0x16) {
          rowCount++;
          i += 1 + bytesPerRow;
        } else {
          i++;
        }
      }
      expect(rowCount).toBe(expectedWireRows);

      // ESC L label-length matches the wire bitmap, not the authored
      // bitmap — the firmware sees the shorter stream.
      let escL = -1;
      for (let j = 0; j < out.length - 3; j++) {
        if (out[j] === 0x1b && out[j + 1] === 0x4c) {
          escL = j;
          break;
        }
      }
      expect(escL).toBeGreaterThan(-1);
      const length = (out[escL + 2] ?? 0) | ((out[escL + 3] ?? 0) << 8);
      expect(length).toBe(expectedWireRows);
    });

    it('populated fields: cross-feed pad places content at wire col `leftDots`', () => {
      const dpi = 300;
      const leftMm = (18 * 25.4) / dpi; // exactly 18 dots
      const dev = deviceWithPrintableArea({
        leading: 0,
        trailing: 0,
        left: leftMm,
        right: 0,
      });
      const headDots = dev.engines[0]!.headDots;
      const bytesPerRow = headDots / 8;

      // Label is narrower than the head: authored width 425 dots
      // (typical 36 mm label @ 300 dpi). Fill it solid black so we can
      // see exactly which wire columns the encoder fired.
      const labelWidthDots = 425;
      const bm = createBitmap(labelWidthDots, 4);
      const stride = Math.ceil(labelWidthDots / 8);
      // Fill the whole buffer with 0xff, then mask the trailing bits
      // in each row's last byte (per LabelBitmap invariant: bits past
      // `widthPx` stay zero).
      (bm.data as Uint8Array).fill(0xff);
      const trailingBits = labelWidthDots % 8;
      if (trailingBits !== 0) {
        const mask = (0xff << (8 - trailingBits)) & 0xff;
        for (let y = 0; y < bm.heightPx; y++) {
          const last = y * stride + (stride - 1);
          (bm.data as Uint8Array)[last] = (bm.data[last] ?? 0) & mask;
        }
      }

      const out = encodeLabel(dev, bm);

      // Pull the first raster row and inspect bit positions.
      let firstRowOffset = -1;
      for (let i = 0; i < out.length - 1; i++) {
        if (out[i] === 0x16) {
          firstRowOffset = i + 1;
          break;
        }
      }
      expect(firstRowOffset).toBeGreaterThan(-1);
      const row = out.subarray(firstRowOffset, firstRowOffset + bytesPerRow);

      function bitAt(col: number): number {
        const byte = row[col >> 3] ?? 0;
        return (byte >> (7 - (col & 7))) & 1;
      }

      // leftDots = 18 — cols 0..17 are the unprintable-left dead-zone
      // and must be white.
      for (let c = 0; c < 18; c++) {
        expect(bitAt(c)).toBe(0);
      }
      // Authored content occupies cols 18..(18 + (425 - 18)) = 18..425.
      // Right-shifted by leftDots — the authored col 18 lands at wire
      // col 18 (sourceColStart = leftDots), and the slice ends at wire
      // col 18 + (425 - 18) = 425.
      for (let c = 18; c < 425; c++) {
        expect(bitAt(c)).toBe(1);
      }
      // Past the label width (cols 425..671) the head fires harmlessly
      // into air — wire cols stay zero.
      for (let c = 425; c < headDots; c++) {
        expect(bitAt(c)).toBe(0);
      }
    });
  });
});
