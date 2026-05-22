import { describe, expect, it } from 'vitest';
import { createBitmap } from '@mbtech-nl/bitmap';
import type { DeviceEntry, PrintableArea } from '@thermal-label/contracts';
import {
  build550JobHeader,
  build550Mode,
  build550Density,
  build550ResetDensity,
  build550ContentType,
  build550LabelIndex,
  build550LabelHeader,
  build550ShortFormFeed,
  build550FormFeed,
  build550EndJob,
  build550StatusRequest,
  build550GetSku,
  build550GetVersion,
  build550Restart,
  build550Recovery,
  build550FactoryReset,
  build550SetLabelCount,
  density550Percent,
  PRINT_STATUS_LOCK_NOT_GRANTED,
  compose550Job,
  encode550Label,
  parseEngineVersion,
  parseSkuInfo,
  skuInfoToMedia,
  skuInfoDetails,
  withDetectedMedia,
  ENGINE_VERSION_BYTE_COUNT,
  SKU_INFO_BYTE_COUNT,
  STATUS_BYTE_COUNT_550,
} from '../protocol-550.js';
import { DEVICES } from '../devices.js';

describe('550 byte builders', () => {
  it('build550JobHeader: ESC s + u32LE job ID', () => {
    expect(Array.from(build550JobHeader(0x01020304))).toEqual([0x1b, 0x73, 0x04, 0x03, 0x02, 0x01]);
  });

  it('build550Mode: ESC h for text, ESC i for graphics', () => {
    expect(Array.from(build550Mode('text'))).toEqual([0x1b, 0x68]);
    expect(Array.from(build550Mode('graphics'))).toEqual([0x1b, 0x69]);
  });

  it('build550Density: ESC C + duty byte', () => {
    expect(Array.from(build550Density(100))).toEqual([0x1b, 0x43, 100]);
    expect(Array.from(build550Density(0))).toEqual([0x1b, 0x43, 0]);
    expect(Array.from(build550Density(200))).toEqual([0x1b, 0x43, 200]);
  });

  it('build550Density: rejects out-of-range duty', () => {
    expect(() => build550Density(-1)).toThrow(RangeError);
    expect(() => build550Density(201)).toThrow(RangeError);
    expect(() => build550Density(1.5)).toThrow(RangeError);
  });

  it('build550ResetDensity: ESC e (1B 65), no parameter', () => {
    expect(Array.from(build550ResetDensity())).toEqual([0x1b, 0x65]);
  });

  it('build550ContentType: 0x10 normal, 0x20 high', () => {
    expect(Array.from(build550ContentType('normal'))).toEqual([0x1b, 0x74, 0x10]);
    expect(Array.from(build550ContentType('high'))).toEqual([0x1b, 0x74, 0x20]);
  });

  it('build550LabelIndex: ESC n + u16LE index', () => {
    expect(Array.from(build550LabelIndex(0))).toEqual([0x1b, 0x6e, 0, 0]);
    expect(Array.from(build550LabelIndex(0x0304))).toEqual([0x1b, 0x6e, 0x04, 0x03]);
  });

  it('build550LabelHeader: ESC D + bpp + align + u32LE width + u32LE height (12 bytes)', () => {
    const out = build550LabelHeader(500, 672);
    expect(out.length).toBe(12);
    expect(out[0]).toBe(0x1b);
    expect(out[1]).toBe(0x44);
    expect(out[2]).toBe(1); // default BPP
    expect(out[3]).toBe(2); // default alignment (bottom)
    // Width = 500 = 0x000001f4, little-endian
    expect(out[4]).toBe(0xf4);
    expect(out[5]).toBe(0x01);
    expect(out[6]).toBe(0x00);
    expect(out[7]).toBe(0x00);
    // Height = 672 = 0x000002a0, little-endian
    expect(out[8]).toBe(0xa0);
    expect(out[9]).toBe(0x02);
    expect(out[10]).toBe(0x00);
    expect(out[11]).toBe(0x00);
  });

  it('build550ShortFormFeed: ESC G (1B 47)', () => {
    expect(Array.from(build550ShortFormFeed())).toEqual([0x1b, 0x47]);
  });

  it('build550FormFeed: ESC E (1B 45)', () => {
    expect(Array.from(build550FormFeed())).toEqual([0x1b, 0x45]);
  });

  it('build550EndJob: ESC Q (1B 51)', () => {
    expect(Array.from(build550EndJob())).toEqual([0x1b, 0x51]);
  });

  it('build550StatusRequest: ESC A + lock byte', () => {
    expect(Array.from(build550StatusRequest(0))).toEqual([0x1b, 0x41, 0]);
    expect(Array.from(build550StatusRequest(1))).toEqual([0x1b, 0x41, 1]);
    expect(Array.from(build550StatusRequest(2))).toEqual([0x1b, 0x41, 2]);
  });

  it('build550GetSku: ESC U (1B 55)', () => {
    expect(Array.from(build550GetSku())).toEqual([0x1b, 0x55]);
  });

  it('build550GetVersion: ESC V (1B 56)', () => {
    expect(Array.from(build550GetVersion())).toEqual([0x1b, 0x56]);
  });

  it('build550Restart: ESC @ (1B 40) — destructive', () => {
    expect(Array.from(build550Restart())).toEqual([0x1b, 0x40]);
  });

  it('build550Recovery: ESC Q (1B 51) — releases pending job + host lock', () => {
    // Soft-recovery: same byte as build550EndJob, but used in the
    // recover() path rather than as a job trailer. Documenting this
    // distinction in tests so a future refactor doesn't deduplicate
    // them in a way that breaks the recovery semantics.
    expect(Array.from(build550Recovery())).toEqual([0x1b, 0x51]);
  });

  it('build550FactoryReset: ESC * (1B 2A) — destructive', () => {
    expect(Array.from(build550FactoryReset())).toEqual([0x1b, 0x2a]);
  });

  it('build550SetLabelCount: ESC o + count byte', () => {
    expect(Array.from(build550SetLabelCount(0))).toEqual([0x1b, 0x6f, 0]);
    expect(Array.from(build550SetLabelCount(255))).toEqual([0x1b, 0x6f, 255]);
  });

  it('build550SetLabelCount: rejects out-of-range counts', () => {
    expect(() => build550SetLabelCount(-1)).toThrow(RangeError);
    expect(() => build550SetLabelCount(256)).toThrow(RangeError);
    expect(() => build550SetLabelCount(1.5)).toThrow(RangeError);
  });

  it('PRINT_STATUS_LOCK_NOT_GRANTED is 5 (per spec p.13-14)', () => {
    expect(PRINT_STATUS_LOCK_NOT_GRANTED).toBe(5);
  });

  it('byte-count constants match the spec (32 / 63 / 34)', () => {
    expect(STATUS_BYTE_COUNT_550).toBe(32);
    expect(SKU_INFO_BYTE_COUNT).toBe(63);
    expect(ENGINE_VERSION_BYTE_COUNT).toBe(34);
  });
});

