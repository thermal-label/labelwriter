import type { D1Material, D1TapeColor, DuoTapeWidth, LabelWriterTapeMedia } from './types.js';

/**
 * Registry of D1 tape cassettes the LabelWriter Duo accepts.
 *
 * One entry per catalogued cassette variant from
 * `dymo-labels-lm.pdf` (Dymo's LabelManager compatibility matrix —
 * same D1 product line as the Duo's tape head), cross-checked
 * against the 450 Duo column in `dymo-labels-lw.pdf`. SKUs include
 * the US 5-digit codes (`45013`), 7-digit codes (`1978364`), and EU
 * S-numbers (`S0720780`) where catalogued. Variants of the same
 * physical product (regional packaging, retail count) collapse onto
 * one entry via the `skus` array.
 *
 * Tape is continuous; `heightMm` is intentionally omitted on every
 * entry. `tapeWidthMm` carries the strict 6/9/12/19/24 union for
 * encoder dispatch; `widthMm` mirrors it as the cross-driver
 * `MediaDescriptor` field.
 *
 * Compatibility tags: 6/9/12/19 mm cartridges carry `['d1']`;
 * 24 mm cartridges carry `['d1-wide']`. The 450 Duo's tape engine
 * declares `['d1', 'd1-wide']` (LW_DUO_96 declares only `['d1']`
 * — its 96-dot head and chassis pre-date 24 mm tape).
 */

const STD = 'standard' satisfies D1Material;
const PERM = 'permanent-polyester' satisfies D1Material;
const FLEX = 'flexible-nylon' satisfies D1Material;
const DUR = 'durable' satisfies D1Material;

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
 */
export function tapeColourFor(background: D1TapeColor, text: D1TapeColor): number {
  if (text === 'black' && (background === 'white' || background === 'clear')) return 0;
  if (text === 'black' && background === 'blue') return 1;
  if (text === 'red' && background === 'white') return 12;
  return 0;
}

function entry(opts: {
  id: string;
  name: string;
  widthMm: DuoTapeWidth;
  material: D1Material;
  background: D1TapeColor;
  text: D1TapeColor;
  skus: readonly string[];
  targetModels?: readonly string[];
}): LabelWriterTapeMedia {
  return {
    id: opts.id,
    name: opts.name,
    category: 'cartridge',
    widthMm: opts.widthMm,
    type: 'tape',
    tapeWidthMm: opts.widthMm,
    tapeColour: tapeColourFor(opts.background, opts.text),
    material: opts.material,
    background: opts.background,
    text: opts.text,
    skus: opts.skus,
    targetModels: opts.targetModels ?? (opts.widthMm === 24 ? ['d1-wide'] : ['d1']),
  };
}

