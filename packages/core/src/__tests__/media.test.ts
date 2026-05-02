import { describe, expect, it } from 'vitest';
import { mediaCompatibleWith } from '@thermal-label/contracts';
import type { PrintEngine } from '@thermal-label/contracts';
import { DEFAULT_MEDIA, MEDIA, findMediaByDimensions } from '../media.js';
import { DEVICES } from '../devices.js';
import type { LabelWriterMedia } from '../types.js';

// `MEDIA` carries paper rolls and D1 tape cassettes side by side
// (discriminated by `type`). The paper-focused tests in this file
// iterate the paper slice; tape coverage lives in
// `duo-tape-media.test.ts`. Cast widens the literal types so
// optional `heightMm` is reachable across die-cut/continuous
// entries; the runtime filter rules out tape.
const ALL_MEDIA: LabelWriterMedia[] = (Object.values(MEDIA) as { type: string }[]).filter(
  m => m.type !== 'tape',
) as LabelWriterMedia[];

const ALL_LW_PAPER_ENGINES: PrintEngine[] = Object.values(DEVICES).flatMap(d =>
  d.engines.filter(e => e.protocol !== 'd1-tape'),
);

describe('MEDIA registry', () => {
  it('includes the audited address / shipping / file-folder / continuous entries', () => {
    expect(MEDIA.ADDRESS_STANDARD.widthMm).toBe(28);
    expect(MEDIA.ADDRESS_STANDARD.heightMm).toBe(89);
    expect(MEDIA.SHIPPING_STANDARD.widthMm).toBe(54);
    expect(MEDIA.SHIPPING_STANDARD.heightMm).toBe(102);
    expect(MEDIA.SHIPPING_LARGE.widthMm).toBe(59);
    expect(MEDIA.SHIPPING_LARGE.heightMm).toBe(102);
    expect(MEDIA.SHIPPING_4X6.widthMm).toBe(102);
    expect(MEDIA.SHIPPING_4X6.heightMm).toBe(152);
    expect(MEDIA.FILE_FOLDER.widthMm).toBe(14);
    expect(MEDIA.FILE_FOLDER.heightMm).toBe(87);
    expect(MEDIA.CONTINUOUS_57MM.widthMm).toBe(57);
    expect((MEDIA.CONTINUOUS_57MM as LabelWriterMedia).heightMm).toBeUndefined();
  });

  it('all ids are unique', () => {
    const ids = ALL_MEDIA.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a one-to-one mapping with its registry key', () => {
    const idToKey = new Map<string, string>();
    for (const [key, entry] of Object.entries(MEDIA)) {
      expect(idToKey.has(entry.id), `duplicate id ${entry.id} on key ${key}`).toBe(false);
      idToKey.set(entry.id, key);
    }
  });

  it('DEFAULT_MEDIA is ADDRESS_STANDARD (89×28 mm)', () => {
    expect(DEFAULT_MEDIA).toBe(MEDIA.ADDRESS_STANDARD);
  });

  it('continuous entries omit heightMm; die-cut entries carry it', () => {
    for (const m of ALL_MEDIA) {
      if (m.type === 'continuous') {
        expect(m.heightMm).toBeUndefined();
      } else {
        const h = m.heightMm;
        expect(h).toBeDefined();
        expect(h).toBeGreaterThan(0);
      }
    }
  });

  it('die-cut entries with defaultOrientation: horizontal are elongated (height > width)', () => {
    for (const m of ALL_MEDIA) {
      if (m.defaultOrientation === 'horizontal') {
        expect(m.heightMm, String(m.id)).toBeDefined();
        expect(m.heightMm!, String(m.id)).toBeGreaterThan(m.widthMm);
      }
    }
  });

  it('lengthDots ≈ heightMm × 11.81 (300 dpi) for die-cut entries', () => {
    for (const m of ALL_MEDIA) {
      if (m.type !== 'die-cut') continue;
      const id = String(m.id);
      expect(m.lengthDots, id).toBeDefined();
      const expected = Math.round((m.heightMm ?? 0) * 11.81);
      expect(Math.abs((m.lengthDots ?? 0) - expected), id).toBeLessThanOrEqual(1);
    }
  });

  it('no two die-cut entries share (widthMm, heightMm)', () => {
    const seen = new Map<string, string>();
    for (const m of ALL_MEDIA) {
      if (m.type !== 'die-cut') continue;
      const key = `${String(m.widthMm)}x${String(m.heightMm)}`;
      const prior = seen.get(key);
      expect(prior, `${String(m.id)} collides with ${prior ?? ''} at ${key}`).toBeUndefined();
      seen.set(key, String(m.id));
    }
  });
});

