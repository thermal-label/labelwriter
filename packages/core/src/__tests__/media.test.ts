/* eslint-disable import-x/consistent-type-specifier-style */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MEDIA, MEDIA, findMediaByDimensions } from '../media.js';
import type { LabelWriterMedia } from '../types.js';

// Object.values returns a union over literal types from the `as const`
// registry, which loses the `heightMm?` field on continuous entries.
// Widen to the base type when iterating/inspecting the values.
const ALL_MEDIA: LabelWriterMedia[] = Object.values(MEDIA);

describe('MEDIA registry', () => {
  it('includes the common address / shipping / file-folder / continuous entries', () => {
    expect(MEDIA.ADDRESS_STANDARD.widthMm).toBe(28);
    expect(MEDIA.ADDRESS_STANDARD.heightMm).toBe(89);
    expect(MEDIA.SHIPPING_STANDARD.widthMm).toBe(59);
    expect(MEDIA.FILE_FOLDER.heightMm).toBe(87);
    expect((MEDIA.CONTINUOUS_56MM as LabelWriterMedia).heightMm).toBeUndefined();
  });

  it('all ids are unique', () => {
    const ids = ALL_MEDIA.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('DEFAULT_MEDIA is ADDRESS_STANDARD (89×28 mm)', () => {
    expect(DEFAULT_MEDIA).toBe(MEDIA.ADDRESS_STANDARD);
  });

  it('every entry declares colorCapable: false — LabelWriter is single-colour', () => {
    for (const m of ALL_MEDIA) {
      expect(m.colorCapable).toBe(false);
    }
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

  it('resolves 56×0 mm (continuous) to CONTINUOUS_56MM', () => {
    const media = findMediaByDimensions(56, 0);
    expect(media).toBe(MEDIA.CONTINUOUS_56MM);
  });

  it('returns undefined for sizes outside the registry', () => {
    expect(findMediaByDimensions(123, 456)).toBeUndefined();
  });
});
