# 4xx raster compression — fold blank rows into `ESC f 1 n`

Cross-reference of:

- `LabelWriter 400 Series Tech Ref_4_08.pdf` Appendix A (Data Compression)
- `LW 450 Series Technical Reference.pdf` (LW 450, 450 Turbo, 450 Twin Turbo,
  450 Duo, 4XL — ©2009) — defines `<etb>` Transfer Compressed Print Data and
  `<esc> f 1 n` Skip "n" Lines
- `LW 550 Technical Reference.pdf` (LW 550, 550 Turbo, 5XL — ©2021)

## TL;DR

- The 4xx series exposes **two complementary whitespace-saving primitives**:
  `<etb>` RLE for partial-content rows, and `<esc> f 1 n` to skip up to 255
  fully-blank rows in a single 4-byte command.
- We currently emit RLE when `compress: true` (`protocol.ts:100-128`) but
  **never emit `ESC f 1 n`**. For shipping/address labels with large blank
  bands (header gap, address-block gap, tracking-barcode quiet zones) this is
  leaving meaningful bandwidth on the table.
- The 5xx family does **not** support either primitive — the 550 wire format
  is a single `ESC D` block carrying a contiguous `width × height` bit array,
  with no per-line framing. So this work is strictly a 4xx-path optimization.
- Recommendation: **defer.** Modern USB 2.0 makes this unnoticeable in the
  common case, and the 5xx path (the strategic target) cannot benefit. Worth
  doing if/when we have a concrete user complaint about 4xx throughput on
  large labels, RS-232 SE450 deployments, or LAN-print latency on 450 Twin
  Turbo (legacy, but exists).

## Background — what compression actually buys on 4xx

### `<etb>` run-length, recap

`protocol.ts:100-128` already implements this. Per Appendix A:

- 1 byte per run, sign bit = pixel color, 7 lower bits = run length − 1
  (1..128 pixels per byte).
- Sum of run lengths across a row must equal `bytes-per-line × 8`.
- Lines may be intermixed: some rows uncompressed (`<syn>`), others RLE
  (`<etb>`).

Cost analysis for the LW 450 (672-dot head, 84 bytes/row uncompressed):

| Row content                | Uncompressed | RLE bytes | Notes |
|----------------------------|--------------|-----------|-------|
| All-white                  | 1 + 84 = 85  | 1 + 6 = 7 | 6 × `0x7F` (white run of 128) |
| All-black                  | 1 + 84 = 85  | 1 + 6 = 7 | 6 × `0xFF` |
| Solid block 80 px wide     | 1 + 84 = 85  | ~5        | 4 white runs + 1 black run |
| Random / dithered pattern  | 1 + 84 = 85  | up to 169 | RLE *expands* worst case |

So `compress: true` is a win on most label-shaped inputs (text + barcode +
whitespace) but is not free of pathological inputs.

### `<esc> f 1 n` skip lines, recap

LW 450 ref p. 17:

> *"This command skips over the next 'n' lines on the label. The distance of
> a 'line' is dependant on the current resolution set for the printer by the
> ESC h / ESC i commands."*

Cost: 4 bytes total (`1B 66 01 nn`), 1 ≤ n ≤ 255. Replaces up to 255 fully-
blank dot lines.

For a label with a 60-dot fully-blank band:

- Uncompressed: 60 × 85 = 5100 bytes
- RLE only:     60 × 7  = 420 bytes
- `ESC f 1 60`: 4 bytes (≈100× smaller than RLE for the same band)

So `ESC f 1 n` is a *strict* additional win on top of RLE, but only for
runs of fully-empty rows. It does nothing for partial-content rows.

### Why this matters less on USB and more on slow links

- **USB 2.0 full-speed** (12 Mb/s ≈ 1.5 MB/s): a fully-rasterized 89×28 mm
  shipping label at 300 dpi is ~70 KB → ~50 ms at the wire. Compression
  saves time but it's already imperceptible.
- **LAN print on 450 Twin Turbo**: the 450 series is USB-only; only the LW
  550 Turbo / 5XL added Ethernet. So the LAN argument is moot for 4xx.
- **RS-232 SE450** at 9600 baud: ~1 KB/s. A 70 KB raster takes ~70 s; a
  blank-banded label compressed to ~10 KB takes ~10 s. Here the savings
  are *user-perceptible*.

