// Helper for callers (harness, drivers, designers) that need to size
// an authoring canvas to match what the head can physically print.
//
// The LabelWriter chassis parks the head a few mm past the label's
// leading edge after a form-feed; that band is mechanically
// unreachable. Authoring at the *full* label size and trusting the
// encoder to make it fit silently lost content (top-cropped or
// bottom-overrun, depending on the encoder version). The fix is to
// expose the dead zone here and have the authoring layer subtract it
// from the canvas before drawing — every authored dot is then a dot
// the head can reach.
//
// This module is the dot-space sibling of `getPrintableArea` (which
// returns mm). One place owns the mm→dot rounding so callers don't
// drift on rounding decisions.

import type { MediaDescriptor, PrintEngine } from '@thermal-label/contracts';
import { getPrintableArea } from '@thermal-label/contracts';

export interface PrintableCanvasDots {
  /**
   * Cross-feed dimension the authored bitmap should use. Equals
   * `engine.headDots − leftDots − rightDots`. With today's all-zero
   * `left`/`right` values across LW devices this is just `headDots`.
   */
  widthDots: number;
  /**
   * Feed-direction dots the authoring layer must subtract from the
   * label's physical length to get the printable height. With LW 3xx
   * /4xx/5xx engines this is `Math.round(6 mm * dpi / 25.4)` — 71 dots
   * at 300 dpi.
   */
  leadingDots: number;
  /**
   * Trailing-edge dead zone in feed direction. `0` everywhere on LW
   * today (the head reaches the trailing edge); plumbed through for
   * symmetry and future-proofing.
   */
  trailingDots: number;
  /** Left-edge cross-feed dead zone. `0` everywhere on LW today. */
  leftDots: number;
  /** Right-edge cross-feed dead zone. `0` everywhere on LW today. */
  rightDots: number;
}

/** Round mm to whole dots at the given DPI. */
function mmToDots(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Resolve the printable-canvas deductions for a given engine + media,
 * in dot space. Callers compose their authored bitmap at
 * `widthDots × (mediaLengthDots − leadingDots − trailingDots)` for
 * die-cut media (or any user-chosen height for continuous, minus the
 * dead zones).
 *
 * The encoder no longer reads these values — they are the authoring
 * layer's responsibility. When a caller authors a bitmap shorter than
 * the actual label length, it must also pass
 * `options.labelLengthDots = media.lengthDots` to `encodeLabel` so the
 * printer's form-feed pitch is correct.
 */
export function getPrintableCanvasDots(
  engine: PrintEngine,
  media?: MediaDescriptor,
): PrintableCanvasDots {
  const area = getPrintableArea(engine, media);
  const dpi = engine.dpi;
  const leadingDots = mmToDots(area.leading, dpi);
  const trailingDots = mmToDots(area.trailing, dpi);
  const leftDots = mmToDots(area.left, dpi);
  const rightDots = mmToDots(area.right, dpi);
  const widthDots = Math.max(0, engine.headDots - leftDots - rightDots);
  return { widthDots, leadingDots, trailingDots, leftDots, rightDots };
}
