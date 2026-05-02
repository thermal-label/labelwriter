import type { LabelWriterMedia } from './types.js';

/**
 * Registry of Dymo LabelWriter consumables.
 *
 * Sourced from the official Dymo per-printer compatibility matrix
 * (`dymo-labels-lw.pdf`, archived at the repo root). One entry per
 * physical (widthMm × heightMm) — regional / durable / count-per-roll
 * SKU variants of the same physical product collapse onto one entry
 * via the `skus` array.
 *
 * Dimensions assume the 300-dpi print engine (11.81 dots per mm);
 * `lengthDots = round(heightMm * 11.81)` is kept on each die-cut
 * entry so the 550-series status parser can round-trip its dot-based
 * response to a friendly mm descriptor.
 *
 * Rectangular die-cut entries declare `defaultOrientation: 'horizontal'`
 * — users author landscape (long axis horizontal as you read it), and
 * the driver auto-rotates 90° CW so the visual reads along the tape
 * feed direction. Pre-retrofit, landscape input was silently cropped
 * to head width; the auto-rotate path fixes that.
 *
 * Every paper entry carries `targetModels: ['lw']` (fits any LW paper
 * engine) except wide-only rolls, which carry `['lw-wide']` and only
 * match engines that declare the wide tier (LW 4XL / 5XL).
 *
 * `printMargins` is a design-tool hint (~1.5 mm shipping label inset
 * per the Dymo spec). `cornerRadiusMm` is informational; previews use
 * it to render the actual paper outline.
 */

const MARGINS_1_5 = { leftMm: 1.5, rightMm: 1.5, topMm: 1.5, bottomMm: 1.5 } as const;

