import type { LabelWriterMedia } from './types.js';
import { MEDIA, type MediaKey } from './media.generated.js';

export { MEDIA, type MediaKey };

/**
 * Fallback media used when `createPreview()` is called without explicit
 * media and without a detected roll (LabelWriter 450) or with an
 * unknown roll (LabelWriter 550). Chosen as the most common address
 * label in the catalogue.
 */
export const DEFAULT_MEDIA: LabelWriterMedia = MEDIA.ADDRESS_STANDARD;

/**
 * Match a 550-series status response against the paper portion of the
 * media registry.
 *
 * The status response carries paper roll dimensions in mm — a simple
 * filter is enough. Tape cassettes (`type: 'tape'`) are excluded since
 * the 550 doesn't have a tape head. Returns undefined for sizes
 * outside the registry; callers can still surface `rawBytes` for
 * unknown-roll diagnostics.
 */
export function findMediaByDimensions(
  widthMm: number,
  heightMm: number,
): LabelWriterMedia | undefined {
  for (const m of Object.values(MEDIA)) {
    if (m.type === 'tape') continue;
    const lwm = m as LabelWriterMedia;
    if (lwm.widthMm === widthMm && (lwm.heightMm ?? 0) === heightMm) {
      return lwm;
    }
  }
  return undefined;
}