So the strongest practical motivation is RS-232 SE450 — which today we
don't support at all (see `plans/backlog/se450-ascii-mode.md`). Without
that transport, this optimization is throughput polish, not a fix for any
actual complaint.

## Why 5xx doesn't benefit

I read the LW 550 tech ref end-to-end. The 550 protocol does not carry
`<syn>` / `<etb>` / `ESC f` anywhere:

- Print data is a single `ESC D <BPP> <align> <width:u32> <height:u32>
  <print-data…>` block — a contiguous `width × height` bit array, no
  per-line framing, no Bytes-per-Line register.
- The full command set (ESC s, L, h, i, T, C, n, D, G, E, Q, A, V, U, e,
  o, *, @) is documented across pp. 11–20; there is no compression command
  and no skip-lines command. This is exhaustive — there is nothing for
  third-party drivers to discover.
- `protocol-550.ts:244-245` already documents this explicitly:
  > *"compress is silently ignored — the 550 raster format does not carry
  > the 450's SYN / ETB framing and therefore cannot RLE."*

Vertical whitespace on a 550 has to be encoded as zero-bytes inside the
`ESC D` block. The only thing that *might* shrink a 550 job is something
the 550 firmware does not expose: there is no way for the host to ask for
less data on the wire.

So this entire workstream is 4xx-only, and any encoder change must remain
gated on `engine.protocol === '450'` (matching today's `buildRasterRow`
caller).

## What the encoder would need to change

`protocol.ts:206-249` currently:

```ts
const rasterRows: Uint8Array[] = [];
for (let y = 0; y < fitted.heightPx; y++) {
  const row = getRow(fitted, y);
  rasterRows.push(buildRasterRow(row, compress));
}
```

A skip-aware encoder would be one of:

1. **Pre-pass: detect blank-row runs.** Walk `fitted` once collecting an
   array of `{kind: 'data', y} | {kind: 'skip', count}` segments where any
   maximal run of fully-zero rows becomes a `skip` of `count` lines, split
   into chunks of ≤255. Emit `ESC f 1 n` for skip segments and
   `buildRasterRow` for data rows.

2. **Streaming: peek-ahead while iterating.** As we walk rows, when we hit
   a zero row, look forward up to 255 rows; if the next non-zero row is
   far enough away that `4 + (gap-1) × per_row_min` > `4 + per_row_min`
   etc., emit a skip. Marginal gain over (1), more complex.

(1) is the obvious choice. New helper:

```ts
function buildSkipLines(n: number): Uint8Array {
  // 1B 66 01 nn — n in [1, 255]
  if (n < 1 || n > 255) throw new RangeError(...);
  return new Uint8Array([0x1b, 0x66, 0x01, n]);
}
```

And the row loop becomes:

```ts
let y = 0;
while (y < fitted.heightPx) {
  const blankRun = countBlankRows(fitted, y); // walks until non-zero or end
  if (blankRun >= MIN_SKIP) {
    let remaining = blankRun;
    while (remaining > 0) {
      const chunk = Math.min(255, remaining);
      rasterRows.push(buildSkipLines(chunk));
      remaining -= chunk;
    }
    y += blankRun;
    continue;
  }
  rasterRows.push(buildRasterRow(getRow(fitted, y), compress));
  y++;
}
```

`MIN_SKIP` exists because for *very* short blank runs the savings don't
beat the per-skip overhead. Approximate break-even when `compress: true`:
1 blank RLE row ≈ 7 bytes, 1 skip command = 4 bytes — so even `MIN_SKIP =
1` is a (small) net win when `compress` is on. With `compress: false`,
1 blank uncompressed row = 85 bytes vs 4 bytes for skip, so any blank row
should be skipped. Reasonable default: `MIN_SKIP = 1` regardless.

### Independence from `compress`

`ESC f 1 n` is independent of `<syn>` vs `<etb>` framing — Appendix A and
the 450 ref both treat skip-lines as a label-movement command, not a print-
data command. We can emit it whether or not `compress` is set. Probably
worth gating it behind a separate option (`skipBlankRows: boolean`,
default `true`?) so behavior changes are opt-out.

### Open question: alignment with `ESC L` / form-feed semantics

