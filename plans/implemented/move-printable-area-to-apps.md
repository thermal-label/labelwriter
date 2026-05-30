# Move printable-area handling from core to apps

Status: implemented in core+web on debug/print-flow (2026-05-24).
Bench confirmation on the LW 550 still pending — the print path now
sends every authored row verbatim and the harness sizes its canvas
via `getPrintableCanvasDots`. Surfaced from the LW 550
`marker1ToStart` analysis on the bench S0722540 dump.

## Problem

`labelwriter-core` currently applies a per-engine chassis offset
(`printableArea.leading / trailing / left / right`) inside the encoders
(`composeWireBitmap`, `composeWireBitmap550`) — pre-trimming raster
rows off the input bitmap before emitting wire bytes. The LW 550 has
`printableArea.leading = 6 mm` to compensate for the head's leading
deadzone.

That **double-counts on newer LW 550 rolls**. The NFC SKU dump's
`marker1ToStart` field already shifts the print head past the deadzone
before the firmware fires:

- 2022-era roll (free-dmo S0722540 / 30334 dump): `marker1ToStart = 3.6 mm`
  ≈ gap width + a sliver. Firmware does *not* compensate; chassis 6 mm
  is load-bearing.
- 2024+ roll (this bench S0722540 dump): `marker1ToStart = 8.8 mm`
  = 3 mm gap + 5.8 mm head-deadzone compensation. Firmware *is*
  compensating; chassis 6 mm pre-trim now shifts a second time.

Symptom on the newer roll: ~25.7 mm of a 31.7 mm label printed, with
a ~6 mm blank strip at the **trailing** edge.

The bigger architectural point: cropping is the wrong layer. Designer
apps (the harness, burnmark.io, future tools) know the label they're
laying out onto; they can size content to the printable rectangle at
design time. Core's job is wire encoding — fit to head width, emit
raster bytes. Nothing more.

See [[project_dead_zone_load_bearing]] — `leading` was tagged
load-bearing on the premise that *something* needed to compensate.
Newer rolls move that compensation into the firmware via NFC, so the
load shifts off `printableArea` onto the app+NFC pair.

## Proposal

1. **Core stops cropping leading / trailing / left / right.**
   `encodeLabel` and `encode550Label` keep only the head-width fit
   (right-pad if narrower than `headDots`, crop if wider). Whatever
   rows the caller sends, core transmits.

2. **`getPrintableArea` in `@thermal-label/contracts` becomes the
   public query API for apps.** Signature gains optional `SkuInfo`:

   ```ts
   getPrintableArea(
     engine: PrintEngine,
     media: MediaDescriptor,
     sku?: SkuInfo,           // ← new
   ): PrintableArea
   ```

   Computes the NFC-aware leading reduction:

   ```ts
   leadingMm =
     sku?.markerType === 0
       ? Math.max(
           0,
           engine.printableArea.leading
             - Math.max(0, sku.marker1ToStartMm - sku.marker1WidthMm),
         )
       : engine.printableArea.leading;
   ```

   (markerType 0 covers the bench roll. Other marker types may encode
   the offset differently — see Open questions.)

3. **Apps own printable-area layout.** Harness `buildDiagnosticImage`
   and future designer apps call `getPrintableArea(engine, media,
   sku?)` and size content to the result. What reaches `print(rgba)`
   already fits the printable rectangle; core ships it verbatim.

4. **`engine.printableArea` becomes informational.** Document as the
   chassis offset *when the firmware doesn't compensate*; consumers
   prefer `getPrintableArea(…, sku)` over reading the engine field
   directly.

## Implementation outline (do not start)

1. **core**: split `composeWireBitmap` / `composeWireBitmap550` into
   `fitToHeadWidth` (kept) and `applyChassisCrop` (dropped on the
   encoder path; exported as an offline util if any consumer wants
   the old behaviour).
2. **contracts**: extend `getPrintableArea(engine, media)` →
   `getPrintableArea(engine, media, sku?)`. Compute the NFC-aware
   reduction inside.
3. **harness**: `apps/harness-labelwriter/src/diagnostic-print.ts`
   calls the SKU-aware `getPrintableArea` and sizes the diagnostic
   image to the result. Smaller authoring canvas; same physical
   print. Other harness-* apps + verify-cli: same shape.
4. **tests**: drop the `printable-area integration (plan 08 §6)`
   tests in `protocol.test.ts` and `protocol-550.test.ts`; replace
   with tests on `getPrintableArea`'s new SKU-aware branch in
   `@thermal-label/contracts`.
5. **doc**: deprecate the load-bearing reading of
   [[project_dead_zone_load_bearing]]; `leading` is now app-owned
   for lw5-raster, defaulted-for-450.

## Risks

- **LW 450 family has no NFC.** Apps still need the chassis offset.
  `getPrintableArea(engine, media)` (no `sku`) returns the chassis
  value, so apps that go through the API get the right number; apps
  that send a full-label-height bitmap blind to the API get a
  trailing-edge misprint. Breaking change for the latter — flag in
  the changeset.
- **Other-driver impact.** `getPrintableArea` lives in contracts and
  is used by every driver (labelmanager, brother-ql, letratag, …).
  Adding the optional `sku?` param is non-breaking, but each driver
  needs to confirm it doesn't break their `composeWireBitmap`
  equivalent when core stops auto-cropping.
- **Single bench sample.** The marker1ToStart threshold logic is
  fitted to one S0722540 capture. Confirm against ≥1 more populated
  capture before locking in — ideally a different-SKU die-cut and a
  continuous-roll capture.

## Open questions

- **Continuous-label media** (non-die-cut): `markerPitch` is the
  inter-tear distance, not a label-to-label gap. Does
  `marker1ToStart` still apply, or is it zero? Need a continuous-roll
  capture to verify.
- **`markerType ∈ {1, 2, 3}` semantics**: all free-dmo dumps and this
  bench dump have `markerType = 0`. The other types are documented in
  the spec but unobserved on the wire — generalising the formula to
  cover them is a wait-for-capture exercise.
- **Older lw5-raster firmware**: 2022-era rolls had
  `marker1ToStart ≈ 3.6 mm`. Firmware on a printer that's only ever
  seen 2022 rolls might not handle the deadzone shift even if
  presented with a 2024-roll's larger value — i.e. compensation could
  be a firmware-version capability, not just a tag-version capability.
  Verify with a firmware-version capture (`ESC V`) alongside the SKU
  dump before declaring the rule universal.

## Trigger

Bench print of the LW 550 fix lands → if the symptom matches
(content shifted toward leading edge, ~6 mm blank at trailing) →
promote this plan from `backlog` to `implemented` queue.
