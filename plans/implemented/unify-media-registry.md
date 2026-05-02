# Unify the media registry (paper + D1 tape into one list)

## Motivation

After the json5-source migration, the labelwriter package still had
two parallel media registries:

- `MEDIA` (paper rolls) — sourced from `data/media.json5`,
  generated into `src/_generated/media.ts`.
- `DUO_TAPE_MEDIA` (D1 tape cassettes) — hand-authored in
  `src/duo-tape-media.ts` via an `entry()` factory.

The split was an artifact of separate hand-authored files, not a
real distinction. Both registries are "media this driver
recognises"; both belong on the same descriptor list, discriminated
by `type` ('die-cut' | 'continuous' | 'tape'). Keeping them apart
meant doc-generation tooling had to know about two sources, the
contracts type `LabelWriterAnyMedia = LabelWriterMedia |
LabelWriterTapeMedia` was set up but unused, and adding new
cartridges required separate plumbing from adding new paper rolls.

## What changed

### Source

`packages/core/data/media.json5` is now the unified list (47
entries: 24 paper + 23 D1 cassettes).

- Paper entries unchanged in shape — `type: 'die-cut' | 'continuous'`.
- D1 entries declare the minimal-author shape:
  `{ key, id, name, type: 'tape', widthMm, material, background, text, skus }`.
  The compile script fills the rest (see "Generator").
- The header comment documents per-`type` rules and the lookup
  convention (`MEDIA[key]`).

### Generator (`scripts/compile-data.mjs`)

- `MEDIA_TYPE` set extended to include `'tape'`.
- `KNOWN_TARGET_MODELS` extended with `'d1'`, `'d1-wide'`.
- New `applyTapeDefaults(entry)` runs before validation and fills:
  - `category: 'cartridge'`
  - `tapeWidthMm = widthMm`
  - `tapeColour` via a mirror of `tapeColourFor(background, text)`
    (source-of-truth for the symbolic-colour → ESC C mapping
    stays in `src/duo-tape-media.ts`; the generator's table is a
    deliberate duplicate, called out in the JSDoc on both sides
    so they stay in sync).
  - `targetModels = widthMm === 24 ? ['d1-wide'] : ['d1']`.
- `validateMediaEntry` gained a `type === 'tape'` branch:
  `widthMm` is in `{6, 9, 12, 19, 24}`; `tapeWidthMm === widthMm`;
  `material` is one of the four D1 material families; `background`
  and `text` are members of the `D1TapeColor` set; `tapeColour` is
  numeric (the default from `applyTapeDefaults` covers this);
  `heightMm` and `lengthDots` are absent.
- `_generated/media.ts` is now typed as
  `Record<MediaKey, LabelWriterAnyMedia>` (was `LabelWriterMedia`).
  Per-key literal narrowing via `as const satisfies` is preserved,
  so `MEDIA.ADDRESS_STANDARD` still resolves to a literal die-cut
  type and is assignable to `LabelWriterMedia`; likewise
  `MEDIA.STANDARD_BLACK_ON_WHITE_12` is assignable to
  `LabelWriterTapeMedia`.

### Runtime (`src/duo-tape-media.ts`)

The inline `DUO_TAPE_MEDIA` const and the `entry()` factory are
gone. The file now holds:

- `tapeColourFor(background, text)` — unchanged; remains the
  source-of-truth for the symbolic-colour → ESC C mapping.
- `D1_TAPE_COLOR_HEX` — unchanged.
- `allTapeMedia(): readonly LabelWriterTapeMedia[]` — new helper,
  filters `MEDIA` by `type === 'tape'`. This is the seam tape-only
  iterators use (the find helpers below, plus the
  `duo-tape-media.test.ts` `ALL` constant).
- `findTapeMediaByWidth` / `findTapeMediaByWidthAll` — unchanged
  surface; iterate `allTapeMedia()` instead of `DUO_TAPE_MEDIA`.

### Runtime (`src/media.ts`)

`findMediaByDimensions` skips `type === 'tape'` entries explicitly
(callers consume 550-status responses, which only describe paper
rolls; the 550 has no tape head). Also narrows through
`LabelWriterMedia` so the optional-`heightMm` access compiles
across the per-key literal types.

### Public API

- `MediaKey` literal-union now spans paper + tape keys (47 names).
- `MEDIA` is `Record<MediaKey, LabelWriterAnyMedia>` (with
  per-key literal types).
- New: `allTapeMedia()`.
- Removed: `DUO_TAPE_MEDIA`. Replace `DUO_TAPE_MEDIA.X` →
  `MEDIA.X` (keys identical) and
  `Object.values(DUO_TAPE_MEDIA)` → `allTapeMedia()`.
- `tapeColourFor`, `D1_TAPE_COLOR_HEX`, `findTapeMediaByWidth`,
  `findTapeMediaByWidthAll` — unchanged signatures.

### Tests

- `__tests__/duo-tape-media.test.ts` — describe block renamed to
  "D1 tape cassettes (MEDIA tape slice)"; `ALL` switched to
  `allTapeMedia()`; the two `DUO_TAPE_MEDIA.X` references at the
  top of the `mediaCompatibleWith` block became `MEDIA.X`.
- `__tests__/media.test.ts` — `ALL_MEDIA` now filters to paper
  via `m.type !== 'tape'` (this file's tests are the paper
  invariants — wide-tier convention, SKU format, etc.; tape
  invariants stay in `duo-tape-media.test.ts`).
- `packages/node/src/__tests__/printer.test.ts` — `DUO_TAPE_MEDIA`
  import dropped; the three `DUO_TAPE_MEDIA.STANDARD_BLACK_ON_WHITE_12`
  references became `MEDIA.STANDARD_BLACK_ON_WHITE_12`.

## Gate

- `pnpm run lint` — clean.
- `pnpm run typecheck` — clean (3 packages).
- `pnpm run test` — 315 passed (2 pre-existing integration skips).
- `pnpm run build` — clean.
- `pnpm run format` — clean.

## Note for future media additions

Add the entry to `data/media.json5` with a fresh `key`, then run
`pnpm run compile-data` (or any `pnpm test` / `pnpm build` —
both run it as a prebuild). For:

- **Paper**: declare `type: 'die-cut' | 'continuous'`,
  `category`, `widthMm`, `heightMm` (die-cut only),
  `lengthDots` (die-cut only), `targetModels`, `skus`.
- **D1 tape**: declare `type: 'tape'`, `widthMm`, `material`,
  `background`, `text`, `skus`. Generator fills the rest.

If a new D1 colour combination needs a non-default ESC C selector,
update `tapeColourFor` in `src/duo-tape-media.ts` AND the mirrored
table in `scripts/compile-data.mjs` in the same change, then
re-run compile-data.
