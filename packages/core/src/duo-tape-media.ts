import type { LabelWriterTapeMedia, DuoTapeWidth } from './types.js';

/**
 * Registry of D1 tape sizes the LabelWriter Duo accepts.
 *
 * Per LW 450 Series Tech Ref Appendix B p.23: 6 / 9 / 12 / 19 / 24 mm
 * D1 cassettes. Each entry defaults to `tapeColour: 0`
 * (black-on-white/clear) — the most common cassette finish. Callers
 * with a different cassette loaded can clone an entry and override
 * `tapeColour` against the palette table on PDF p.24.
 *
 * Tape is continuous; `heightMm` is intentionally omitted.
 */
export const DUO_TAPE_MEDIA = {
  TAPE_6MM: {
    id: 'd1-tape-6',
    name: '6mm D1 tape',
    type: 'tape',
    widthMm: 6,
    tapeWidthMm: 6,
    tapeColour: 0,
  },
  TAPE_9MM: {
    id: 'd1-tape-9',
    name: '9mm D1 tape',
    type: 'tape',
    widthMm: 9,
    tapeWidthMm: 9,
    tapeColour: 0,
  },
  TAPE_12MM: {
    id: 'd1-tape-12',
    name: '12mm D1 tape',
    type: 'tape',
    widthMm: 12,
    tapeWidthMm: 12,
    tapeColour: 0,
  },
  TAPE_19MM: {
    id: 'd1-tape-19',
    name: '19mm D1 tape',
    type: 'tape',
    widthMm: 19,
    tapeWidthMm: 19,
    tapeColour: 0,
  },
  TAPE_24MM: {
    id: 'd1-tape-24',
    name: '24mm D1 tape',
    type: 'tape',
    widthMm: 24,
    tapeWidthMm: 24,
    tapeColour: 0,
  },
} as const satisfies Record<string, LabelWriterTapeMedia>;

/** Find a tape media entry by width (6/9/12/19/24 mm). */
export function findTapeMediaByWidth(widthMm: number): LabelWriterTapeMedia | undefined {
  const entries = Object.values(DUO_TAPE_MEDIA) as LabelWriterTapeMedia[];
  return entries.find(m => m.tapeWidthMm === (widthMm as DuoTapeWidth));
}
