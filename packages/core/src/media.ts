/* eslint-disable import-x/consistent-type-specifier-style */
import type { LabelWriterMedia } from './types.js';

/**
 * Registry of common LabelWriter consumables.
 *
 * Dimensions come from the Dymo media catalogue (300 DPI print engine,
 * 11.81 dots per mm). Length in dots is kept alongside `heightMm` so
 * the 550-series status parser can round-trip its dot-based response
 * to a friendly mm descriptor.
 *
 * Not exhaustive — this covers the sizes Dymo ships in the US/EU retail
 * channels. Consumers that need a custom size can construct a
 * `LabelWriterMedia` on the fly.
 */
export const MEDIA = {
  ADDRESS_STANDARD: {
    id: 'address-standard',
    name: '89×28mm Address',
    widthMm: 28,
    heightMm: 89,
    type: 'die-cut',
    colorCapable: false,
    lengthDots: 1050,
  },
  ADDRESS_LARGE: {
    id: 'address-large',
    name: '89×36mm Large Address',
    widthMm: 36,
    heightMm: 89,
    type: 'die-cut',
    colorCapable: false,
    lengthDots: 1050,
  },
  SHIPPING_STANDARD: {
    id: 'shipping-standard',
    name: '102×59mm Shipping',
    widthMm: 59,
    heightMm: 102,
    type: 'die-cut',
    colorCapable: false,
    lengthDots: 1200,
  },
  SHIPPING_LARGE: {
    id: 'shipping-large',
    name: '102×159mm Large Shipping',
    widthMm: 102,
    heightMm: 159,
    type: 'die-cut',
    colorCapable: false,
    lengthDots: 1878,
  },
  FILE_FOLDER: {
    id: 'file-folder',
    name: '19×87mm File Folder',
    widthMm: 19,
    heightMm: 87,
    type: 'die-cut',
    colorCapable: false,
    lengthDots: 1027,
  },
  CONTINUOUS_56MM: {
    id: 'continuous-56',
    name: '56mm Continuous',
    widthMm: 56,
    type: 'continuous',
    colorCapable: false,
  },
} as const satisfies Record<string, LabelWriterMedia>;

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