The 450 ref says skip-lines *advances the label* — same physical effect
as if those rows had been printed all-white. Combined with `ESC L`
(label length) and `ESC E` (form feed), we need to verify the printer's
position counter still ends up where `encodeLabel` expects:

- `ESC L` sets the maximum distance until top-of-form sense.
- Print rows decrement the position counter (one per dot line).
- `ESC f 1 n` decrements the same counter by `n`.
- `ESC E` consumes the remainder up to the tear-bar.

The math should work out the same as if all rows had been emitted, but
this needs a fixture-based test (compare wire bytes for a label with N
blank rows printed via `<syn>` vs the same label emitted with `ESC f 1 N`
swapped in — printer should produce identical output). Without hardware
on hand, the verification path is the saved-bytes comparison test +
careful read of the spec, plus a packet-capture comparison against the
official Dymo driver if we want belt-and-braces.

## Tests we'd want

- **Golden-byte test:** "label with explicit 100-row blank band, encoded
  with `skipBlankRows: true`, must contain exactly one `1B 66 01 64`
  sequence at the right offset and zero blank `<syn>` rows for that band."
- **Boundary test:** 256-row blank band must produce two skip commands
  (`1B 66 01 FF` + `1B 66 01 01`) — confirms the chunking math.
- **Interaction with `compress: true`:** skip-lines bytes appear *between*
  `<etb>` rows, not inside them.
- **No regression for 550:** running the same options on a 550-protocol
  device must not produce any `0x1B 0x66` bytes (the 550 path goes through
  `encode550Label` and ignores both compression and skip-lines anyway —
  but a regression test is cheap insurance).
- **Bitmap parity:** decode the wire stream back to a bitmap and compare
  to the original. Already a useful test we don't have today; if we add it
  for skip-lines we should backfill it for plain RLE too.

## Phasing

### Phase 0 — decide

This document. No code. Reassess if anyone reports 4xx throughput pain or
once RS-232 SE450 is in scope.

### Phase 1 — implementation (≤ ½ day)

- Add `buildSkipLines(n)` to `protocol.ts`.
- Add `skipBlankRows?: boolean` (default `true`) to `LabelWriterPrintOptions`.
- Pre-pass to detect and chunk blank-row runs in `encodeLabel`'s 450 path.
- Golden-byte tests above.
- Note in `protocol-550.ts` that `skipBlankRows` is silently ignored on
  550 (mirroring the existing `compress` note).

### Phase 2 — verification (needs hardware)

- Print the same label image on a real LW 450 with and without
  `skipBlankRows: true`; visually compare; compare packet captures to the
  official driver to confirm Dymo also uses `ESC f 1 n` (likely — driver
  optimization advice in the 450 ref §"Optimization of Throughput" hints
  at it).
- Repeat on LW 4XL (1248-dot head) — same protocol, but worth confirming
  the position counter bookkeeping for the wider head.

## Net judgement

Defer. The optimization is real and clean, but:

1. The strategic target (5xx) cannot use it.
2. The 4xx target is bandwidth-bound only on links we don't currently
   support (RS-232) or printers approaching end of life (450 Twin Turbo
   over USB is still well within the 4xx's print-engine bottleneck, not
   the wire).
3. No user has asked.

Re-evaluate when any of those change.

## Other findings worth recording

- **Appendix A's caveat**: *"the sum of the pixels must be equal to the
  Bytes-per-Line variable multiplied by 8. No error checking is done on
  the incoming data and unexpected results will occur if the above caution
  is not observed."* — our `buildRasterRow` RLE path satisfies this by
  construction (we walk every bit of the input row), but if we ever expose
  a public RLE-row builder for caller-supplied data, we should add a
  defensive bytes-per-line assertion.
- **`<etb>` is sometimes called "ETB compression" or "RLE" in field
  literature**; both refer to the same Appendix A scheme.
- **The 4xx Optimization-of-Throughput note** (450 ref p. 11): *"The
  communication protocol was designed to allow the data to be transferred
  with only one overhead byte per dot line."* — this is the `<syn>` /
  `<etb>` framing. Skip-lines is the second-tier optimization on top.
- **Comment cleanup elsewhere**: `protocol-550.ts:244-245` documents that
  `compress` is ignored on 550. If/when we add `skipBlankRows`, mirror
  that note for the new option to keep the two protocol paths
  symmetrically self-documenting.
