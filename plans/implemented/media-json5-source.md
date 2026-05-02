# Move media registry to a json5 source + generator

## Motivation

The labelwriter media registry was hand-authored in
`packages/core/src/media.ts` as a TypeScript object literal with
`as const satisfies Record<string, LabelWriterMedia>`. The device
registry in this same package — and the media registry in
sibling brother-ql — both live in `data/*.json5` source files
compiled into `data/*.json` + `src/_generated/*.ts` by
`scripts/compile-data.mjs`. The TS-first shape was an outlier.

Reasons to align:

- **Consistency.** One pattern across both registries and across
  the two driver repos. A reader who learns the device flow gets
  media for free.
- **Doc generation.** External tooling (the docs site, future
  catalogue PDFs, validators) can read `data/media.json` directly
  without bringing TypeScript into the loop. The plan-mandated
  "json artifact as source of truth for non-TS consumers"
  invariant from the device side now extends to media.
- **Validation in one place.** Hand-authored TS catches typos via
  the `LabelWriterMedia` shape; `as const satisfies` doesn't catch
  semantic invariants like "die-cut entries must declare
  `lengthDots`". The compile script now does.

## What changed

### New source file

`packages/core/data/media.json5` — array of 24 entries, one per
physical (widthMm × heightMm) consumable. Each entry carries a
`key: 'ADDRESS_STANDARD'`-style identifier matching the existing
`MEDIA.<KEY>` callsites; the rest of the descriptor is the
`LabelWriterMedia` shape verbatim. The block comment that used to
sit at the top of `media.ts` (sourcing, dpi math, auto-rotate
rationale, target-model gating) lives at the head of the json5 now.

### Compiler

`packages/core/scripts/compile-data.mjs` was extended to also:

- Parse `data/media.json5` (fail the build on parse error or
  invalid shape).
- Validate per-entry: `key` matches `/^[A-Z][A-Z0-9_]*$/` (so it
  can be emitted as a TS object key without quoting); `id`,
  `name`, `category` are strings; `widthMm` is numeric; `type` is
  `'die-cut' | 'continuous'`. Die-cut entries must declare both
  `heightMm` and `lengthDots`; continuous entries must omit them.
  `targetModels` is non-empty and every member is a known LW
  substrate tag (`'lw'` / `'lw-wide'`). `key` and `id` are unique
  across the registry.
- Emit `data/media.json` (flat aggregated artifact, parallel to
  `data/devices.json`).
- Emit `src/_generated/media.ts` exporting a `MediaKey` literal
  union and `MEDIA` keyed by it, typed via
  `as const satisfies Record<MediaKey, LabelWriterMedia>` so
  literal-narrowing per descriptor is preserved exactly as the
  original hand-authored shape provided.

### Slimmed `media.ts`

`packages/core/src/media.ts` now re-exports `MEDIA` and `MediaKey`
from `_generated/media.js`, and keeps `DEFAULT_MEDIA` (still
`= MEDIA.ADDRESS_STANDARD`) and `findMediaByDimensions`. The
inline 380-line const literal is gone.

### Prettier ignore

`.prettierignore` now covers `packages/core/data/media.json` (the
script owns its layout, parallel to `data/devices.json`).
`src/_generated/` was already covered.

### Public API

Unchanged in shape. Added a named export: `MediaKey` (literal
union of all media keys) for callers that want a type-safe lookup.

## Gate

- `pnpm run lint` — clean.
- `pnpm run typecheck` — clean (3 packages).
- `pnpm run test` — 315 passed (2 pre-existing integration skips).
- `pnpm run build` — clean.
- `pnpm run format` — clean (compile-data.mjs picked up a minor
  prettier reformat as a side effect; ignored files unchanged).

## Notes for future media additions

- Add the entry to `data/media.json5` with a fresh `key`, then
  run `pnpm run compile-data` (or any `pnpm test` / `pnpm build` —
  both run the script as a prebuild step). The generated
  `_generated/media.ts` will pick up the new `MediaKey` literal
  automatically.
- If you reach for `MEDIA[someStringFromUserInput]`, type-narrow
  the input against `MediaKey` first; the `Record<MediaKey, ...>`
  shape doesn't widen-key reads.
- For new substrate tags beyond `'lw' | 'lw-wide'`: add them to
  `KNOWN_TARGET_MODELS` in `compile-data.mjs` AND to the
  contracts media-compatibility logic in the same change.
- For new fields on `LabelWriterMedia`: they automatically flow
  through the JSON.stringify pass in the generator. No
  generator-side change needed unless the field has a semantic
  invariant worth validating (then add it to `validateMediaEntry`).
