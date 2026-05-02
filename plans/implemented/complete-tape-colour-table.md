# Complete the D1 ESC C selector table from LW 400 Series Tech Ref p.24

## Motivation

`<esc> C` ("Set Tape Type") on the LabelWriter Duo's tape head
sets the **heat sensitivity / strobe profile** for the loaded
cassette. Per `LabelWriter 400 Series Technical Reference Manual`
p.24 the byte takes one of 13 values (0–12), each tied to a
specific (background, text) substrate combination. The byte does
not change the printed ink — sending `0` for any cassette still
prints — but the firmware uses the value to pick the correct
thermal-energy curve, so a wrong selector means correct ink at
suboptimal density.

Before this change, `tapeColourFor()` enumerated 3 of the 13
selectors (0, 1, 12) plus a `0` fallback. That meant 10 of the 23
catalogued D1 cassettes (every yellow / green / red / white-on-X
/ blue-on-white variant) silently fell back to the generic
selector 0 instead of the spec-correct value, costing print
quality on those substrates.

The encoder always emitted the byte (via `buildDuoSetTapeType` in
`duo-tape.ts`, fed each cassette's baked `tapeColour`); only the
lookup was incomplete. Completing it is a print-quality fix that
takes effect at the wire boundary without any API or workflow
change.

## What changed

### `tapeColourFor` (source-of-truth)

`packages/core/src/duo-tape-media.ts` — the function now branches
across the full p.24 table:

| Selector | Combination                  | Status        |
|----------|------------------------------|---------------|
| 0        | Black on white or clear      | verified      |
| 1        | Black on blue                | verified      |
| 2        | Black on red                 | spec-derived  |
| 3        | Black on silver              | spec-only*    |
| 4        | Black on yellow              | spec-derived  |
| 5        | Black on gold                | spec-only*    |
| 6        | Black on green               | spec-derived  |
| 7        | Black on fluorescent green   | spec-only*†   |
| 8        | Black on fluorescent red     | spec-only*    |
| 9        | White on clear               | spec-derived  |
| 10       | White on black               | spec-derived  |
| 11       | Blue on white or clear       | spec-derived  |
| 12       | Red on white or clear        | verified      |

\* — substrate variants not represented in `D1TapeColor`. No
catalogued cassette uses silver, gold, fluorescent-green, or
fluorescent-red today; if one ever does, add the symbol to
`D1TapeColor` and a branch here in the same change.

† — selector 7 was previously listed as "verified" in the JSDoc
based on a duo-tape.ts test reference, but no current
`D1TapeColor` value maps to it; the spec-only marker is the
honest current state.

The JSDoc cites the spec page directly (was previously citing
"LW 450 Series Tech Ref p.24" — same table, but the LW 400 Tech
Ref is the authoritative copy in the repo) and distinguishes
verified-by-hardware mappings from spec-derived ones.

### Generator mirror

`packages/core/scripts/compile-data.mjs` — the duplicated
`tapeColourFor` is updated in lockstep. The mirror's docstring
points at the source-of-truth in `duo-tape-media.ts` and at the
spec page.

### Baked descriptors

`pnpm run compile-data` re-emits `data/media.json` and
`src/_generated/media.ts` with the corrected `tapeColour` on:

- `STANDARD_BLACK_ON_RED_12`     (0 → 2)
- `STANDARD_BLACK_ON_YELLOW_12`  (0 → 4)
- `STANDARD_BLACK_ON_GREEN_12`   (0 → 6)
- `STANDARD_BLACK_ON_YELLOW_24`  (0 → 4)
- `STANDARD_WHITE_ON_CLEAR_12`   (0 → 9)
- `STANDARD_WHITE_ON_BLACK_12`   (0 → 10)
- `DURABLE_WHITE_ON_BLACK_12`    (0 → 10)
- `STANDARD_BLUE_ON_WHITE_12`    (0 → 11)

Eight cassettes change. Verified-or-already-correct cassettes
(black on white/clear/blue, red on white) keep their existing
selectors. Cassettes outside the spec (e.g. `DURABLE_BLACK_ON_ORANGE_12`,
`DURABLE_WHITE_ON_RED_12`) stay on the documented `0` fallback —
the spec table doesn't enumerate orange or reverse-on-red, so
sending `0` is the safe default per the spec note.

### Tests

`__tests__/duo-tape-media.test.ts` gains a new `describe` block
asserting `tapeColourFor` against every spec-table pair the
`D1TapeColor` set can express, plus the documented fallback for
combinations the spec doesn't enumerate. The existing per-entry
assertion (`m.tapeColour === tapeColourFor(m.background, m.text)`)
already enforces consistency between the source-of-truth function
and the baked-into-MEDIA values; these new tests pin the function
itself to the spec page.

## Gate

- `pnpm run lint` — clean.
- `pnpm run typecheck` — clean (3 packages).
- `pnpm run test` — 241 passed (239 → 241; +2 new spec-table tests).
- `pnpm run build` — clean.
- `pnpm run format` — clean.

## Future signals

- If a D1 cassette ever ships with silver, gold, fluorescent-green,
  or fluorescent-red substrate, add the symbol to `D1TapeColor`
  (in `src/types.ts`), add the branch to `tapeColourFor` (and its
  mirror), and add a test pair in the spec-table block. Selectors
  3, 5, 7, 8 are reserved by the spec for those combinations; do
  not redefine.
- If real-world testing reveals a (background, text) → selector
  mapping that disagrees with the spec page, treat that as a bug
  worth investigating before "fixing" — the spec's authoritative,
  hardware behaviour is the test of truth, but Dymo PDFs have
  been wrong elsewhere (see the LW vs LM 19 mm SKU note in
  `data/media.json5`). Cite the source either way.
