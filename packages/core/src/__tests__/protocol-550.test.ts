import { describe, expect, it } from 'vitest';
import { createBitmap } from '@mbtech-nl/bitmap';
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
  encode550Label,
  parseEngineVersion,
  parseSkuInfo,
  skuInfoToMedia,
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

  it('build550LabelIndex: ESC n + u32LE index', () => {
    expect(Array.from(build550LabelIndex(0))).toEqual([0x1b, 0x6e, 0, 0, 0, 0]);
    expect(Array.from(build550LabelIndex(0x01020304))).toEqual([
      0x1b, 0x6e, 0x04, 0x03, 0x02, 0x01,
    ]);
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
  const lw550 = DEVICES.LW_550;
  const lw5xl = DEVICES.LW_5XL;

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
    // Skip 6 bytes of ESC n
    i += 6;
    expect(out[i]).toBe(0x1b);
    expect(out[i + 1]).toBe(0x44);
    // BPP=1, align=2, width=8, height=672
    expect(out[i + 2]).toBe(1);
    expect(out[i + 3]).toBe(2);
    expect(out[i + 4]).toBe(8);
  });

  it('raster block has no SYN/ETB framing — pure header + data', () => {
    const out = encode550Label(lw550, bm(672, 4));
    // 11 (job header) + 6 (ESC n) + 12 (ESC D) = 29 bytes preamble
    // Followed by 4 raster lines × 84 bytes = 336 bytes of pure data
    // Then ESC E + ESC Q = 4 bytes trailer
    expect(out.length).toBe(29 + 4 * 84 + 2 + 2);
    // The data block must not contain any SYN (0x16) framing —
    // verify the first raster byte is NOT preceded by 0x16
    const firstDataByte = 29;
    // Just confirm length math holds
    expect(out[firstDataByte]).toBe(0); // empty bitmap → all-zero rows
  });

  it('emits ESC G between copies and ESC E for the last copy', () => {
    const out = encode550Label(lw550, bm(672, 4), { copies: 3 });
    // Find all label trailers
    const escGCount = countEsc(out, 0x47);
    const escECount = countEsc(out, 0x45);
    expect(escGCount).toBe(2); // between copy 1→2 and 2→3
    expect(escECount).toBe(1); // after copy 3
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
    // Find all ESC n occurrences
    const indices: number[] = [];
    for (let i = 0; i < out.length - 5; i++) {
      if (out[i] === 0x1b && out[i + 1] === 0x6e) {
        indices.push(
          (out[i + 2]! | (out[i + 3]! << 8) | (out[i + 4]! << 16) | (out[i + 5]! << 24)) >>> 0,
        );
      }
    }
    expect(indices).toEqual([0, 1, 2]);
  });

  it('throws when the device has no lw-550 engine', () => {
    expect(() => encode550Label(DEVICES.LW_450, bm(672, 4))).toThrow(/lw-550/);
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
});

describe('encodeLabel dispatch', () => {
  it('routes lw-550 engines to encode550Label (no ESC @ reset, ends with ESC Q)', async () => {
    const { encodeLabel } = await import('../protocol.js');
    const out = encodeLabel(DEVICES.LW_550, createBitmap(672, 4));
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
    // labelLengthMm at 40-41, labelWidthMm at 42-43
    buf[40] = 89;
    buf[41] = 0;
    buf[42] = 28;
    buf[43] = 0;
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

  it('decodes label dimensions from u16-LE bytes 40-43', () => {
    const sku = parseSkuInfo(makeSku());
    expect(sku.labelLengthMm).toBe(89);
    expect(sku.labelWidthMm).toBe(28);
  });

  it('falls back to "unknown" for out-of-range enum bytes', () => {
    const buf = makeSku();
    buf[20] = 0xff; // brand
    buf[22] = 0xff; // material
    const sku = parseSkuInfo(buf);
    expect(sku.brand).toBe('unknown');
    expect(sku.material).toBe('unknown');
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
    buf[40] = 89;
    buf[42] = 28;
    const m = skuInfoToMedia(parseSkuInfo(buf));
    expect(m.id).toBe('sku-30252');
    expect(m.type).toBe('die-cut');
    expect(m.widthMm).toBe(28);
    expect(m.heightMm).toBe(89);
  });

  it('continuous SKU (labelType=0 OR labelLengthMm=0) → continuous, omits heightMm', () => {
    const buf = new Uint8Array(63);
    buf[23] = 0x00; // labelType: continuous
    buf[40] = 0;
    buf[42] = 56;
    const m = skuInfoToMedia(parseSkuInfo(buf));
    expect(m.type).toBe('continuous');
    expect(m.widthMm).toBe(56);
    expect(m.heightMm).toBeUndefined();
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
