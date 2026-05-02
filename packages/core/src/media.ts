import type { LabelWriterMedia } from './types.js';
import { MEDIA, type MediaKey } from './_generated/media.js';

export { MEDIA, type MediaKey };

/**
 * Fallback media used when `createPreview()` is called without explicit
 * media and without a detected roll (LabelWriter 450) or with an
 * unknown roll (LabelWriter 550). Chosen as the most common address
 * label in the catalogue.
 */
export const DEFAULT_MEDIA: LabelWriterMedia = MEDIA.ADDRESS_STANDARD;

/**
 * Match a 550-series status response against the media registry.
 *
 * The response carries media dimensions in mm — a simple filter over
 * `MEDIA` is enough. Returns undefined for sizes outside the registry;
 * callers can still surface `rawBytes` for unknown roll diagnostics.
 */
export function findMediaByDimensions(
  widthMm: number,
  heightMm: number,
): LabelWriterMedia | undefined {
  const entries = Object.values(MEDIA) as LabelWriterMedia[];
  return entries.find(m => m.widthMm === widthMm && (m.heightMm ?? 0) === heightMm);
}
