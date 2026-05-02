# labelwriter — LabelWriter 450 Duo tape-side support

> The LabelWriter 450 Duo is two printers in one chassis: a regular
> 450-protocol label-roll printer **and** a 128-dot tape printer that
> takes D1 cassettes. The label side already works through this
> driver. The tape side does not. This plan figures out where the
> tape protocol lives in our package graph, because the answer is
> non-obvious — the same D1 hardware is already implemented in the
> sibling `../labelmanager` repo.
>
> **Schema work has landed via
> [migrate-to-contracts-shape.md](./migrate-to-contracts-shape.md).**
> Each Duo entry (`LW_DUO_96`, `LW_DUO_128`, `LW_450_DUO`) now declares
> two engines: `role: 'label'` with protocol `lw-450` on
> `bind.usb.bInterfaceNumber: 0`, and `role: 'tape'` with protocol
> `d1-tape` on `bind.usb.bInterfaceNumber: 1`. The contracts resolver
> automatically returns Duo entries with `engines.tape.drivable: false`
> until a `d1-tape` protocol module is registered. What remains is the
> protocol module, the transport-interface routing, and the adapter
> wiring — covered in §5 below.

---

## 1. Motivation

The Duo is unusual: per the manual (page 14), it enumerates as a
**composite USB device** that presents two distinct printer
interfaces. From the host's point of view there are two printers, and
each has its own command set:

- **Label side** — full LabelWriter 450 command set, 672-dot head,
  300 dpi. Already supported by `LabelWriterPrinter`.
- **Tape side** — a *subset* of the LabelWriter command set plus
  three tape-specific commands (Set Tape Type, Cut Tape, an
  8-byte status response with a cassette-presence bit). 128-dot head,
  180 dpi, 6/9/12/19/24 mm D1 tape cartridges. **Not supported.**

The architectural question is the load-bearing one. Mechanically the
tape protocol is small (Appendix B is only five pages). The trouble
is that we already have a working D1 implementation in
`/home/mannes/thermal-label/labelmanager/packages/core` — same Dymo
parent company, same D1 cartridges, very similar protocol. The
question is whether to reuse it, copy it, or treat the Duo's tape
side as a third thing.

---

## 2. Gap

### 2.1 What's missing today

- No discovery of the Duo's second USB interface. The current
  `LW_450_DUO` descriptor (`packages/core/src/devices.ts:114-125`)
  has one `pid` (`0x0023`). The composite enumeration means the
  tape side is a separate USB interface (different `bInterfaceNumber`
  on the same device), which `enumerateUsbDevices` in
  `packages/node/src/discovery.ts:17-45` does not look at.
- No tape-specific protocol module. The label encoder
  (`protocol.ts`) is hard-coded to 84-bytes-per-line / form-feed
  semantics. The Duo tape side wants `bytesPerLine ≤ 16` and
  `<esc> E` means **cut**, not form feed.
- No tape-aware media descriptors in `media.ts`. The
  `LabelWriterMedia` type splits on `'die-cut' | 'continuous'`; D1
  tape is its own thing (continuous, but with a cartridge-reported
  width and a colour palette).
- No way to model "this physical device exposes two logical
  printers" in the discovery contract. `DiscoveredPrinter` (in
  `@thermal-label/contracts`) is one device → one descriptor.

### 2.2 Protocol-by-protocol comparison: Duo tape vs LabelManager core

The PDF Appendix B and `../labelmanager/packages/core/src/protocol.ts`
both describe the same general shape: ESC-prefixed command bytes,
`<syn>`-prefixed raster rows, a status byte. The differences:

