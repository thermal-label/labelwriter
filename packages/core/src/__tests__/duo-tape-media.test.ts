import { describe, expect, it } from 'vitest';
import {
  D1_TAPE_COLOR_HEX,
  allTapeMedia,
  findTapeMediaByWidth,
  findTapeMediaByWidthAll,
} from '../duo-tape-media.js';
import { MEDIA } from '../media.generated.js';

/**
 * UI-side D1 tape catalogue helpers. The unified `MEDIA` registry holds
 * paper rolls and D1 tape cassettes side by side (discriminated by
 * `type`); these helpers expose just the tape slice for preview swatches
 * and width-keyed dropdowns. The paper slice is covered in `media.test.ts`.
 */

describe('D1_TAPE_COLOR_HEX', () => {
  it('maps every symbolic D1 colour to a hex string, with clear as null', () => {
    // `clear` renders as a checkerboard / surface colour — it has no hex.
    expect(D1_TAPE_COLOR_HEX.clear).toBeNull();
    for (const [colour, hex] of Object.entries(D1_TAPE_COLOR_HEX)) {
      if (colour === 'clear') continue;
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('covers the full D1TapeColor union (12 symbolic colours)', () => {
    expect(Object.keys(D1_TAPE_COLOR_HEX).sort()).toEqual(
      [
        'black',
        'blue',
        'brown',
        'clear',
        'green',
        'grey',
        'metallic',
        'orange',
        'purple',
        'red',
        'white',
        'yellow',
      ].sort(),
    );
  });
});

describe('allTapeMedia', () => {
  it('returns only catalogue entries of type "tape"', () => {
    const tape = allTapeMedia();
    expect(tape.length).toBeGreaterThan(0);
    for (const m of tape) {
      expect(m.type).toBe('tape');
    }
  });

  it('excludes the paper-roll slice of the registry', () => {
    const tape = allTapeMedia();
    const paperCount = (Object.values(MEDIA) as { type: string }[]).filter(
      m => m.type !== 'tape',
    ).length;
    expect(tape.length).toBe(Object.values(MEDIA).length - paperCount);
  });

  it('every tape entry carries a DuoTapeWidth-shaped tapeWidthMm', () => {
    for (const m of allTapeMedia()) {
      expect([6, 9, 12, 19, 24]).toContain(m.tapeWidthMm);
    }
  });
});

describe('findTapeMediaByWidth', () => {
  it('returns a tape cassette at each catalogued width', () => {
    for (const width of [6, 9, 12, 19, 24]) {
      const found = findTapeMediaByWidth(width);
      expect(found).toBeDefined();
      expect(found?.type).toBe('tape');
      expect(found?.tapeWidthMm).toBe(width);
    }
  });

  it('returns the first catalogued variant at the queried width', () => {
    const first = findTapeMediaByWidth(12);
    const all = findTapeMediaByWidthAll(12);
    expect(first).toBe(all[0]);
  });

  it('returns undefined for a width with no catalogued cassette', () => {
    // 7 mm is not a real D1 tape width — no cassette matches.
    expect(findTapeMediaByWidth(7)).toBeUndefined();
  });
});

describe('findTapeMediaByWidthAll', () => {
  it('returns every catalogued variant at a given width', () => {
    const variants = findTapeMediaByWidthAll(12);
    expect(variants.length).toBeGreaterThan(1);
    for (const m of variants) {
      expect(m.tapeWidthMm).toBe(12);
      expect(m.type).toBe('tape');
    }
  });

  it('returns an empty array when no cassette matches the width', () => {
    expect(findTapeMediaByWidthAll(7)).toEqual([]);
  });

  it('partitions allTapeMedia() exactly across the five catalogued widths', () => {
    const total = [6, 9, 12, 19, 24].reduce((sum, w) => sum + findTapeMediaByWidthAll(w).length, 0);
    expect(total).toBe(allTapeMedia().length);
  });
});
