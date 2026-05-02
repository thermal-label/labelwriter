import { describe, expect, it } from 'vitest';
import { mediaCompatibleWith } from '@thermal-label/contracts';
import {
  D1_TAPE_COLOR_HEX,
  allTapeMedia,
  findTapeMediaByWidth,
  findTapeMediaByWidthAll,
  tapeColourFor,
} from '../duo-tape-media.js';
import { MEDIA } from '../media.js';
import { DEVICES } from '../devices.js';
import type { D1TapeColor, LabelWriterTapeMedia } from '../types.js';

const ALL: readonly LabelWriterTapeMedia[] = allTapeMedia();

describe('D1 tape cassettes (MEDIA tape slice)', () => {
  it('covers every Duo-supported tape width', () => {
    const widths = new Set(ALL.map(m => m.tapeWidthMm));
    expect(widths).toEqual(new Set([6, 9, 12, 19, 24]));
  });

  it('every entry has type="tape" and widthMm === tapeWidthMm', () => {
    for (const m of ALL) {
      expect(m.type).toBe('tape');
      expect(m.widthMm).toBe(m.tapeWidthMm);
    }
  });

  it('every entry declares material, background, text, and at least one SKU', () => {
    for (const m of ALL) {
      expect(m.material, String(m.id)).toBeDefined();
      expect(m.background, String(m.id)).toBeDefined();
      expect(m.text, String(m.id)).toBeDefined();
      expect(m.skus, String(m.id)).toBeDefined();
      expect(m.skus!.length, String(m.id)).toBeGreaterThan(0);
    }
  });

  it('SKUs match Dymo D1 formats: 5-digit / 7-digit / EU S-numbers', () => {
    const re = /^\d{5}$|^\d{7}$|^S\d{7}$/;
    for (const m of ALL) {
      for (const sku of m.skus ?? []) {
        expect(re.test(sku), `${String(m.id)}: ${sku}`).toBe(true);
      }
    }
  });

  it('all ids are unique', () => {
    const ids = ALL.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('(material, background, text) is unique within a tape width', () => {
    const seen = new Map<string, string>();
    for (const m of ALL) {
      const k = `${String(m.tapeWidthMm)}:${m.material ?? ''}:${m.background ?? ''}:${m.text ?? ''}`;
      const prior = seen.get(k);
      expect(prior, `${String(m.id)} duplicates ${prior ?? ''} at ${k}`).toBeUndefined();
      seen.set(k, String(m.id));
    }
  });

  it('tapeColour matches tapeColourFor(background, text) for every entry', () => {
    for (const m of ALL) {
      expect(m.tapeColour, String(m.id)).toBe(tapeColourFor(m.background!, m.text!));
    }
  });
});

describe('tapeColourFor — LW 400 Series Tech Ref p.24 spec table', () => {
  it('matches every (background, text) pair documented in the spec', () => {
    // (background, text) → selector. Spec entries 3 (silver), 5 (gold),
    // 7 (fluorescent green), 8 (fluorescent red) are not in
    // D1TapeColor today and are omitted here.
    expect(tapeColourFor('white', 'black')).toBe(0);
    expect(tapeColourFor('clear', 'black')).toBe(0);
    expect(tapeColourFor('blue', 'black')).toBe(1);
    expect(tapeColourFor('red', 'black')).toBe(2);
    expect(tapeColourFor('yellow', 'black')).toBe(4);
    expect(tapeColourFor('green', 'black')).toBe(6);
    expect(tapeColourFor('clear', 'white')).toBe(9);
    expect(tapeColourFor('black', 'white')).toBe(10);
    expect(tapeColourFor('white', 'blue')).toBe(11);
    expect(tapeColourFor('clear', 'blue')).toBe(11);
    expect(tapeColourFor('white', 'red')).toBe(12);
    expect(tapeColourFor('clear', 'red')).toBe(12);
  });

  it('falls back to 0 for combinations outside the spec table', () => {
    // 'orange' is not in the LW 400 spec table at all — DURABLE_BLACK_ON_ORANGE_12
    // is a real cassette but the firmware has no dedicated strobe profile
    // for it; 0 is the documented safe default.
    expect(tapeColourFor('orange', 'black')).toBe(0);
    // Reverse-print combos the spec doesn't enumerate (e.g. white on red)
    // also fall back to 0.
    expect(tapeColourFor('red', 'white')).toBe(0);
  });
});

describe('Wide-tier convention (D1)', () => {
  it('every cartridge tags exactly one of "d1" or "d1-wide"', () => {
    for (const m of ALL) {
      const tags = m.targetModels ?? [];
      const d1Tags = tags.filter(t => t === 'd1' || t === 'd1-wide');
      expect(d1Tags.length, String(m.id)).toBe(1);
    }
  });

  it('6/9/12/19 mm cartridges are tagged "d1"; 24 mm is tagged "d1-wide"', () => {
    for (const m of ALL) {
      const tags = m.targetModels ?? [];
      if (m.tapeWidthMm === 24) {
        expect(tags, String(m.id)).toContain('d1-wide');
        expect(tags).not.toContain('d1');
      } else {
        expect(tags, String(m.id)).toContain('d1');
        expect(tags).not.toContain('d1-wide');
      }
    }
  });

  it('every Duo tape engine that declares "d1-wide" also declares "d1"', () => {
    for (const device of Object.values(DEVICES)) {
      for (const engine of device.engines) {
        if (engine.protocol !== 'd1-tape') continue;
        const tags = engine.mediaCompatibility ?? [];
        if (tags.includes('d1-wide')) {
          expect(tags, device.key).toContain('d1');
        }
      }
    }
  });
});

describe('mediaCompatibleWith — D1 gating', () => {
  const wideTape = DEVICES.LW_450_DUO.engines.find(e => e.protocol === 'd1-tape')!;
  const narrowTape = DEVICES.LW_DUO_96.engines.find(e => e.protocol === 'd1-tape')!;
  const tape24 = MEDIA.STANDARD_BLACK_ON_WHITE_24;
  const tape12 = MEDIA.STANDARD_BLACK_ON_WHITE_12;

  it('24 mm cartridge is incompatible with the 96-dot Duo (no d1-wide)', () => {
    expect(mediaCompatibleWith(tape24, narrowTape)).toBe(false);
  });

  it('24 mm cartridge is compatible with the 450 Duo (declares d1-wide)', () => {
    expect(mediaCompatibleWith(tape24, wideTape)).toBe(true);
  });

  it('12 mm cartridge is compatible with both Duo variants', () => {
    expect(mediaCompatibleWith(tape12, narrowTape)).toBe(true);
    expect(mediaCompatibleWith(tape12, wideTape)).toBe(true);
  });

  it('every Duo tape engine has at least one compatible cartridge', () => {
    for (const device of Object.values(DEVICES)) {
      for (const engine of device.engines) {
        if (engine.protocol !== 'd1-tape') continue;
        const matches = ALL.filter(m => mediaCompatibleWith(m, engine));
        expect(matches.length, `${device.key}/${engine.role}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('D1_TAPE_COLOR_HEX', () => {
  it('covers every value of D1TapeColor', () => {
    const colours: D1TapeColor[] = [
      'white',
      'clear',
      'yellow',
      'blue',
      'green',
      'red',
      'black',
      'orange',
    ];
    for (const c of colours) {
      expect(c in D1_TAPE_COLOR_HEX).toBe(true);
    }
  });

  it('clear is null (transparent), every other colour is a #RRGGBB hex', () => {
    expect(D1_TAPE_COLOR_HEX.clear).toBeNull();
    for (const [name, hex] of Object.entries(D1_TAPE_COLOR_HEX)) {
      if (name === 'clear') continue;
      expect(hex, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('findTapeMediaByWidth', () => {
  it('finds a 12mm entry', () => {
    const found = findTapeMediaByWidth(12);
    expect(found).toBeDefined();
    expect(found?.tapeWidthMm).toBe(12);
  });

  it('finds a 24mm entry', () => {
    const found = findTapeMediaByWidth(24);
    expect(found).toBeDefined();
    expect(found?.tapeWidthMm).toBe(24);
  });

  it('returns undefined for unsupported widths (e.g. 18mm)', () => {
    expect(findTapeMediaByWidth(18)).toBeUndefined();
  });
});

describe('findTapeMediaByWidthAll', () => {
  it('returns every catalogued 12mm variant', () => {
    const all = findTapeMediaByWidthAll(12);
    for (const m of all) expect(m.tapeWidthMm).toBe(12);
    expect(all.length).toBeGreaterThan(1);
  });

  it('returns every catalogued 24mm variant', () => {
    const all = findTapeMediaByWidthAll(24);
    for (const m of all) expect(m.tapeWidthMm).toBe(24);
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('returns an empty array for unsupported widths', () => {
    expect(findTapeMediaByWidthAll(18)).toEqual([]);
  });
});