| Concern | Duo tape (PDF App. B) | LabelManager (`labelmanager-core`) |
| --- | --- | --- |
| Reset | `1B 40` | `1B 40` |
| Tape type | `1B 43 n`, n=0..12 colour selector | `1B 43 00` (always 0 — single-ink) |
| Bytes per line | `1B 44 n`, max 16 (128-dot head) | `1B 44 n`, max 8/12/16 by tape width |
| Print row | `<syn> + row` | `<syn> + row` (HID-framed on PnP) |
| Cut / feed | `<esc> E` (cut) | `<esc> G` (feed) — **different opcode** |
| Status request | `<esc> A` → 8 bytes | `<esc> A` → 1 byte — **different reply length** |
| Status bits | byte 0: GE bit 1, CJ bit 4, CASSETTE bit 6 | byte 0: ready bit 0, no-tape bit 1, low bit 2 |
| Transport | USB Printer class (raw bulk) | USB Printer class **or** HID (`buildPrinterStream` vs `encodeLabel`+`toReport`) |
| Compressed (`<etb>`) | Not supported on Duo tape | Not used |

So the wire format is **mostly** the same — but the cut command, the
status response shape, and the tape-type colour palette diverge. The
LabelManager code already has a `buildPrinterStream` path that
emits raw printer-class bytes (`labelmanager/packages/core/src/protocol.ts:114-138`)
that is *very close* to what the Duo tape side wants — close enough
that the differences read as parameters, not as a different protocol.

---

## 3. Architectural options

### Option A — `include` (cross-package import)

`labelwriter-core` adds a peer-dependency on
`@thermal-label/labelmanager-core` and calls into its
`buildPrinterStream` for the Duo tape side, parameterising the
cut/feed opcode and status length.

**Pros**
- Zero duplication.
- Bug fixes to the shared D1 protocol propagate to both.

**Cons**
- Muddies the family contract. `labelwriter-core` is the
  "LabelWriter family" package; pulling in a `labelmanager-*`
  dependency is a category error from a consumer's point of view.
- Cross-package coupling means a LabelManager-side breaking change
  blocks LabelWriter releases. The two cores currently version
  independently.
- Introduces a published-package cycle risk if `labelmanager-core`
  ever needs anything from `labelwriter-core` (it doesn't today,
  but the asymmetry is uncomfortable).

### Option B — Absorb (copy the protocol)

Fork the relevant subset of LabelManager's protocol code into a new
`packages/core/src/duo-tape.ts` (and `duo-tape-status.ts`,
`duo-tape-media.ts`).

**Pros**
- No cross-package dependency. `labelwriter-core` stays
  family-pure.
- Free to adapt the Duo's specifics (cut opcode, 8-byte status,
  colour-palette tape selector) without negotiating with the
  LabelManager maintainer hat.
- Smaller blast radius for D1-specific bug fixes — they stay
  scoped to the package whose user reported them.

**Cons**
- Code duplication (the row-emission loop, head-aligned padding,
  scaling). Roughly 80–120 LOC of overlap.
- Drift risk: a fix in `labelmanager-core/protocol.ts` that should
  also apply here will not propagate automatically.
- Two test suites covering "the same" behaviour.

### Option C — Extract a shared D1-protocol package (the third option)

Create `@thermal-label/dymo-d1-protocol` (name to be bikeshed-tested)
containing the small overlap: head-aligned bitmap padding, the
ESC C / ESC D / SYN-row primitives, a generic status-response shape.
Both `labelmanager-core` and `labelwriter-core` depend on it; each
adds its own family-specific wrappers (cut vs feed, status-byte
parsing, HID framing for the PnP, etc.).

**Pros**
- DRY without the family-contract-muddling problem of Option A.
  Both family packages depend on a *third*, family-neutral package
  — that reads cleanly: "shared low-level Dymo D1 raster".
- The shared package is an obvious place for future Duo-and-PnP
  features (colour-palette validation, feed-margin defaults).
- Clearest story for downstream readers: "the labelwriter Duo's
  tape side and the labelmanager PnP share their raster
  primitives; here is the shared module".

