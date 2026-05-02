import type { D1TapeColor, DuoTapeWidth, LabelWriterTapeMedia } from './types.js';
import { MEDIA } from './_generated/media.js';

/**
 * Symbolic-colour → wire-format ESC C selector.
 *
 * Per `LW 450 Series Tech Ref` p.24 the byte selects a strobe
 * profile, not the ink itself ("the byte identifies what cassette is
 * loaded so the firmware can pick the right strobe profile; it does
 * not change the printed ink"). Returning `0` for any combination
 * not enumerated below is safe — the firmware prints the cassette's
 * actual ink either way; the strobe profile is a thermal-energy
 * tweak the host can guess wrong without breaking output.
 *
 * Verified mappings (from `duo-tape.ts` JSDoc + tests):
 *   - black on white/clear → 0
 *   - black on blue → 1
 *   - black on fluorescent green → 7
 *   - red on white → 12
 *
 * Unenumerated combinations fall back to 0.
 *
 * Source-of-truth for this mapping. `scripts/compile-data.mjs`
 * mirrors the table to bake `tapeColour` into D1 entries at
 * compile time; keep them in sync.
 */
export function tapeColourFor(background: D1TapeColor, text: D1TapeColor): number {
  if (text === 'black' && (background === 'white' || background === 'clear')) return 0;
  if (text === 'black' && background === 'blue') return 1;
  if (text === 'red' && background === 'white') return 12;
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