describe('density550Percent', () => {
  it('maps the family Density enum to documented percentages', () => {
    expect(density550Percent('light')).toBe(70);
    expect(density550Percent('medium')).toBe(85);
    expect(density550Percent('normal')).toBe(100);
    expect(density550Percent('high')).toBe(130);
  });
});

describe('encode550Label', () => {
  /**
   * Strip the chassis `printableArea` from a registry entry so the
   * encoder treats the wire bitmap as the authored bitmap (no leading
   * row skip). Tests that exercise byte-shape invariants independent
   * of the leading-skip transform synthesise a bare device. See the
   * matching helper in `protocol.test.ts` for rationale.
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

  const lw550 = noPrintableArea(DEVICES.LW_550);
  const lw5xl = noPrintableArea(DEVICES.LW_5XL);

  const bm = (widthPx: number, heightPx: number): ReturnType<typeof createBitmap> =>
    createBitmap(widthPx, heightPx);

  it('starts with ESC s job header', () => {
    const out = encode550Label(lw550, bm(672, 100), { jobId: 0xdeadbeef });
    expect(out[0]).toBe(0x1b);
    expect(out[1]).toBe(0x73);
    // u32LE 0xdeadbeef
    expect(out[2]).toBe(0xef);
    expect(out[3]).toBe(0xbe);
    expect(out[4]).toBe(0xad);
    expect(out[5]).toBe(0xde);
  });

  it('ends with ESC Q (job trailer)', () => {
    const out = encode550Label(lw550, bm(672, 100));
    expect(out.at(-2)).toBe(0x1b);
    expect(out.at(-1)).toBe(0x51);
  });

  it('emits ESC h (text) by default and ESC i for graphics', () => {
    const text = encode550Label(lw550, bm(672, 4));
    const graphics = encode550Label(lw550, bm(672, 4), { mode: 'graphics' });
    // After 6-byte job header, mode opcode at byte 6
    expect(text[6]).toBe(0x1b);
    expect(text[7]).toBe(0x68);
    expect(graphics[7]).toBe(0x69);
  });

  it('emits ESC C with the mapped density percent', () => {
    const out = encode550Label(lw550, bm(672, 4), { density: 'light' });
    // 6 (job header) + 2 (mode) = density at byte 8
    expect(out[8]).toBe(0x1b);
    expect(out[9]).toBe(0x43);
    expect(out[10]).toBe(70);
  });

  it('emits ESC n + ESC D 12-byte header per copy', () => {
    const out = encode550Label(lw550, bm(672, 8), { copies: 1 });
    // After 6 + 2 + 3 = 11 bytes of header, ESC n starts
    let i = 11;
    expect(out[i]).toBe(0x1b);
    expect(out[i + 1]).toBe(0x6e);
    // Skip 4 bytes of ESC n (ESC + n + u16 index)
    i += 4;
    expect(out[i]).toBe(0x1b);
    expect(out[i + 1]).toBe(0x44);
    // BPP=1, align=2, width=8, height=672
    expect(out[i + 2]).toBe(1);
    expect(out[i + 3]).toBe(2);
    expect(out[i + 4]).toBe(8);
  });

  it('raster block has no SYN/ETB framing — pure header + data', () => {
    const out = encode550Label(lw550, bm(672, 4));
    // 11 (job header) + 4 (ESC n) + 12 (ESC D) = 27 bytes preamble
    // Followed by 4 raster lines × 84 bytes = 336 bytes of pure data
    // Then ESC G + ESC E + ESC Q = 6 bytes trailer
    expect(out.length).toBe(27 + 4 * 84 + 2 + 2 + 2);
    // The data block must not contain any SYN (0x16) framing —
    // verify the first raster byte is NOT preceded by 0x16
    const firstDataByte = 27;
    // Just confirm length math holds
    expect(out[firstDataByte]).toBe(0); // empty bitmap → all-zero rows
  });

  it('footers every copy with ESC G; ESC E once in the job trailer', () => {
    const out = encode550Label(lw550, bm(672, 4), { copies: 3 });
    const escGCount = countEsc(out, 0x47);
    const escECount = countEsc(out, 0x45);
    expect(escGCount).toBe(3); // ESC G after every label
    expect(escECount).toBe(1); // ESC E once, in finalize
  });

  it('exactly one ESC Q regardless of copy count', () => {
    expect(countEsc(encode550Label(lw550, bm(672, 4), { copies: 1 }), 0x51)).toBe(1);
    expect(countEsc(encode550Label(lw550, bm(672, 4), { copies: 5 }), 0x51)).toBe(1);
  });

  it('5XL: per-line bytes = 156 (1248-dot head)', () => {
    const out = encode550Label(lw5xl, bm(1248, 4));
    // Find ESC D, then check Width and Height
    const idx = findEscByte(out, 0x44);
    expect(idx).toBeDefined();
    // Height (bytes 8-11 of the 12-byte header) = 1248 = 0x000004e0
    expect(out[idx! + 8]).toBe(0xe0);
    expect(out[idx! + 9]).toBe(0x04);
  });

  it('label index increments per copy, starting at 0', () => {
    const out = encode550Label(lw550, bm(672, 1), { copies: 3 });
    // Find all ESC n occurrences — index is u16LE.
    const indices: number[] = [];
    for (let i = 0; i < out.length - 3; i++) {
      if (out[i] === 0x1b && out[i + 1] === 0x6e) {
        indices.push(out[i + 2]! | (out[i + 3]! << 8));
      }
    }
    expect(indices).toEqual([0, 1, 2]);
  });

  it('throws when the device has no lw5-raster engine', () => {
    expect(() => encode550Label(noPrintableArea(DEVICES.LW_450), bm(672, 4))).toThrow(/lw5-raster/);
  });

  it('does not contain ESC @ (which would reboot the print engine)', () => {
    const out = encode550Label(lw550, bm(672, 8), { copies: 2 });
    expect(findEscByte(out, 0x40)).toBeUndefined();
  });

  it('does not emit any compressed-raster framing (0x17 ETB)', () => {
    const out = encode550Label(lw550, bm(672, 4), { compress: true });
    expect(findEscByte(out, 0x17)).toBeUndefined();
  });

  it('emits ESC T 0x20 when speed=high', () => {
    const out = encode550Label(lw550, bm(672, 4), { speed: 'high' });
    const idx = findEscByte(out, 0x74);
    expect(idx).toBeDefined();
    expect(out[idx! + 2]).toBe(0x20);
  });

  it('emits ESC T 0x10 when speed=normal', () => {
    const out = encode550Label(lw550, bm(672, 4), { speed: 'normal' });
    const idx = findEscByte(out, 0x74);
    expect(idx).toBeDefined();
    expect(out[idx! + 2]).toBe(0x10);
  });

  it('omits ESC T when speed is unset (firmware default = normal)', () => {
    const out = encode550Label(lw550, bm(672, 4));
    expect(findEscByte(out, 0x74)).toBeUndefined();
  });

  // Plan 08 §6 (Labelwriter subsection): the 550 encoder mirrors the
  // 450 dead-zone pipeline. With every DEVICES entry shipping
  // `printableArea: undefined` today, resolved area is
  // `ZERO_PRINTABLE_AREA` and the wire output stays byte-identical.
  describe('printable-area integration (plan 08 §6)', () => {
    it('field-absent: ESC D widthLines equals bitmap height', () => {
      const heightPx = 200;
      const out = encode550Label(lw550, bm(672, heightPx));
      const escD = findEscByte(out, 0x44);
      expect(escD).toBeDefined();
      // Width = u32LE at bytes 4..7 of ESC D = number of raster lines
      const width =
        (out[escD! + 4]! |
          (out[escD! + 5]! << 8) |
          (out[escD! + 6]! << 16) |
          (out[escD! + 7]! << 24)) >>>
        0;
      expect(width).toBe(heightPx);
    });

    function deviceWithPrintableArea(printableArea: PrintableArea): DeviceEntry {
      const baseEngine = lw550.engines[0]!;
      return {
        ...lw550,
        engines: [{ ...baseEngine, printableArea }],
      };
    }

    it('populated fields: widthLines drops by leading + trailing dots', () => {
      const dpi = 300;
      const leadingMm = (70 * 25.4) / dpi;
      const trailingMm = (18 * 25.4) / dpi;
      const dev = deviceWithPrintableArea({
        leading: leadingMm,
        trailing: trailingMm,
        left: 0,
        right: 0,
      });
      const heightPx = 1051;
      const expectedWireRows = heightPx - 70 - 18;
      const out = encode550Label(dev, bm(672, heightPx));
      const escD = findEscByte(out, 0x44);
      expect(escD).toBeDefined();
      const width =
        (out[escD! + 4]! |
          (out[escD! + 5]! << 8) |
          (out[escD! + 6]! << 16) |
          (out[escD! + 7]! << 24)) >>>
        0;
      expect(width).toBe(expectedWireRows);
    });
  });
});

describe('compose550Job', () => {
  const bm = (widthPx: number, heightPx: number): ReturnType<typeof createBitmap> =>
    createBitmap(widthPx, heightPx);

  it('preamble starts with ESC s and carries no label or trailer bytes', () => {
    const job = compose550Job(DEVICES.LW_550, bm(672, 200));
    expect(job.preamble[0]).toBe(0x1b);
    expect(job.preamble[1]).toBe(0x73); // ESC s
    expect(findEscByte(job.preamble, 0x6e)).toBeUndefined(); // no ESC n
    expect(findEscByte(job.preamble, 0x44)).toBeUndefined(); // no ESC D
    expect(findEscByte(job.preamble, 0x51)).toBeUndefined(); // no ESC Q
  });

  it('emits one label segment per copy, each starting ESC n and ending ESC G', () => {
    const job = compose550Job(DEVICES.LW_550, bm(672, 200), { copies: 3 });
    expect(job.labels).toHaveLength(3);
    for (const label of job.labels) {
      expect(label[0]).toBe(0x1b);
      expect(label[1]).toBe(0x6e); // ESC n
      expect(label.at(-2)).toBe(0x1b);
      expect(label.at(-1)).toBe(0x47); // ESC G
    }
  });

  it('finalize is exactly ESC E + ESC Q', () => {
    const job = compose550Job(DEVICES.LW_550, bm(672, 200));
    expect(Array.from(job.finalize)).toEqual([0x1b, 0x45, 0x1b, 0x51]);
  });

  it('encode550Label equals preamble + labels + finalize concatenated', () => {
    const job = compose550Job(DEVICES.LW_550, bm(672, 200), { copies: 2 });
    const flat = encode550Label(DEVICES.LW_550, bm(672, 200), { copies: 2 });
    const segLen =
      job.preamble.length +
      job.labels.reduce((n, l) => n + l.length, 0) +
      job.finalize.length;
    expect(flat.length).toBe(segLen);
  });

  it('throws when the device has no lw5-raster engine', () => {
    expect(() => compose550Job(DEVICES.LW_450, bm(672, 200))).toThrow(/lw5-raster/);
  });
});

describe('encodeLabel dispatch', () => {
  it('routes lw5-raster engines to encode550Label (no ESC @ reset, ends with ESC Q)', async () => {
    const { encodeLabel } = await import('../protocol.js');
    // Bitmap height needs to be > the LW chassis leading dead zone
    // (6 mm @ 300 dpi = 71 dots) so the wire row count is positive
    // and the dispatch produces a complete 550 stream.
    const out = encodeLabel(DEVICES.LW_550, createBitmap(672, 200));
    // 550-shaped: starts with ESC s, ends with ESC Q
    expect(out[0]).toBe(0x1b);
    expect(out[1]).toBe(0x73);
    expect(out.at(-1)).toBe(0x51);
    // Must not contain ESC @ (would reboot the engine)
    expect(findEscByte(out, 0x40)).toBeUndefined();
  });
});

describe('parseEngineVersion', () => {
  it('parses HW / FWAP / major / minor / date / PID', () => {
    const buf = new Uint8Array(34);
    const enc = new TextEncoder();
    buf.set(enc.encode('HW-1.2          '), 0);
    buf.set(enc.encode('FWAP'), 16);
    buf.set(enc.encode('1.0 '), 20);
    buf.set(enc.encode('5   '), 24);
    buf.set(enc.encode('0321'), 28);
    buf[32] = 0x28;
    buf[33] = 0x00;
    const v = parseEngineVersion(buf);
    expect(v.hwVersion).toBe('HW-1.2');
    expect(v.fwKind).toBe('application');
    expect(v.fwMajor).toBe('1.0');
    expect(v.fwMinor).toBe('5');
    expect(v.fwReleaseDate).toBe('0321');
    expect(v.pid).toBe(0x0028);
  });

  it('recognises FWBL as bootloader', () => {
    const buf = new Uint8Array(34);
    new TextEncoder().encodeInto('FWBL', buf.subarray(16, 20));
    expect(parseEngineVersion(buf).fwKind).toBe('bootloader');
  });

  it('falls back to "unknown" fwKind for an unrecognised firmware tag', () => {
    // Neither 'FWAP' nor 'FWBL' — a future or corrupt firmware tag must
    // not be silently coerced; it surfaces as 'unknown'.
    const buf = new Uint8Array(34);
    new TextEncoder().encodeInto('ZZZZ', buf.subarray(16, 20));
    expect(parseEngineVersion(buf).fwKind).toBe('unknown');
  });

  it('throws on short input', () => {
    expect(() => parseEngineVersion(new Uint8Array(10))).toThrow(/34 bytes/);
  });
});

describe('parseSkuInfo', () => {
  function makeSku(): Uint8Array {
    const buf = new Uint8Array(63);
    // magic 0xCAB6
    buf[0] = 0xb6;
    buf[1] = 0xca;
    buf[2] = 0x30; // version '0'
    // SKU at bytes 8-19
    new TextEncoder().encodeInto('30252       ', buf.subarray(8, 20));
    buf[20] = 0x00; // brand DYMO
    buf[21] = 0xff; // region global
    buf[22] = 0x03; // material: paper
    buf[23] = 0x01; // labelType: die
    buf[24] = 0x01; // labelColor: white
    buf[25] = 0x00; // contentColor: black
    // labelLengthMm at 40-41, labelWidthMm at 42-43 — deci-mm on the
    // wire (S0722540 / 57×32 mm roll: 317 → 31.7, 571 → 57.1)
    buf[40] = 0x3d;
    buf[41] = 0x01; // labelLengthMm 317 → 31.7
    buf[42] = 0x3b;
    buf[43] = 0x02; // labelWidthMm 571 → 57.1
    return buf;
  }

  it('parses magic, SKU, brand, region', () => {
    const sku = parseSkuInfo(makeSku());
    expect(sku.magic).toBe(0xcab6);
    expect(sku.sku).toBe('30252');
    expect(sku.brand).toBe('dymo');
    expect(sku.region).toBe(0xff);
  });

  it('decodes material / labelType / labelColor / contentColor enums', () => {
    const sku = parseSkuInfo(makeSku());
    expect(sku.material).toBe('paper');
    expect(sku.labelType).toBe('die');
    expect(sku.labelColor).toBe('white');
    expect(sku.contentColor).toBe('black');
  });

  it('decodes label dimensions from deci-mm u16-LE bytes 40-43', () => {
    const sku = parseSkuInfo(makeSku());
    // 317 / 571 deci-mm → 31.7 / 57.1 mm, not 317 / 571.
    expect(sku.labelLengthMm).toBe(31.7);
    expect(sku.labelWidthMm).toBe(57.1);
  });

  it('falls back to "unknown" for out-of-range enum bytes', () => {
    const buf = makeSku();
    buf[20] = 0xff; // brand
    buf[22] = 0xff; // material
    buf[23] = 0xff; // labelType  — past LABEL_TYPE_TABLE
    buf[24] = 0xff; // labelColor — past LABEL_COLOR_TABLE
    buf[25] = 0xff; // contentColor — past CONTENT_COLOR_TABLE
    buf[56] = 0xff; // counterStrategy — neither count-up nor count-down
    const sku = parseSkuInfo(buf);
    expect(sku.brand).toBe('unknown');
    expect(sku.material).toBe('unknown');
    expect(sku.labelType).toBe('unknown');
    expect(sku.labelColor).toBe('unknown');
    expect(sku.contentColor).toBe('unknown');
    expect(sku.counterStrategy).toBe('unknown');
  });

  it('decodes the count-up counter strategy (byte 56 = 0x00)', () => {
    const buf = makeSku();
    buf[56] = 0x00;
    expect(parseSkuInfo(buf).counterStrategy).toBe('count-up');
  });

  it('throws on short input', () => {
    expect(() => parseSkuInfo(new Uint8Array(10))).toThrow(/63 bytes/);
  });
});

describe('skuInfoToMedia', () => {
  it('maps a die-cut SKU to a die-cut media descriptor with width + height', () => {
    const buf = new Uint8Array(63);
    new TextEncoder().encodeInto('30252       ', buf.subarray(8, 20));
    buf[23] = 0x01; // labelType: die
    buf[40] = 0x3d;
    buf[41] = 0x01; // labelLengthMm 317 → 31.7
    buf[42] = 0x3b;
    buf[43] = 0x02; // labelWidthMm 571 → 57.1
    const m = skuInfoToMedia(parseSkuInfo(buf));
    expect(m.id).toBe('sku-30252');
    expect(m.type).toBe('die-cut');
    expect(m.widthMm).toBe(57.1);
    expect(m.heightMm).toBe(31.7);
  });

  it('continuous SKU (labelType=0 OR labelLengthMm=0) → continuous, omits heightMm', () => {
    const buf = new Uint8Array(63);
    buf[23] = 0x00; // labelType: continuous
    buf[40] = 0;
    buf[42] = 0x30;
    buf[43] = 0x02; // labelWidthMm 560 → 56.0
    const m = skuInfoToMedia(parseSkuInfo(buf));
    expect(m.type).toBe('continuous');
    expect(m.widthMm).toBe(56);
    expect(m.heightMm).toBeUndefined();
  });
});

describe('skuInfoDetails', () => {
  function fullSku(): Uint8Array {
    const buf = new Uint8Array(63);
    buf[0] = 0xb6;
    buf[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', buf.subarray(8, 20));
    buf[22] = 0x03; // material: paper
    buf[23] = 0x01; // labelType: die
    buf[40] = 0x3d;
    buf[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    buf[42] = 0x3b;
    buf[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    buf[50] = 0x20; // totalLabelCount = 0x0120 = 288
    buf[51] = 0x01;
    buf[56] = 0x01; // counterStrategy: count-down
    new TextEncoder().encodeInto('21', buf.subarray(60, 62)); // productionDate
    return buf;
  }

  function row(rows: ReturnType<typeof skuInfoDetails>, label: string): string | undefined {
    return rows.find(r => r.label === label)?.value;
  }

  it('surfaces SKU code, material, label type, total label count, counter, prod date', () => {
    const rows = skuInfoDetails(parseSkuInfo(fullSku()));
    expect(row(rows, 'Roll SKU')).toBe('30252');
    expect(row(rows, 'Roll material')).toBe('paper');
    expect(row(rows, 'Roll label type')).toBe('die');
    expect(row(rows, 'Roll total labels')).toBe('288');
    expect(row(rows, 'Roll counter')).toBe('count-down');
    expect(row(rows, 'Roll production date')).toBe('21');
  });

  it('every roll detail row is labelled with the "Roll " prefix', () => {
    const rows = skuInfoDetails(parseSkuInfo(fullSku()));
    expect(rows.every(r => r.label.startsWith('Roll '))).toBe(true);
  });

  it('omits the total-label-count row when the SKU reports zero', () => {
    const buf = fullSku();
    buf[50] = 0;
    buf[51] = 0;
    const rows = skuInfoDetails(parseSkuInfo(buf));
    expect(rows.find(r => r.label === 'Roll total labels')).toBeUndefined();
  });
});

describe('withDetectedMedia', () => {
  function dieCutSku(): ReturnType<typeof parseSkuInfo> {
    const buf = new Uint8Array(63);
    buf[0] = 0xb6;
    buf[1] = 0xca;
    new TextEncoder().encodeInto('30252       ', buf.subarray(8, 20));
    buf[23] = 0x01; // labelType: die
    buf[40] = 0x3d;
    buf[41] = 0x01; // labelLengthMm 317 → 31.7 (deci-mm)
    buf[42] = 0x3b;
    buf[43] = 0x02; // labelWidthMm 571 → 57.1 (deci-mm)
    return parseSkuInfo(buf);
  }

  it('decorates a parsed status with detectedMedia derived from the SKU dump', () => {
    const base = {
      ready: true,
      mediaLoaded: true,
      errors: [],
      rawBytes: new Uint8Array(32),
    };
    const decorated = withDetectedMedia(base, dieCutSku());
    expect(decorated.detectedMedia).toBeDefined();
    expect(decorated.detectedMedia?.widthMm).toBe(57.1);
    expect(decorated.detectedMedia?.heightMm).toBe(31.7);
    // The other status fields pass through unchanged.
    expect(decorated.ready).toBe(true);
    expect(decorated.mediaLoaded).toBe(true);
    expect(decorated.rawBytes).toBe(base.rawBytes);
  });

  it('does not mutate the input status object', () => {
    const base = {
      ready: false,
      mediaLoaded: false,
      errors: [],
      rawBytes: new Uint8Array(0),
    };
    withDetectedMedia(base, dieCutSku());
    expect('detectedMedia' in base).toBe(false);
  });
});

describe('encode550Label — printable-area edge cases', () => {
  function withArea(printableArea: PrintableArea): DeviceEntry {
    const baseEngine = DEVICES.LW_550.engines[0]!;
    return { ...DEVICES.LW_550, engines: [{ ...baseEngine, printableArea }] };
  }

  it('bitmap shorter than the leading dead-zone collapses to a zero-row wire bitmap', () => {
    // leadingDots exceeds the bitmap height → wireRows clamps to 0 and
    // the encoder emits no raster rows (just the job framing).
    const dpi = 300;
    const leadingMm = (100 * 25.4) / dpi; // 100 dots leading
    const dev = withArea({ leading: leadingMm, trailing: 0, left: 0, right: 0 });
    const out = encode550Label(dev, createBitmap(672, 20)); // 20-row bitmap
    // No SYN/raster lines — ESC D widthLines is 0.
    const escD = findEscByte(out, 0x44);
    expect(escD).toBeDefined();
    const width =
      (out[escD! + 4]! |
        (out[escD! + 5]! << 8) |
        (out[escD! + 6]! << 16) |
        (out[escD! + 7]! << 24)) >>>
      0;
    expect(width).toBe(0);
  });

  it('zero printable-area with a head-width bitmap passes the bitmap straight through', () => {
    // Zero dead-zone on every edge + an authored bitmap exactly headDots
    // wide → the encoder's fast path returns the input bitmap unchanged
    // (no crop, no pad).
    const dev = withArea({ leading: 0, trailing: 0, left: 0, right: 0 });
    const headDots = dev.engines[0]!.headDots;
    const heightPx = 40;
    const out = encode550Label(dev, createBitmap(headDots, heightPx));
    const escD = findEscByte(out, 0x44);
    expect(escD).toBeDefined();
    const widthLines =
      (out[escD! + 4]! |
        (out[escD! + 5]! << 8) |
        (out[escD! + 6]! << 16) |
        (out[escD! + 7]! << 24)) >>>
      0;
    expect(widthLines).toBe(heightPx);
  });

  it('left-only dead-zone with a head-width label crops then pads the wire bitmap', () => {
    // `left` is non-zero so the encoder leaves the zero-area fast path
    // and runs the crop + pad pipeline. Authoring a head-width bitmap
    // keeps the surviving slice non-empty so `sourceColCount > 0`.
    const dpi = 300;
    const leftMm = (24 * 25.4) / dpi; // exactly 24 dots
    const dev = withArea({ leading: 0, trailing: 0, left: leftMm, right: 0 });
    const headDots = dev.engines[0]!.headDots;
    const heightPx = 12;
    const out = encode550Label(dev, createBitmap(headDots, heightPx));
    const escD = findEscByte(out, 0x44);
    expect(escD).toBeDefined();
    const widthLines =
      (out[escD! + 4]! |
        (out[escD! + 5]! << 8) |
        (out[escD! + 6]! << 16) |
        (out[escD! + 7]! << 24)) >>>
      0;
    // No leading/trailing skip — widthLines equals the bitmap height.
    expect(widthLines).toBe(heightPx);
  });
});

// ─── helpers ────────────────────────────────────────────────────────

function findEscByte(bytes: Uint8Array, opcode: number): number | undefined {
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x1b && bytes[i + 1] === opcode) return i;
  }
  return undefined;
}

function countEsc(bytes: Uint8Array, opcode: number): number {
  let n = 0;
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x1b && bytes[i + 1] === opcode) n++;
  }
  return n;
}