export const DUO_TAPE_MEDIA = {
  // ─── Standard ─────────────────────────────────────────────── 6 mm ─
  STANDARD_BLACK_ON_WHITE_6: entry({
    id: 'd1-standard-bw-6',
    name: '6mm Black on White',
    widthMm: 6,
    material: STD,
    background: 'white',
    text: 'black',
    skus: ['43613', 'S0720780'],
  }),

  // ─── Standard ─────────────────────────────────────────────── 9 mm ─
  STANDARD_BLACK_ON_CLEAR_9: entry({
    id: 'd1-standard-bc-9',
    name: '9mm Black on Clear',
    widthMm: 9,
    material: STD,
    background: 'clear',
    text: 'black',
    skus: ['40910', 'S0720670'],
  }),
  STANDARD_BLACK_ON_WHITE_9: entry({
    id: 'd1-standard-bw-9',
    name: '9mm Black on White',
    widthMm: 9,
    material: STD,
    background: 'white',
    text: 'black',
    skus: ['41913'],
  }),

  // ─── Standard ────────────────────────────────────────────── 12 mm ─
  STANDARD_BLACK_ON_WHITE_12: entry({
    id: 'd1-standard-bw-12',
    name: '12mm Black on White',
    widthMm: 12,
    material: STD,
    background: 'white',
    text: 'black',
    skus: ['45013'],
  }),
  STANDARD_BLACK_ON_CLEAR_12: entry({
    id: 'd1-standard-bc-12',
    name: '12mm Black on Clear',
    widthMm: 12,
    material: STD,
    background: 'clear',
    text: 'black',
    skus: ['45010'],
  }),
  STANDARD_BLACK_ON_YELLOW_12: entry({
    id: 'd1-standard-by-12',
    name: '12mm Black on Yellow',
    widthMm: 12,
    material: STD,
    background: 'yellow',
    text: 'black',
    skus: ['45018'],
  }),
  STANDARD_BLACK_ON_BLUE_12: entry({
    id: 'd1-standard-bbl-12',
    name: '12mm Black on Blue',
    widthMm: 12,
    material: STD,
    background: 'blue',
    text: 'black',
    skus: ['45016', 'S0720560'],
  }),
  STANDARD_BLACK_ON_GREEN_12: entry({
    id: 'd1-standard-bg-12',
    name: '12mm Black on Green',
    widthMm: 12,
    material: STD,
    background: 'green',
    text: 'black',
    skus: ['45019', 'S0720590'],
  }),
  STANDARD_BLACK_ON_RED_12: entry({
    id: 'd1-standard-br-12',
    name: '12mm Black on Red',
    widthMm: 12,
    material: STD,
    background: 'red',
    text: 'black',
    skus: ['45017', 'S0720570'],
  }),
  STANDARD_WHITE_ON_CLEAR_12: entry({
    id: 'd1-standard-wc-12',
    name: '12mm White on Clear',
    widthMm: 12,
    material: STD,
    background: 'clear',
    text: 'white',
    skus: ['45020', 'S0720600'],
  }),
  STANDARD_WHITE_ON_BLACK_12: entry({
    id: 'd1-standard-wbk-12',
    name: '12mm White on Black',
    widthMm: 12,
    material: STD,
    background: 'black',
    text: 'white',
    skus: ['45021', 'S0720610'],
  }),
  STANDARD_BLUE_ON_WHITE_12: entry({
    id: 'd1-standard-blw-12',
    name: '12mm Blue on White',
    widthMm: 12,
    material: STD,
    background: 'white',
    text: 'blue',
    skus: ['45014'],
  }),
  STANDARD_RED_ON_WHITE_12: entry({
    id: 'd1-standard-rw-12',
    name: '12mm Red on White',
    widthMm: 12,
    material: STD,
    background: 'white',
    text: 'red',
    skus: ['45015', 'S0720550'],
  }),

  // ─── Standard ────────────────────────────────────────────── 19 mm ─
  // 19 mm SKU labelling is contested between LW PDF and LM PDF — see
  // expand-media-registry.md §5.4. Treating LW PDF as authoritative:
  // 45800 = Black on White, 45803 = Black on Clear (LW 450 Series Tech
  // Ref). The LM PDF disagrees; verify against Dymo product pages.
  STANDARD_BLACK_ON_WHITE_19: entry({
    id: 'd1-standard-bw-19',
    name: '19mm Black on White',
    widthMm: 19,
    material: STD,
    background: 'white',
    text: 'black',
    skus: ['45800'],
  }),
  STANDARD_BLACK_ON_CLEAR_19: entry({
    id: 'd1-standard-bc-19',
    name: '19mm Black on Clear',
    widthMm: 19,
    material: STD,
    background: 'clear',
    text: 'black',
    skus: ['45803', 'S0720820'],
  }),

  // ─── Standard (24 mm — wide tier) ──────────────────────────────────
  STANDARD_BLACK_ON_WHITE_24: entry({
    id: 'd1-standard-bw-24',
    name: '24mm Black on White',
    widthMm: 24,
    material: STD,
    background: 'white',
    text: 'black',
    skus: ['53713', 'S0720930'],
  }),
  STANDARD_BLACK_ON_YELLOW_24: entry({
    id: 'd1-standard-by-24',
    name: '24mm Black on Yellow',
    widthMm: 24,
    material: STD,
    background: 'yellow',
    text: 'black',
    skus: ['53718', 'S0720980'],
  }),

  // ─── Permanent Polyester ───────────────────────────────────────────
  PERMANENT_BLACK_ON_WHITE_12: entry({
    id: 'd1-permanent-bw-12',
    name: '12mm Permanent Black on White',
    widthMm: 12,
    material: PERM,
    background: 'white',
    text: 'black',
    // LM 280 lists this as 1978364 (the Durable Black on White SKU) —
    // almost certainly a copy-paste error in the source PDF. 16955
    // (per LW PDF and LM 360D) is treated as authoritative.
    skus: ['16955'],
  }),

  // ─── Flexible Nylon ───────────────────────────────────────────────
  FLEXIBLE_BLACK_ON_WHITE_12: entry({
    id: 'd1-flexible-bw-12',
    name: '12mm Flexible Black on White',
    widthMm: 12,
    material: FLEX,
    background: 'white',
    text: 'black',
    skus: ['16953', 'S0718040'],
  }),

  // ─── Durable (industrial) ─────────────────────────────────────────
  DURABLE_BLACK_ON_WHITE_12: entry({
    id: 'd1-durable-bw-12',
    name: '12mm Durable Black on White',
    widthMm: 12,
    material: DUR,
    background: 'white',
    text: 'black',
    skus: ['1978364'],
  }),
  DURABLE_WHITE_ON_BLACK_12: entry({
    id: 'd1-durable-wbk-12',
    name: '12mm Durable White on Black',
    widthMm: 12,
    material: DUR,
    background: 'black',
    text: 'white',
    skus: ['1978365'],
  }),
  DURABLE_WHITE_ON_RED_12: entry({
    id: 'd1-durable-wr-12',
    name: '12mm Durable White on Red',
    widthMm: 12,
    material: DUR,
    background: 'red',
    text: 'white',
    skus: ['1978366'],
  }),
  DURABLE_BLACK_ON_ORANGE_12: entry({
    id: 'd1-durable-bo-12',
    name: '12mm Durable Black on Orange',
    widthMm: 12,
    material: DUR,
    background: 'orange',
    text: 'black',
    skus: ['1978367'],
  }),
} as const satisfies Record<string, LabelWriterTapeMedia>;

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

/**
 * Find the lowest-numbered cartridge variant at a given tape width.
 *
 * For UIs that just want "any 12 mm tape" — typically returns the
 * Standard Black on White variant. Use `findTapeMediaByWidthAll()`
 * when the caller needs every variant.
 */
export function findTapeMediaByWidth(widthMm: number): LabelWriterTapeMedia | undefined {
  const entries: LabelWriterTapeMedia[] = Object.values(DUO_TAPE_MEDIA);
  return entries.find(m => m.tapeWidthMm === (widthMm as DuoTapeWidth));
}

/**
 * Find every catalogued cartridge variant at a given tape width.
 *
 * For UI dropdowns that surface colour/material variants. Returns an
 * empty array when no entry matches.
 */
export function findTapeMediaByWidthAll(widthMm: number): readonly LabelWriterTapeMedia[] {
  const entries: LabelWriterTapeMedia[] = Object.values(DUO_TAPE_MEDIA);
  return entries.filter(m => m.tapeWidthMm === (widthMm as DuoTapeWidth));
}
