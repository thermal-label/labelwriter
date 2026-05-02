import { describe, expect, it } from 'vitest';
import { DUO_TAPE_MEDIA, findTapeMediaByWidth } from '../duo-tape-media.js';

describe('DUO_TAPE_MEDIA', () => {
  it('exposes the five Duo-supported tape widths', () => {
    const widths = Object.values(DUO_TAPE_MEDIA)
      .map(m => m.tapeWidthMm)
      .sort((a, b) => a - b);
    expect(widths).toEqual([6, 9, 12, 19, 24]);
  });

  it('every entry has type="tape" and tapeColour=0 by default', () => {
    for (const m of Object.values(DUO_TAPE_MEDIA)) {
      expect(m.type).toBe('tape');
      expect(m.tapeColour).toBe(0);
    }
  });

  it('widthMm matches tapeWidthMm', () => {
    for (const m of Object.values(DUO_TAPE_MEDIA)) {
      expect(m.widthMm).toBe(m.tapeWidthMm);
    }
  });
});

describe('findTapeMediaByWidth', () => {
  it('finds the 12mm entry', () => {
    const found = findTapeMediaByWidth(12);
    expect(found?.id).toBe('d1-tape-12');
  });

  it('finds the 24mm entry', () => {
    const found = findTapeMediaByWidth(24);
    expect(found?.id).toBe('d1-tape-24');
  });

  it('returns undefined for unsupported widths (e.g. 18mm)', () => {
    expect(findTapeMediaByWidth(18)).toBeUndefined();
  });
});