**Cons**
- A third workspace package to maintain, version, publish.
- Extraction has to happen *before* the Duo work can start, or we
  end up with three copies (this package, labelwriter-core,
  labelmanager-core) during the migration window.
- The shared surface is small enough that the abstraction tax may
  exceed the duplication tax.

### Option D — Two drivers, one physical device

Treat the Duo as enumerating into two `DiscoveredPrinter` entries:
one `family: 'labelwriter'` for the label side (existing path),
one `family: 'labelmanager'` for the tape side (handled by the
existing `DymoPrinter` from `labelmanager-node`). Discovery
recognises `vid=0x0922 pid=0x0023` and emits both entries.

**Pros**
- Each family package stays pure. No code crosses the family
  boundary in either direction.
- Reuses the existing, tested `DymoPrinter` for the tape side
  with zero new protocol code.
- Honest reflection of how the firmware presents itself — the
  device *is* a composite USB printer.

**Cons**
- The tape side of the Duo is **not** literally a LabelManager —
  the cut opcode (`<esc> E` vs `<esc> G`) and status response
  length (8 bytes vs 1 byte) differ. We'd need to teach
  `labelmanager-core` about a "duo-flavoured" variant, which
  re-introduces the muddying we were trying to avoid, just
  pointing the other direction.
- Surprising for users: one physical printer shows up as two
  entries with two different family labels.
- Breaks any UI that groups by physical device.

---

## 4. Recommendation

**Option B (absorb), with a deliberate door left open to Option C.**

Reasoning:

- The protocol differences (cut opcode, 8-byte status, colour
  palette) mean Option D's "it's just a LabelManager" framing is
  wrong, and Option A inherits LabelManager's release cadence for a
  feature that conceptually belongs to the LabelWriter family.
- Option C is the architecturally cleanest answer, but the shared
  surface (~100 LOC of bitmap-padding + raster-row emission) is
  too small to justify the package-extraction cost up front.
- Option B gets us a working Duo without a workspace shuffle. If a
  third Dymo-D1 consumer ever shows up (a plausible future:
  LabelManager 500TS, LabelWriter 4XL Duo if it exists, etc.) the
  duplication crosses the threshold and we extract Option C then.

The plan below assumes Option B. If the team prefers Option C, the
implementation steps are largely the same — the code just lives in
a different workspace package.

---

## 5. Proposed steps (assuming Option B)

### 5.1 Device descriptor — DONE

Subsumed by the migrate-to-contracts-shape PR. Each Duo entry in
`packages/core/data/devices/` now declares two engines with
`bind.usb.bInterfaceNumber: 0` (label) and `bind.usb.bInterfaceNumber:
1` (tape). The tape engine carries `protocol: 'd1-tape'`, `dpi: 180`,
`headDots: 128`, and `mediaCompatibility: ['d1']`.

The exact `bInterfaceNumber` values are still **unconfirmed** —
they're best-effort `0` / `1`. Validate against `lsusb -v` output
from a real Duo before the protocol module ships; if interfaces are
swapped, only the data file changes (no code touches required).

### 5.2 Tape protocol module

New `packages/core/src/duo-tape.ts`:

```ts
export function buildDuoReset(): Uint8Array;
export function buildDuoSetTapeType(colour: number): Uint8Array;   // 0..12 from PDF p.24
export function buildDuoBytesPerLine(n: number): Uint8Array;       // n ≤ 16
export function buildDuoCutTape(): Uint8Array;                     // ESC E
export function buildDuoStatusRequest(): Uint8Array;               // ESC A
export function encodeDuoTapeLabel(bitmap, options): Uint8Array;
```

The implementation is largely a copy-and-adapt of the corresponding
functions in
`/home/mannes/thermal-label/labelmanager/packages/core/src/protocol.ts`
— specifically the `buildPrinterStream` path (raw printer-class
bytes, not HID reports — the Duo's tape interface is USB Printer
class per the manual). Adaptations:

