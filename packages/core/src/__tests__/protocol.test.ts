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
  encodeDuoTapeLabel,
  encodeLabel,
  isDuoTapeEngine,
  isEngineDrivable,
} from '../protocol.js';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';

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

  /**
   * Strip the chassis `printableArea` from a registry entry so the
   * encoder treats the wire bitmap as the authored bitmap (no leading
   * row skip). Used by tests that pre-date the 2026-05-08 LW chassis-
   * leading-dead-zone population — they exercise byte-shape invariants
   * that are independent of the leading-skip transform, and need a
   * `printableArea`-free device to keep the assertions tractable.
   * Tests that exercise the leading-skip behaviour itself use the real
   * registry entries (LW devices now ship `leading: 6` mm).
   */
  function noPrintableArea(device: DeviceEntry): DeviceEntry {
    return {
      ...device,
      engines: device.engines.map(e => {
        const next = { ...e };
        delete (next as { printableArea?: PrintableArea }).printableArea;
        return next;
      }),
    };
  }

  const device450Bare = noPrintableArea(device450);
  const device550Bare = noPrintableArea(device550);

  function makeBitmap(widthPx: number, heightPx: number): LabelBitmap {
    return createBitmap(widthPx, heightPx);
  }

  it('450 device: no job header, starts with reset', () => {
    const bm = makeBitmap(672, 100);
    const result = encodeLabel(device450Bare, bm);
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x40);
  });

  it('550 device: dispatched to 550 protocol module — no ESC @ in the stream', () => {
    // The 550 spec defines ESC @ as "Restart Print Engine" (destructive).
    // Detailed 550 encoder behaviour is asserted in protocol-550.test.ts;
    // this is the dispatch-side guarantee that encodeLabel never falls
    // through to the 450 path for an lw5-raster engine.
    const bm = makeBitmap(672, 100);
    const result = encodeLabel(device550Bare, bm);
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
    const result = encodeLabel(device450Bare, bm);
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
    const result = encodeLabel(device450Bare, bm, { copies: 2 });
    let formFeeds = 0;
    for (let i = 0; i < result.length - 1; i++) {
      if (result[i] === 0x1b && result[i + 1] === 0x45) formFeeds++;
    }
    expect(formFeeds).toBe(2);
  });

  it('bitmap narrower than head: pads to head width', () => {
    const bm = makeBitmap(100, 10);
    const result = encodeLabel(device450Bare, bm);
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
    const result = encodeLabel(device450Bare, bm);
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
    const result = encodeLabel(device450Bare, bm, { density: 'high', mode: 'graphics' });
    const bytes = Array.from(result);
    const densityIdx = bytes.findIndex((_b, i) => bytes[i] === 0x1b && bytes[i + 1] === 0x67);
    const modeIdx = bytes.findIndex((_b, i) => bytes[i] === 0x1b && bytes[i + 1] === 0x69);
    expect(densityIdx).toBeGreaterThan(-1);
    expect(modeIdx).toBeGreaterThan(-1);
  });

  it('compressed raster rows when compress=true', () => {
    const bm = makeBitmap(672, 5);
    const result = encodeLabel(device450Bare, bm, { compress: true });
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
    const result = encodeLabel(noPrintableArea(DEVICES.LW_450_TWIN_TURBO), bm, { engine: 'right' });
    expect(findEscQByte(result)).toBe(0x32);
  });

  it("Twin Turbo: explicit engine 'left' emits 0x31 (ASCII '1')", () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(noPrintableArea(DEVICES.LW_450_TWIN_TURBO), bm, { engine: 'left' });
    expect(findEscQByte(result)).toBe(0x31);
  });

  it("Twin Turbo: engine 'auto' emits 0x30 (ASCII '0')", () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(noPrintableArea(DEVICES.LW_450_TWIN_TURBO), bm, { engine: 'auto' });
    expect(findEscQByte(result)).toBe(0x30);
  });

  it('Twin Turbo: omitted engine defaults to auto (0x30)', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(noPrintableArea(DEVICES.LW_450_TWIN_TURBO), bm);
    expect(findEscQByte(result)).toBe(0x30);
  });

  it('single-engine device: no ESC q on the wire even with engine: auto', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(device450Bare, bm, { engine: 'auto' });
    expect(findEscQByte(result)).toBeUndefined();
  });

  it('single-engine device: no ESC q on the wire when engine omitted', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(device450Bare, bm);
    expect(findEscQByte(result)).toBeUndefined();
  });

  it('Duo: no ESC q (Duo uses interface routing, not address byte)', () => {
    const bm = makeBitmap(672, 10);
    const result = encodeLabel(noPrintableArea(DEVICES.LW_450_DUO), bm);
    expect(findEscQByte(result)).toBeUndefined();
  });

  it('throws when engine role does not exist on device', () => {
    const bm = makeBitmap(672, 10);
    expect(() => encodeLabel(DEVICES.LW_450_TWIN_TURBO, bm, { engine: 'middle' })).toThrow(
      /no engine with role "middle"/,
    );
  });

  it("dispatches the Duo's tape engine (d1-tape) through d1-core's buildPrinterStream", async () => {
    const bm = makeBitmap(128, 10);
    // d1-core is an OPTIONAL peer; the tape path lives on the async
    // `encodeDuoTapeLabel` entry. `encodeLabel` itself throws
    // UnsupportedOperationError on d1-tape engines to push callers to
    // the async helper.
    const bytes = await encodeDuoTapeLabel(DEVICES.LW_450_DUO, bm, { engine: 'tape' });
    // d1-core wire shape begins with `ESC C n` (tape-type selector),
    // not the lw-raster `ESC @` reset.
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x43);
    // Final byte is `ESC A` (status query) — d1-core terminator.
    expect(bytes.at(-2)).toBe(0x1b);
    expect(bytes.at(-1)).toBe(0x41);
  });

  it('encodeLabel on a d1-tape engine throws UnsupportedOperationError pointing to encodeDuoTapeLabel', () => {
    const bm = makeBitmap(128, 10);
    expect(() => encodeLabel(DEVICES.LW_450_DUO, bm, { engine: 'tape' })).toThrow(
      /encodeDuoTapeLabel/,
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
        const dev = noPrintableArea(DEVICES[key]);
        const headDots = dev.engines[0]!.headDots;
        const bm = makeBitmap(headDots, 8);
        const out = encodeLabel(dev, bm, { copies: 2 });
        expect(findEscByte(out, 0x47)).toBeUndefined();
      });

      it(`${key}: no ESC q (0x1b 0x71)`, () => {
        const dev = noPrintableArea(DEVICES[key]);
        const headDots = dev.engines[0]!.headDots;
        const bm = makeBitmap(headDots, 8);
        const out = encodeLabel(dev, bm);
        expect(findEscByte(out, 0x71)).toBeUndefined();
      });

      it(`${key}: ESC D byte matches headDots / 8`, () => {
        const dev = noPrintableArea(DEVICES[key]);
        const headDots = dev.engines[0]!.headDots;
        const bm = makeBitmap(headDots, 4);
        const out = encodeLabel(dev, bm);
        const escD = findEscByte(out, 0x44);
        expect(escD).toBeDefined();
        expect(out[escD! + 2]).toBe(headDots / 8);
      });
    }
  });

  // Plan 08 §6 rolled back on 2026-05-23 (debug/print-flow): the
  // encoder no longer reads `printableArea` — dead-zone offsets are
  // applied by the authoring layer via `getPrintableCanvasDots`. These
  // tests pin the encoder's new contract: every row of the input
  // bitmap reaches the wire regardless of the device's leading value.
  describe('encoder ignores printableArea (round 2, debug/print-flow)', () => {
    /**
     * Synthesize a single-engine LW device with a populated
     * `printableArea`. Used here to prove the encoder makes no
     * decisions on it.
     */
    function deviceWithPrintableArea(printableArea: PrintableArea): DeviceEntry {
      const base = DEVICES.LW_330_TURBO;
      const baseEngine = base.engines[0]!;
      return { ...base, engines: [{ ...baseEngine, printableArea }] };
    }

    it('wire row count equals bitmap.heightPx for a non-zero leading', () => {
      const dpi = 300;
      const leadingMm = (70 * 25.4) / dpi; // 70 dots — would have been the old crop budget
      const dev = deviceWithPrintableArea({
        leading: leadingMm,
        trailing: 0,
        left: 0,
        right: 0,
      });
      const headDots = dev.engines[0]!.headDots;
      const bytesPerRow = headDots / 8;
      const heightPx = 200;
      const bm = makeBitmap(headDots, heightPx);
      const out = encodeLabel(dev, bm);

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
      expect(rowCount).toBe(heightPx);
    });

    it('ESC L label-length still tracks the caller (bitmap.heightPx by default)', () => {
      const dpi = 300;
      const leadingMm = (70 * 25.4) / dpi;
      const dev = deviceWithPrintableArea({
        leading: leadingMm,
        trailing: 0,
        left: 0,
        right: 0,
      });
      const headDots = dev.engines[0]!.headDots;
      const heightPx = 250;
      const bm = makeBitmap(headDots, heightPx);
      const out = encodeLabel(dev, bm);
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

    it('options.labelLengthDots is the supported override for short-authored bitmaps', () => {
      // The authoring contract: when the harness authors a bitmap at
      // the printable canvas height (< media.lengthDots), it MUST pass
      // `options.labelLengthDots` so the printer's form-feed pitch
      // stays correct.
      const dev = DEVICES.LW_450; // any LW device
      const headDots = dev.engines[0]!.headDots;
      const printableHeight = 1051 - 71; // simulated 6 mm leading at 300 dpi
      const bm = makeBitmap(headDots, printableHeight);
      const out = encodeLabel(dev, bm, { labelLengthDots: 1051 });
      let escL = -1;
      for (let i = 0; i < out.length - 3; i++) {
        if (out[i] === 0x1b && out[i + 1] === 0x4c) {
          escL = i;
          break;
        }
      }
      expect(escL).toBeGreaterThan(-1);
      const length = (out[escL + 2] ?? 0) | ((out[escL + 3] ?? 0) << 8);
      expect(length).toBe(1051);
    });
  });
});

