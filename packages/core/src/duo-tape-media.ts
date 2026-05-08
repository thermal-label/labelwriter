import type { D1TapeColor, DuoTapeWidth, LabelWriterTapeMedia } from './types.js';
import { MEDIA } from './media.generated.js';

/**
 * UI helpers for the D1 tape catalogue. The wire-format `ESC C`
 * selector is sourced from `tapeTypeFor()` in `@thermal-label/d1-core`
 * (or, for catalogued entries, the pre-computed `tapeColour` field
 * baked in by `scripts/compile-data.mjs`); this module only exposes
 * UI-side helpers (preview swatches, width-keyed lookups).
 */

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