- Swap `<esc> G` (form feed) for `<esc> E` (cut tape).
- Tape-type byte takes a colour index 0..12, not always 0.
- Use the LabelManager `prepareForEmission` helper as a model for
  head-aligned padding; this 30-line helper is a reasonable copy
  candidate. (If we extract Option C later, this is the first
  function to move.)
- Parameterise the print-head dot count (96 or 128). Per PDF
  page 23, `LW_DUO_96` has a 96-dot head with bytes-per-line max
  12; `LW_DUO_128` and `LW_450_DUO` have a 128-dot head with max
  16. `buildDuoBytesPerLine` and `encodeDuoTapeLabel` take the
  head size as input; clamp `bytesPerLine` to `(headDots / 8)`.
  The adapter sources this from `engine.headDots`.

### 5.3 Tape status parser

New `packages/core/src/duo-tape-status.ts`:

```ts
export function parseDuoTapeStatus(bytes: Uint8Array): PrinterStatus;
export const DUO_TAPE_STATUS_BYTE_COUNT = 8;
```

Bit layout per PDF p.25:

- Bit 6 (CASSETTE) → cassette presence (1 = present)
- Bit 4 (CJ) → cutter jammed
- Bit 2 (GE) → general error / motor stall / tape jam
- Other bits ignored

Map cassette-absent to `{ code: 'no_media', ... }`, CJ to
`{ code: 'cutter_jam', ... }`, GE to `{ code: 'printer_error', ... }`.
No contracts change required — `PrinterError.code` is already a
free-form string and `'cutter_jam'` is literally one of the
worked examples in `contracts/src/status.ts:53`. The cutter-jam
state warrants its own code (rather than collapsing into
`paper_jam`) because of the safety caveat the PDF calls out on
page 25: *"the cutter blade is not retracted and may present a
very sharp, dangerous edge. Use caution when clearing any sort
of printer jam."* That hazard warrants distinct UI treatment.

Per PDF page 25, the parser only interprets byte 0; bytes 1-7 are
reserved-for-future-use on current Duo firmware. Capture all 8
bytes in `rawBytes` for forward compat, but only branch on byte 0.

### 5.4 Tape media descriptors

Extend `LabelWriterMedia` to allow `type: 'tape'` (or split into a
new `LabelWriterTapeMedia` interface — preferred, because tape
carries `tapeWidthMm` and a colour-palette field that don't apply
to die-cut/continuous label rolls). Add registry entries for the
five Duo-supported widths (6/9/12/19/24 mm).

There's a real question about whether to import the tape media
shape from `labelmanager-core` (`LabelManagerMedia.tapeWidthMm`)
or define a parallel one. Per the Option B framing, we define a
parallel one and accept the duplication. If/when we go to Option
C, this is the second thing to merge.

### 5.5 Discovery + transport routing

The contracts shape already expresses the two sub-printers via
`engines[]` with `bind.usb.bInterfaceNumber`. What's missing is the
runtime piece: `UsbTransport.open(vid, pid)` defaults to claiming
interface 0, so the tape engine has no usable transport today.

Two paths:

1. **Engine-aware transport open**: `UsbTransport.open(vid, pid, {
   bInterfaceNumber })` — additive change to `@thermal-label/transport`.
   `LabelWriterPrinter` resolves `engine.bind.usb.bInterfaceNumber`
   and passes it through. Smallest contracts surface, fits how the
   Duo actually enumerates.
2. **Two `DiscoveredPrinter` entries**: discovery emits two entries
   per Duo (one per engine) with different `connectionId`
   discriminators. Bigger consumer change, exposes compositeness to
   every UI.

Recommendation: (1). The migrate plan's `engines[]` shape already is
the "one device, multiple engines" abstraction; the transport open
just needs the per-engine binding hint piped through.

### 5.6 Driver

`LabelWriterPrinter` exposes an `engines: Record<role, EngineHandle>`
map per the migrate plan's adapter sketch. For a Duo:

- `printer.engines.label` — backed by interface 0, `lw-450`
  protocol, the existing `encodeLabel` path.
- `printer.engines.tape` — backed by interface 1, `d1-tape`
  protocol, the new `encodeDuoTapeLabel` path.

`family` stays `'labelwriter'` on both — the device is a LabelWriter,
the tape side is one of its modes. Each handle carries its own
`PrinterAdapter`-shaped methods (`print`, `getStatus`, `close`); the
parent printer aggregates and delegates `close()` to both.

This shape unifies with the Twin Turbo's eventual `engines.left` /
`engines.right` (see `twin-turbo-support.md`) — same surface, same
runtime resolution, different binds (interface for Duo, address for
Twin).

### 5.7 Tests

- `duo-tape.test.ts` — golden-bytes for reset / set-tape-type /
  bytes-per-line / cut / status-request, parallel to the existing
  `protocol.test.ts`.
- `duo-tape-status.test.ts` — status-byte permutations (cassette
  in/out, cutter jam, general error, ready).
- A discovery test that mocks a USB device with two printer
  interfaces and asserts the contract-level shape (whichever of
  5.5's sub-options we pick).

### 5.8 Out of scope

- LabelWriter 4XL Duo or any future LW-Duo variant — none exist
  at the time of writing.
- Two-side simultaneous printing (label + tape in parallel). The
  USB endpoints are independent so it's physically possible, but
  no current caller wants it and the synchronization story is
  not worth designing speculatively.
- Migrating the LabelManager driver onto the same shared
  primitives (Option C). Tracked as a follow-up; the trigger is
  "a third D1-using driver shows up".

---

## 6. Open questions to resolve before coding

1. **Composite USB interface numbers** — *unresolved*. The PDF
   (page 14) confirms the Duo "is implemented as a Composite USB
   interface" and "will enumerate twice, as two different
   printers", but assigns no `bInterfaceNumber` to either side.
   The data files assume `bInterfaceNumber: 0` (label) / `1`
   (tape). Confirm on real hardware via `lsusb -v` before the
   protocol module ships; if reversed, only the JSON5 entries
   need editing. Note also that there is only one PID (`0x0023`)
   for the Duo — both interfaces share `vid:pid`, so transport-
   layer disambiguation must happen on `bInterfaceNumber`, not
   PID.
2. ~~**Status byte 0 only?**~~ — *resolved by PDF page 25*: "the
   LabelWriter Duo printer only uses the first byte" of the
   8-byte status response, and "bytes 2-7 are reserved for
   future use". The status parser only needs to interpret
   byte 0; capture bytes 1-7 in `rawBytes` for forward compat
   but do not parse them.
3. ~~**Cut vs feed semantics**~~ — *resolved by PDF page 25*:
   `<esc> E` "must be sent at the end of every label". No
   feed-without-cut command exists on the tape side. One tape
   job = one cut. The encoder does **not** need to model
   chained labels with dot-line skips between cuts.
4. **Tape colour palette**: the 13-entry palette in the PDF
   (page 24) is for *tape* identification (what's loaded), not
   for *ink* selection — D1 tape ink is determined by the
   cassette. We should store the palette index on the media
   descriptor, not pass it as a print option, and the `Set Tape
   Type` command should be derived from `media.tapeColour`
   rather than exposed to callers.
5. **96-dot vs 128-dot Duo variants**: the PDF (page 23) and
   the existing registry both confirm two Duo head sizes —
   96-dot (`LW_DUO_96`) with bytes-per-line max of 12, and
   128-dot (`LW_DUO_128` / `LW_450_DUO`) with max of 16. The
   `buildDuoBytesPerLine` helper and `encodeDuoTapeLabel` must
   take the head size as a parameter (not hard-code 16) and
   clamp accordingly. Sourced from `engine.headDots` at the
   adapter layer.