describe('isEngineDrivable', () => {
  it('is true for the encoder-supported protocols (lw-raster / lw5-raster / d1-tape)', () => {
    expect(isEngineDrivable(DEVICES.LW_450.engines[0]!)).toBe(true);
    expect(isEngineDrivable(DEVICES.LW_550.engines[0]!)).toBe(true);
    const tape = DEVICES.LW_450_DUO.engines.find(e => e.protocol === 'd1-tape');
    expect(tape).toBeDefined();
    expect(isEngineDrivable(tape!)).toBe(true);
  });

  it('is false for a protocol the encoder does not handle', () => {
    const bogus = { ...DEVICES.LW_450.engines[0]!, protocol: 'unknown-proto' };
    expect(isEngineDrivable(bogus)).toBe(false);
  });
});

describe('isDuoTapeEngine', () => {
  it('is true only for d1-tape engines', () => {
    const tape = DEVICES.LW_450_DUO.engines.find(e => e.protocol === 'd1-tape');
    expect(isDuoTapeEngine(tape!)).toBe(true);
  });

  it('is false for raster engines', () => {
    expect(isDuoTapeEngine(DEVICES.LW_450.engines[0]!)).toBe(false);
    expect(isDuoTapeEngine(DEVICES.LW_550.engines[0]!)).toBe(false);
  });
});

