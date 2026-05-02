# Chassis offset + label-pitch semantics — registry data corrections

Cross-reference of:

- `LW 450 Series Technical Reference.pdf` §6.1 (`ESC L` Set Label Length)
- `packages/core/src/media.ts` (`MEDIA` registry — `lengthDots`, `printMargins`)
- `contracts/src/media.ts` (`MediaDescriptor.printMargins`)
- Live print test against an LW 330 Turbo + 99019 lever-arch
  (`packages/node/scripts/test-330-turbo.mjs`, May 2026)

## TL;DR

Two registry-data bugs surfaced when the 330 Turbo printed for the first
time on real hardware. Both apply to **every die-cut paper entry**, not
just the lever-arch we tested.

1. **Leading-edge chassis offset is unmodelled.** ~6 mm at the top of the
   label is physically out of head reach; our `printMargins.topMm: 1.5`
   is the design-tool inset (Dymo's recommended safe area), not the
   chassis offset. A label authored against `printMargins` has its top
   row clipped by the chassis.
2. **`lengthDots` stores the wrong quantity.** Per LW 450 §6.1, `ESC L`
   takes label _pitch_ (leading-edge to leading-edge, label + inter-label
   gap). Our registry stores label-only height (`heightMm × 11.81`).
   Result: the encoder sets the printer to feed exactly the label height,
   the firmware misses the gap mark and either errors with
   `label_too_long`, or lets content bleed onto the next label, or both.

Recommendation: **fix both.** They're catalogue-data-only edits with no
protocol changes, but they change the bytes the encoder emits, so they
need a coordinated PR with refreshed lengthDots values + added
chassis-offset metadata + updated tests.

## Background — what we observed

Live test on hardware (`test-330-turbo.mjs`, lever-arch loaded, 99019 / US
1933087, advertised as 59 × 190 mm):

- First print run: full-width content with margins of 0–4 dots from the
  edge → leftmost / rightmost letters of the trailing-edge text fell
  off the side of the label.
- Second run: visible content moved to a 40-dot-from-edge safe area →
  side clipping resolved.
- Third run with safe margins: trailing-edge bar at `safeBottom - 70` =
  `labelHeight - 130` ≈ 179 mm into a 190 mm label. **Still printed
  onto the next label.** The next label came out blank-ish, with the
  trailing bar of the test print stamped at its leading edge.
- All three runs reported `label_too_long` in the post-print status.
  Print succeeded anyway; the bit is sticky / informational on the 330.

Conclusion: the printer's gap-detection cycle and our `ESC L` value
disagree by enough that visible content runs past the gap. And the
top of the print starts ~6 mm in from the leading edge, not at row 0.

## Issue 1 — leading-edge chassis offset

`MediaDescriptor.printMargins` is documented in
`contracts/src/media.ts` as a "design-tool hint" — informational, not
protocol-level. Drivers don't enforce it. That's the right semantics
for `printMargins`; the issue is that there's no separate field for
the chassis-physical offset, so design tools can't compute the actual
printable rectangle without knowing the engine's quirks.

Two options:

**(a) Add `leadingEdgeOffsetMm` (and `trailingEdgeOffsetMm`) on the
engine** — chassis-physical, distinct from the per-media design hint.
Lives next to `headDots` in the engine descriptor:

```ts
{
  role: 'primary',
  protocol: 'lw-450',
  dpi: 300,
  headDots: 672,
  leadingEdgeOffsetMm: 6,   // un-printable strip at label start
  trailingEdgeOffsetMm: 0,  // (verify on hardware)
  mediaCompatibility: ['lw'],
}
```

This is a contracts shape change (extension to `PrintEngine`) and ripples
to brother-ql / labelmanager. Future-proof but heavier.

**(b) Bump per-media `printMargins.topMm` and document it as
"chassis-physical inset on this driver".** Contains the change to
labelwriter, but conflates two semantics in one field — design hint
_and_ hardware reality — and other drivers' margins stop meaning the
same thing.

Recommendation: **(a)**, but only after we've measured the offset on at
least one second device (Twin Turbo, 4XL, 5XL, or 550) to confirm it's
chassis-class-wide and not 330-specific. Until then, document the 6 mm
finding in `DECISIONS.md` and note that `printMargins` is currently
the only knob.

### What 6 mm means for design tools today

`printMargins.topMm: 1.5` is what the registry says. The actual
unprintable strip is ~7.5 mm (chassis 6 + design 1.5). Apps that lay
out content from `printMargins.topMm` will clip; apps that hard-code
larger margins (a lot of Dymo-tooling does, with Dymo's default
`Page.LeadingMargin = 6 mm`) won't notice.

The test print itself is unaffected — the script's `safeTop = 30` dots
≈ 2.5 mm sits inside the 6 mm chassis offset and rendered fine,
because the chassis silently clips and the rest of the content is
relative to `safeTop` not absolute position. Real-world apps that
need pixel-accurate placement against the leading edge **will** be
affected.

## Issue 2 — `lengthDots` semantics

Today every paper entry has `lengthDots = round(heightMm × 11.81)`,
i.e. label-only height in 300-dpi dots. The encoder
(`protocol.ts:encodeLabel`) feeds this value directly into
`buildSetLabelLength` → `ESC L low high`.

Per LW 450 §6.1 `ESC L` semantics: "Set Label Length. nL/nH = label
length in dots, leading edge of one label to leading edge of the next,
**including the gap**."

So the field stores one quantity, the wire format expects another.
The two are off by the inter-label gap (typically 2–3 mm; varies per
SKU per Dymo's media spec). For the lever-arch:

- Stored `lengthDots`: `round(190 × 11.81)` = 2244 (label height only)
- Actual gap-to-gap pitch: ~193 mm = ~2280 dots

Encoder sends `ESC L 2244` → printer feeds 2244 dots looking for a gap
at the 2244-dot mark, doesn't find one (the gap is ~36 dots later),
raises `label_too_long`, eventually trips the gap on the next feed,
and the buffer's tail bytes have already burned onto the next label.

### Fix

Two paths:

**(a) Re-derive every `lengthDots` value as label-pitch.** Requires
catalogued gap values (from Dymo's media spec sheet — separate doc,
not in the LW PDF) or a calibration constant. The plan-§7 entry
already flags "EU S-numbers deferred"; gap dimensions are similarly
not in `dymo-labels-lw.pdf`. Either source from the EU Dymo spec
sheet or measure from a single sample per SKU and assume Dymo's
manufacturing tolerance.

**(b) Rename the field + add a separate one.** Keep `lengthDots` as
"label-only height in 300-dpi dots" (useful for layout / design-tool
integration), and add `pitchDots` = label + gap. The encoder reads
`pitchDots` for `ESC L`; falls back to `lengthDots + DEFAULT_GAP_DOTS`
when `pitchDots` is missing. `DEFAULT_GAP_DOTS = round(3 × 11.81)`
covers the Dymo standard 3 mm gap.

Recommendation: **(b)** with a default fallback. It's additive,
backwards-compatible with anything reading `lengthDots`, gives the
encoder a knob it can populate over time, and avoids the "where do
gap values come from" research blocker. As real samples accumulate
(starting with the lever-arch we just tested), promote each entry's
`pitchDots` to a measured value.

### Draft fields

```ts
export interface LabelWriterMedia extends MediaDescriptor {
  type: 'die-cut' | 'continuous';
  /** Label-only height in 300-dpi dots — design-tool layout. */
  lengthDots?: number;
  /**
   * Leading-edge to leading-edge pitch in 300-dpi dots — the
   * `ESC L` value. When omitted, the encoder falls back to
   * `lengthDots + DEFAULT_GAP_DOTS` (~3 mm Dymo standard gap).
   */
  pitchDots?: number;
}
```

Encoder change in `protocol.ts:encodeLabel`:

```ts
const labelMedia = options.media as LabelWriterMedia | undefined;
const pitch =
  labelMedia?.pitchDots ??
  (labelMedia?.lengthDots !== undefined
    ? labelMedia.lengthDots + DEFAULT_GAP_DOTS
    : fitted.heightPx); // fallback for media-less paths
parts.push(buildSetLabelLength(pitch));
```

(Design constraint: today the encoder pulls the ESC L value from
`fitted.heightPx`, not from the media descriptor — that's part of why
the bug is hard to spot. The fix is to derive pitch from the media
when a media is in scope and only fall back to `heightPx` for ad-hoc /
custom buffers.)

### Field-test checks for this work

Once this lands, re-run `test-330-turbo.mjs` and verify:

- The trailing-edge bar prints inside the same label (not on the
  next one).
- Status post-print clears `label_too_long` (the printer found the
  gap exactly when it expected to).

## Sequencing / scope

1. **Document chassis offset finding in `DECISIONS.md`.** One D-block
   noting the 6 mm 330 Turbo measurement, that `printMargins` is the
   only knob today, and that `leadingEdgeOffsetMm` is the proposed
   long-term home. No code change.
2. **Add `pitchDots` field + encoder fallback + `DEFAULT_GAP_DOTS`
   constant.** Tests assert the encoder picks `pitchDots` over
   `lengthDots + gap`; integration test (skipped by default) prints a
   full label and checks the trailing-edge bar lands inside.
3. **Populate `pitchDots` for every entry** as gap values are
   confirmed. Lever-arch first (we have it on hand: measure, set,
   verify with `test-330-turbo.mjs`).
4. **(Deferred until second device measured)** Add
   `leadingEdgeOffsetMm` to the engine schema and populate per-device.

Sequencing rationale: step 2 is the urgent fix (real misprints today);
step 4 is polish that needs more data than we have. Steps 1 & 3 are
cheap and unblock 2.

## Open questions

- **Is the trailing-edge offset symmetrical with the leading-edge
  offset?** We didn't measure a trailing offset on the test print
  (the trailing-edge bar was already past the gap). Would need a
  separate pattern with content tucked against the trailing edge to
  measure.
- **Does the 6 mm leading offset apply across the whole lw-450
  protocol family, or is it 330-specific?** Twin Turbo, 4XL, 550, 5XL
  could each differ. Dymo's CUPS PPDs declare per-printer
  `Page.LeadingMargin` values — sourcing those is the cheapest path
  to first-pass coverage without per-device hardware testing.
- **Sticky `label_too_long` bit on the 330.** Status returned 7
  (no_media + not_ready + label_too_long) before any print, then 4
  (label_too_long only) after a successful print. Worth confirming
  whether a clean status (= 0) is even achievable on the 330 between
  prints, or whether `label_too_long` is the printer's idle state.
- **Inter-label gap variance.** Dymo's media-spec PDF would
  authoritatively give per-SKU gap dimensions. We don't have it
  archived; the LW PDF only carries label-physical dimensions. A
  measured-from-sample approach is fine for now, but the catalogue
  approach is more durable.

## Non-goals

- **`MediaDescriptor` shape change in contracts.** Both fixes live
  within the labelwriter driver: `pitchDots` extends
  `LabelWriterMedia`, not the cross-driver `MediaDescriptor`. If
  brother-ql / labelmanager need a similar split, they can extend
  their own descriptors independently — Brother's `tapeSystem` already
  carries gap-equivalent info via continuous-vs-die-cut handling.
- **Continuous tape `pitchDots`.** Continuous media has no gap; the
  encoder's `heightPx` fallback is correct. Field stays optional.
- **Auto-calibration via the printer's gap sensor.** The 550-series
  `ESC U` "get media info" pulls dimensions from the NFC tag, which
  is the strategic answer. Out of scope for this lw-450 fix.
