import { renderImage, type RawImageData } from '@mbtech-nl/bitmap';
import type { PreviewResult } from '@thermal-label/contracts';
import type { LabelWriterMedia } from './types.js';

/**
 * Offline preview without a live printer connection.
 *
 * LabelWriter is single-colour, so the result is always a single black
 * plane. Callers that need the preview to match the exact 300-DPI head
 * geometry are responsible for scaling; this function just renders the
 * RGBA with the same Atkinson dither used by `print()`.
 */
export function createPreviewOffline(image: RawImageData, media: LabelWriterMedia): PreviewResult {
  const bitmap = renderImage(image, { dither: true });
  return {
    planes: [{ name: 'black', bitmap, displayColor: '#000000' }],
    media,
    assumed: false,
  };
}