describe('SKU coverage', () => {
  it('every catalogued entry declares at least one Dymo SKU', () => {
    for (const m of ALL_MEDIA) {
      expect(m.skus, String(m.id)).toBeDefined();
      expect(m.skus!.length, String(m.id)).toBeGreaterThan(0);
    }
  });

  it('SKUs match Dymo paper format: 5-digit legacy or 7-digit modern', () => {
    const re = /^\d{5}$|^\d{7}$/;
    for (const m of ALL_MEDIA) {
      for (const sku of m.skus ?? []) {
        expect(re.test(sku), `${String(m.id)}: ${sku}`).toBe(true);
      }
    }
  });
});

describe('Wide-tier convention', () => {
  it('every paper entry tags exactly one of "lw" or "lw-wide"', () => {
    for (const m of ALL_MEDIA) {
      const tags = m.targetModels ?? [];
      const lwTags = tags.filter(t => t === 'lw' || t === 'lw-wide');
      expect(lwTags.length, String(m.id)).toBe(1);
    }
  });

  it('every paper engine that declares "lw-wide" also declares "lw"', () => {
    for (const e of ALL_LW_PAPER_ENGINES) {
      const tags = e.mediaCompatibility ?? [];
      if (tags.includes('lw-wide')) {
        expect(tags, `${e.protocol}/${e.role}`).toContain('lw');
      }
    }
  });

  it('every paper engine declares "lw" (catches missing mediaCompatibility)', () => {
    for (const e of ALL_LW_PAPER_ENGINES) {
      const tags = e.mediaCompatibility ?? [];
      expect(tags, `${e.protocol}/${e.role}`).toContain('lw');
    }
  });
});

describe('mediaCompatibleWith — paper gating', () => {
  const narrowEngine = DEVICES.LW_450.engines[0]!;
  const wideEngine = DEVICES.LW_5XL.engines[0]!;

  it('SHIPPING_4X6 (lw-wide) is incompatible with a narrow LW engine', () => {
    expect(mediaCompatibleWith(MEDIA.SHIPPING_4X6, narrowEngine)).toBe(false);
  });

  it('SHIPPING_4X6 (lw-wide) is compatible with the LW 5XL', () => {
    expect(mediaCompatibleWith(MEDIA.SHIPPING_4X6, wideEngine)).toBe(true);
  });

  it('ADDRESS_STANDARD (lw) is compatible with both narrow and wide', () => {
    expect(mediaCompatibleWith(MEDIA.ADDRESS_STANDARD, narrowEngine)).toBe(true);
    expect(mediaCompatibleWith(MEDIA.ADDRESS_STANDARD, wideEngine)).toBe(true);
  });

  it('every device in the registry has at least one compatible paper entry', () => {
    for (const device of Object.values(DEVICES)) {
      for (const engine of device.engines) {
        if (engine.protocol === 'd1-tape') continue;
        const matches = ALL_MEDIA.filter(m => mediaCompatibleWith(m, engine));
        expect(matches.length, `${device.key}/${engine.role}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('findMediaByDimensions', () => {
  it('resolves 89×28 mm to ADDRESS_STANDARD', () => {
    const media = findMediaByDimensions(28, 89);
    expect(media).toBe(MEDIA.ADDRESS_STANDARD);
  });

  it('resolves 89×36 mm to ADDRESS_LARGE', () => {
    const media = findMediaByDimensions(36, 89);
    expect(media).toBe(MEDIA.ADDRESS_LARGE);
  });

  it('resolves 102×54 mm to SHIPPING_STANDARD (audit-corrected)', () => {
    expect(findMediaByDimensions(54, 102)).toBe(MEDIA.SHIPPING_STANDARD);
  });

  it('resolves 102×59 mm to SHIPPING_LARGE (audit-corrected)', () => {
    expect(findMediaByDimensions(59, 102)).toBe(MEDIA.SHIPPING_LARGE);
  });

  it('resolves 152×102 mm to SHIPPING_4X6 (the key 5XL field-test entry)', () => {
    expect(findMediaByDimensions(102, 152)).toBe(MEDIA.SHIPPING_4X6);
  });

  it('resolves 87×14 mm to FILE_FOLDER (audit-corrected)', () => {
    expect(findMediaByDimensions(14, 87)).toBe(MEDIA.FILE_FOLDER);
  });

  it('resolves 57×0 mm (continuous) to CONTINUOUS_57MM (audit-corrected)', () => {
    expect(findMediaByDimensions(57, 0)).toBe(MEDIA.CONTINUOUS_57MM);
  });

  it('returns undefined for sizes outside the registry', () => {
    expect(findMediaByDimensions(123, 456)).toBeUndefined();
  });

  it('round-trips every die-cut entry by its (widthMm, heightMm)', () => {
    for (const m of ALL_MEDIA) {
      if (m.type !== 'die-cut') continue;
      expect(findMediaByDimensions(m.widthMm, m.heightMm!), String(m.id)).toBe(m);
    }
  });
});