describe('encodeLabel — error paths', () => {
  it('throws when the device declares no engines', () => {
    const noEngines = { ...DEVICES.LW_450, key: 'BROKEN', engines: [] } as unknown as DeviceEntry;
    expect(() => encodeLabel(noEngines, createBitmap(672, 4))).toThrow(/BROKEN has no engines/);
  });

  it('throws UnsupportedOperationError on an engine with an unhandled protocol', () => {
    // Engine whose protocol is not in SUPPORTED_PROTOCOLS — `encodeLabel`
    // dispatches past the lw5-raster / d1-tape guards and hits
    // `assertEncoderSupports`, which throws.
    const bogus = {
      ...DEVICES.LW_450,
      key: 'BOGUS',
      engines: [{ ...DEVICES.LW_450.engines[0]!, protocol: 'mystery-raster' }],
    } as unknown as DeviceEntry;
    expect(() => encodeLabel(bogus, createBitmap(672, 4))).toThrow(/mystery-raster/);
  });
});

describe('encodeDuoTapeLabel — guards and options', () => {
  it('throws UnsupportedOperationError when the resolved engine is not d1-tape', async () => {
    // The Duo label engine is lw-raster, not d1-tape — encodeDuoTapeLabel
    // refuses it and points the caller at encodeLabel.
    await expect(
      encodeDuoTapeLabel(DEVICES.LW_450_DUO, createBitmap(128, 8), { engine: 'label' }),
    ).rejects.toThrow(/not "d1-tape"/);
  });

  it('throws when supplied media is not of type "tape"', async () => {
    await expect(
      encodeDuoTapeLabel(
        DEVICES.LW_450_DUO,
        createBitmap(128, 8),
        { engine: 'tape' },
        MEDIA.ADDRESS_STANDARD,
      ),
    ).rejects.toThrow(/requires media of type "tape"/);
  });

  it('forwards copies and the media tapeColour selector to d1-core', async () => {
    // `copies` and a media-baked `tapeColour` both flow into the d1-core
    // options object — exercises the two optional-field branches.
    const tapeMedia = { ...MEDIA.STANDARD_BLACK_ON_WHITE_12, tapeColour: 0x07 };
    const bytes = await encodeDuoTapeLabel(
      DEVICES.LW_450_DUO,
      createBitmap(128, 8),
      { engine: 'tape', copies: 3 },
      tapeMedia,
    );
    // d1-core emits ESC C <tapeType> at the head of the stream.
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x43);
    expect(bytes[2]).toBe(0x07);
  });
});

describe('buildRasterRow — compressed RLE', () => {
  it('emits alternating runs for a row with adjacent differing bits', () => {
    // 0b10101010 — every bit differs from its neighbour, so the
    // run-length walk breaks on each bit (`nextBit !== bit`), producing
    // eight single-bit runs.
    const row = new Uint8Array([0b10101010]);
    const out = buildRasterRow(row, true);
    expect(out[0]).toBe(0x17); // ETB compressed-row marker
    // 8 RLE bytes follow the marker — one per single-bit run.
    expect(out.length).toBe(9);
    for (let i = 1; i < out.length; i++) {
      // run length encoded as (run - 1); single-bit runs → low 7 bits 0.
      expect(out[i]! & 0x7f).toBe(0);
    }
  });

  it('coalesces a uniform row into a single long run', () => {
    // All-zero 8-byte row = 64 identical bits → one run of 64.
    const row = new Uint8Array(8);
    const out = buildRasterRow(row, true);
    expect(out[0]).toBe(0x17);
    expect(out.length).toBe(2);
    expect(out[1]! & 0x7f).toBe(63); // run-1 for 64 bits
  });
});
