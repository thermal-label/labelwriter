# Collapse the `lw-330` protocol tag into `lw-450`

## Motivation

The device registry tagged 7 devices (LW_300, LW_310, LW_330,
LW_330_TURBO, LW_EL40, LW_EL60, LW_TURBO) with `protocol: 'lw-330'`
and the rest of the 400/450/EL/Wireless family with
`protocol: 'lw-450'`. The encoder treated both identically:
`SUPPORTED_PROTOCOLS` lumped them into one `Set` and `encodeLabel`
never branched on the tag. The original comment in `protocol.ts`
documented a *firmware-side* distinction — the 300-series rejects
`ESC G` (short form feed) and unconditional `ESC q` (select roll) —
but the encoder never emits either for single-engine devices, so the
distinction never surfaced at runtime.

The protocol field's job is to describe the wire protocol the
encoder produces. Two tags that produce the same byte stream
conflate "device family" with "wire protocol" and mislead readers
into thinking there is a runtime branch.

## What changed

### Source data (json5 → regenerated `devices.json` + `registry.ts`)

Flipped `'lw-330'` → `'lw-450'` in:

- `packages/core/data/devices/LW_300.json5`
- `packages/core/data/devices/LW_310.json5`
- `packages/core/data/devices/LW_330.json5`
- `packages/core/data/devices/LW_330_TURBO.json5`
- `packages/core/data/devices/LW_EL40.json5`
- `packages/core/data/devices/LW_EL60.json5`
- `packages/core/data/devices/LW_TURBO.json5`

Regenerated `packages/core/data/devices.json` and
`packages/core/src/_generated/registry.ts` via `pnpm run
compile-data` (also wired as the prebuild step).

### Encoder

`packages/core/src/protocol.ts`

- `SUPPORTED_PROTOCOLS` now `new Set(['lw-450', 'lw-550'])`.
- The block comment above it was rewritten to explain that `lw-450`
  covers the entire pre-CUPS / 300 / 400 / 450 / EL family, that
  the 300-series firmware-quirk (`ESC G`, unconditional `ESC q`)
  is never emitted by the single-engine path, and that any future
  selective emission should land as an `engine.capabilities` flag
  rather than a separate protocol tag. See "Advice for future
  ESC G / ESC q work" below.

### Doc-comment touch-ups

- `packages/core/src/types.ts` — both block comments listing the
  protocol tag set drop `'lw-330'`.
- `packages/node/src/printer.ts` — the `recover()` JSDoc no longer
  shows `(lw-330 / lw-450)`; reads `(lw-450)`.

### Tests

`packages/core/src/__tests__/devices.test.ts`

- The "203-dpi pre-CUPS models declare 203 dpi and lw-330 protocol"
  test became "...declare 203 dpi" — the protocol assertion is gone.
- The "lw-450 / lw-550 single-roll devices use a 672-dot head"
  test was deriving its set from the protocol tag, which broke
  immediately after the collapse (LW_EL40's 320-dot head, etc., now
  also wear `lw-450`). Replaced with an explicit allowlist of the 9
  devices that genuinely belong to the standard 672-dot head class
  (LW_330, LW_330_TURBO, LW_400, LW_400_TURBO, LW_450,
  LW_450_TURBO, LW_550, LW_550_TURBO, LW_WIRELESS). This is a
  cleaner shape — protocol tags don't carry head geometry, never
  did.
- The sibling test "LW_330 and LW_330_TURBO share head and protocol
  (Turbo = motor speed)" stays. It still passes — trivially now,
  since both wear `lw-450` — but the assertion remains the right
  invariant: if either drifts, that's a bug.

### Changeset

`.changeset/collapse-lw-330-protocol-tag.md` — `minor` bump on
`@thermal-label/labelwriter-core`. Public-API impact is the
removal of `'lw-330'` as a recognised value of
`PrintEngine.protocol` from the labelwriter encoder's
`SUPPORTED_PROTOCOLS`. `PrintEngine.protocol` itself remains typed
as `string` in `@thermal-label/contracts`, so there is no TS
breakage; downstream code that hard-coded `'lw-330'` would silently
stop matching, hence the minor (not patch) bump.

## Gate

- `pnpm run lint` — clean.
- `pnpm run typecheck` — clean (3 packages).
- `pnpm run test` — 315 passed across `core`, `node`, `web`
  (2 integration tests skipped as they were before).
- `pnpm run build` — clean (3 packages).
- `pnpm run format` — clean.

## Advice for future `ESC G` / `ESC q` work

The reason `lw-330` and `lw-450` ever differed was that the
300-series firmware silently drops two specific commands from the
LW 450 Series Tech Ref (`ESC G` short form feed; `ESC q` select
roll without an addressable second engine). If a future encoder
path needs to emit either of those bytes for some devices but not
others, **do not reintroduce a separate protocol tag**. Instead:

1. Add a flag to `LabelWriterEngineCapabilities` in
   `packages/core/src/types.ts` — e.g. `supportsShortFormFeed:
   boolean` or `acceptsUnconditionalSelectRoll: boolean`. The
   contracts package already exposes the open `capabilities` index
   signature on `PrintEngine`, so this is purely additive in the
   driver.
2. Set it on the relevant device JSON5 entries. The current
   "300-series rejects" group is: LW_300, LW_310, LW_330,
   LW_330_TURBO, LW_EL40, LW_EL60, LW_TURBO. (Note: this is also
   exactly the pre-CUPS / pre-450 firmware era. The Tech Ref that
   documents the rejection is the SE450 Tech Ref —
   `LabelWriter SE450 Tech Ref.pdf` in the repo root.)
3. Branch on the capability flag at the point of emission inside
   `encodeLabel` (or its helpers), never at protocol dispatch.

Why this shape is right: the protocol tag is for "what byte stream
shape does the encoder emit?" — currently three values:
`lw-450` (450-family rasters), `lw-550` (550-family job
structure), `d1-tape` (Duo tape). Capability flags are for "which
optional commands within that shape does *this* device's firmware
accept?". Mixing the two is what the old `lw-330` tag did, and
it cost a tag that nothing read.