export const MEDIA = {
  // ─── address ────────────────────────────────────────────────────
  RETURN_ADDRESS: {
    id: 'return-address',
    name: '19×51mm Return Address',
    category: 'address',
    widthMm: 19,
    heightMm: 51,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 602,
    skus: ['30330', '30578'],
    targetModels: ['lw'],
  },
  ADDRESS_STANDARD: {
    id: 'address-standard',
    name: '89×28mm Address',
    category: 'address',
    widthMm: 28,
    heightMm: 89,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1051,
    skus: ['30251', '30252', '30254', '30320', '30340'],
    targetModels: ['lw'],
  },
  ADDRESS_LARGE: {
    id: 'address-large',
    name: '89×36mm Large Address',
    category: 'address',
    widthMm: 36,
    heightMm: 89,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1051,
    skus: ['30321'],
    targetModels: ['lw'],
  },

  // ─── shipping ───────────────────────────────────────────────────
  SHIPPING_STANDARD: {
    id: 'shipping-standard',
    name: '102×54mm Shipping',
    category: 'shipping',
    widthMm: 54,
    heightMm: 102,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1205,
    skus: ['30323'],
    targetModels: ['lw'],
  },
  SHIPPING_LARGE: {
    id: 'shipping-large',
    name: '102×59mm Large Shipping',
    category: 'shipping',
    widthMm: 59,
    heightMm: 102,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1205,
    skus: ['30256', '1763982', '1933088'],
    targetModels: ['lw'],
  },
  SHIPPING_4X6: {
    id: 'shipping-4x6',
    name: '152×102mm Extra Large Shipping (4×6)',
    category: 'shipping',
    widthMm: 102,
    heightMm: 152,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1795,
    skus: ['1744907', '1933086'],
    targetModels: ['lw-wide'],
  },
  LEVER_ARCH: {
    // Listed under both "Large Lever Arch (Durable)" and
    // "Confirmation (Durable)" in the LW PDF — same physical SKU.
    id: 'lever-arch',
    name: '190×59mm Lever Arch / Confirmation',
    category: 'shipping',
    widthMm: 59,
    heightMm: 190,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 2244,
    skus: ['1933087'],
    targetModels: ['lw'],
  },

  // ─── file-folder ────────────────────────────────────────────────
  FILE_FOLDER: {
    id: 'file-folder',
    name: '87×14mm File Folder',
    category: 'file-folder',
    widthMm: 14,
    heightMm: 87,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1027,
    skus: ['30327'],
    targetModels: ['lw'],
  },

  // ─── multi-purpose ──────────────────────────────────────────────
  MULTI_PURPOSE_EXTRA_SMALL: {
    id: 'multi-purpose-extra-small',
    name: '25×13mm Extra Small (2-up)',
    category: 'multi-purpose',
    widthMm: 13,
    heightMm: 25,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 295,
    skus: ['30333'],
    targetModels: ['lw'],
  },
  MULTI_PURPOSE_SQUARE: {
    id: 'multi-purpose-square',
    name: '25×25mm Square',
    category: 'multi-purpose',
    widthMm: 25,
    heightMm: 25,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 295,
    skus: ['30332', '1933083'],
    targetModels: ['lw'],
  },
  MULTI_PURPOSE_SMALL: {
    id: 'multi-purpose-small',
    name: '54×25mm Small',
    category: 'multi-purpose',
    widthMm: 25,
    heightMm: 54,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 638,
    skus: ['30336', '1976411'],
    targetModels: ['lw'],
  },
  MULTI_PURPOSE_MEDIUM: {
    id: 'multi-purpose-medium',
    name: '57×32mm Medium',
    category: 'multi-purpose',
    widthMm: 32,
    heightMm: 57,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 673,
    skus: ['30334', '1933084'],
    targetModels: ['lw'],
  },
  MULTI_PURPOSE_LARGE: {
    id: 'multi-purpose-large',
    name: '70×54mm Large',
    category: 'multi-purpose',
    widthMm: 54,
    heightMm: 70,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 827,
    skus: ['30324'],
    targetModels: ['lw'],
  },
  MULTI_PURPOSE_VIDEO_TOP: {
    id: 'multi-purpose-video-top',
    name: '79×46mm Video Top',
    category: 'multi-purpose',
    widthMm: 46,
    heightMm: 79,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 933,
    skus: ['30326'],
    targetModels: ['lw'],
  },
  REMOVABLE: {
    id: 'removable',
    name: '59×51mm Removable',
    category: 'multi-purpose',
    widthMm: 51,
    heightMm: 59,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 697,
    skus: ['30370'],
    targetModels: ['lw'],
  },
  SHELVING: {
    id: 'shelving',
    name: '89×25mm Shelving',
    category: 'multi-purpose',
    widthMm: 25,
    heightMm: 89,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1051,
    skus: ['1933081'],
    targetModels: ['lw'],
  },
  APPOINTMENT_CARD: {
    id: 'appointment-card',
    name: '89×51mm Appointment / Business Card',
    category: 'multi-purpose',
    widthMm: 51,
    heightMm: 89,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1051,
    skus: ['30374'],
    targetModels: ['lw'],
  },
  BOOK_SPINE: {
    id: 'book-spine',
    name: '38×25mm Book Spine',
    category: 'multi-purpose',
    widthMm: 25,
    heightMm: 38,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 449,
    skus: ['30347'],
    targetModels: ['lw'],
  },

  // ─── barcode ────────────────────────────────────────────────────
  BARCODE_DYMO_FILE: {
    id: 'barcode-dymo-file',
    name: '64×19mm Barcode / DYMO File',
    category: 'barcode',
    widthMm: 19,
    heightMm: 64,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 756,
    skus: ['1933085'],
    targetModels: ['lw'],
  },

  // ─── name-badge ─────────────────────────────────────────────────
  NAME_BADGE: {
    id: 'name-badge',
    name: '102×57mm Name Badge',
    category: 'name-badge',
    widthMm: 57,
    heightMm: 102,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1205,
    skus: ['30857', '30911'],
    targetModels: ['lw'],
  },
  NAME_BADGE_NON_ADHESIVE: {
    // 62 mm is wider than the 672-dot head's ~57 mm print width;
    // Dymo prints with margins rather than refusing the roll, so
    // physical fit governs compatibility.
    id: 'name-badge-non-adhesive',
    name: '106×62mm Name Badge Non-Adhesive',
    category: 'name-badge',
    widthMm: 62,
    heightMm: 106,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 1252,
    skus: ['30856'],
    targetModels: ['lw'],
  },

  // ─── price-tag ──────────────────────────────────────────────────
  PRICE_TAG: {
    id: 'price-tag',
    name: '24×22mm Price Tag',
    category: 'price-tag',
    widthMm: 24,
    heightMm: 22,
    type: 'die-cut',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 260,
    skus: ['30373'],
    targetModels: ['lw'],
  },
  PRICE_TAG_2UP: {
    // US-only per the LW PDF; EU equivalent SKU not catalogued.
    id: 'price-tag-2up',
    name: '19×10mm Price Tag (2-up)',
    category: 'price-tag',
    widthMm: 10,
    heightMm: 19,
    type: 'die-cut',
    defaultOrientation: 'horizontal',
    cornerRadiusMm: 3,
    printMargins: MARGINS_1_5,
    lengthDots: 224,
    skus: ['30299'],
    targetModels: ['lw'],
  },

  // ─── continuous ─────────────────────────────────────────────────
  CONTINUOUS_57MM: {
    id: 'continuous-57',
    name: '57mm Continuous Non-Adhesive',
    category: 'continuous',
    widthMm: 57,
    type: 'continuous',
    skus: ['30270'],
    targetModels: ['lw'],
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
