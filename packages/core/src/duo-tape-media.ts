import type { D1TapeColor, DuoTapeWidth, LabelWriterTapeMedia } from './types.js';
import { MEDIA } from './_generated/media.js';

/**
 * Symbolic-colour → wire-format ESC C selector.
 *
 * Per `LabelWriter 400 Series Technical Reference Manual` p.24 the
 * byte sets the heat sensitivity / strobe profile for the loaded
 * tape — it identifies what cassette is loaded so the firmware can
 * pick the right thermal-energy curve; it does not change the
 * printed ink. Sending `0` for an unenumerated combination is safe
 * (the cassette's actual ink prints either way), but the matching
 * spec value gives correct calibration and noticeably better print
 * quality on coloured / reverse-print substrates.
 *
 * Spec table (LW 400 Series Tech Ref p.24):
 *
 *   0  Black on white or clear        7  Black on fluorescent green*
 *   1  Black on blue                  8  Black on fluorescent red*
 *   2  Black on red                   9  White on clear
 *   3  Black on silver*              10  White on black
 *   4  Black on yellow               11  Blue on white or clear
 *   5  Black on gold*                12  Red on white or clear
 *   6  Black on green
 *
 *   * — substrate variants not represented in `D1TapeColor` (no
 *       catalogued cassettes use silver, gold, fluorescent-green,
 *       or fluorescent-red today). Add the symbol to `D1TapeColor`
 *       and a branch here in the same change if a cassette ever
 *       declares one.
 *
 * Verified against real hardware (per existing `duo-tape.ts` JSDoc
 * + integration tests): selectors 0, 1, 7, 12. The remaining
 * selectors are spec-derived from the table above; safe to send and
 * expected to give correct heat calibration.
 *
 * Source-of-truth for this mapping. `scripts/compile-data.mjs`
 * mirrors the table to bake `tapeColour` into D1 entries at
 * compile time; keep them in sync.
 */
export function tapeColourFor(background: D1TapeColor, text: D1TapeColor): number {
  if (text === 'black') {
    if (background === 'white' || background === 'clear') return 0;
    if (background === 'blue') return 1;
    if (background === 'red') return 2;
    if (background === 'yellow') return 4;
    if (background === 'green') return 6;
    return 0;
  }
  if (text === 'white') {
    if (background === 'clear') return 9;
    if (background === 'black') return 10;
    return 0;
  }
  if (background === 'white' || background === 'clear') {
    if (text === 'blue') return 11;
    if (text === 'red') return 12;
  }
  return 0;
}

/**
 * Canonical Dymo-brand hex values for `D1TapeColor`. UI consumers
 * map symbolic colours through this table to render preview swatches;
 * `clear` is `null` (render as a checkerboard or surface colour).
 *
 * Approximated from the swatches in `dymo-labels-lm.pdf`; swap in
 * authoritative brand values if Dymo's design team publishes them.
 */
export const D1_TAPE_COLOR_HEX: Record<D1TapeColor, string | null> = {
  white: '#FFFFFF',
  clear: null,
  yellow: '#FFD800',
  blue: '#2680BD',
  green: '#00A651',
  red: '#E30613',
  black: '#000000',
  orange: '#F39200',
};

function isTape(m: { type: string }): m is LabelWriterTapeMedia {
  return m.type === 'tape';
}

/**
 * Every catalogued D1 cassette in the unified `MEDIA` registry.
 *
 * Convenience for callers that want just the tape slice — the
 * registry holds paper rolls and tape cassettes side by side
 * (discriminated by `type`).
 */
export function allTapeMedia(): readonly LabelWriterTapeMedia[] {
  return (Object.values(MEDIA) as { type: string }[]).filter(isTape);
}

/**
 * Find the lowest-numbered cartridge variant at a given tape width.
 *
 * For UIs that just want "any 12 mm tape" — typically returns the
 * Standard Black on White variant. Use `findTapeMediaByWidthAll()`
 * when the caller needs every variant.
 */
export function findTapeMediaByWidth(widthMm: number): LabelWriterTapeMedia | undefined {
  return allTapeMedia().find(m => m.tapeWidthMm === (widthMm as DuoTapeWidth));
}

/**
 * Find every catalogued cartridge variant at a given tape width.
 *
 * For UI dropdowns that surface colour/material variants. Returns an
 * empty array when no entry matches.
 */
export function findTapeMediaByWidthAll(widthMm: number): readonly LabelWriterTapeMedia[] {
  return allTapeMedia().filter(m => m.tapeWidthMm === (widthMm as DuoTapeWidth));
}
