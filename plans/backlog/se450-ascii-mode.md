# SE450 ASCII command mode — investigation and feasibility

Cross-reference of:

- `LW 450 Series Technical Reference.pdf` (LW 450, 450 Turbo, 450 Twin Turbo, 450 Duo, 4XL — ©2009)
- `LabelWriter SE450 Tech Ref.pdf` (LW SE450 — 76 pages)
- `LW 550 Technical Reference.pdf` (LW 550, 550 Turbo, 5XL — ©2021)

The user asked whether the "ASCII mode" mentioned in some of these references is
a Zebra-style protocol and whether we can / should support it.

## TL;DR

- ASCII command mode is a **single-device feature**: only the
  **LabelWriter SE450** (PID `0x0400`) implements it. The mainstream LW 450
  series has no ASCII mode (raster only, no built-in fonts, no built-in
  barcodes). The LW 550 series has zero mentions of ASCII anywhere in its
  tech ref — pure raster, job-header style.
- It is **not Zebra-like** (no ZPL `^XA…^XZ` mark-up). It's an ESC/POS-style
  byte protocol: control characters carry semantics (CR/LF/FF), single-byte
  ESC + letter or GS + letter command codes, immediate (portrait) vs
  page-buffered (landscape) modes. The lineage is the original
  *LabelWriter SE* printer that the SE450 supersedes — a 1990s thermal-printer
  ASCII protocol family, similar to Epson ESC/POS receipt printers.
- Recommendation: **document support, defer implementation.** ROI is low —
  one SKU out of 14 in the registry, niche embedded/serial use cases — and it
  doesn't fit the cross-driver `print(image, media)` interface cleanly. If
  we ever do implement, a USB-only text+barcode subset is a sensible MVP and
  RS-232 + landscape mode are later phases.

---

## Where each PDF stands on ASCII mode

### LW 450 series — no ASCII mode

The 450 reference uses the word "ASCII" only as a way to spell control bytes
(`ASCII <esc> character, 0x1b`, `ASCII <syn> character (0x16)`) — not to
describe a print mode. Confirmed by command list and device intro:

> *"There are no built-in fonts. The host computer is responsible for
> sending commands and data to the printer to form each individual raster
> line of data."*  — LW 450 tech ref, p. 7

"Barcode and Graphics Print Mode" on the 450 is just a 300×600 dot-stepping
density mode for raster — the host still rasterizes everything.

### LW 550 series — no ASCII mode

The 550 reference contains **zero** mentions of "ASCII". The 550 has only
two output mode flags (`ESC h` Text vs `ESC i` Graphics — both still raster)
and one speed flag (`ESC T` Normal/High). No fonts, no barcodes in firmware.
Same architectural model as the 450: the host rasterizes; the printer
prints dots.

### LabelWriter SE450 — full ASCII mode + raster mode

The SE450 is the outlier:

> *"Featuring both RS-232 serial and USB connections and including both an
> ASCII command set as well as raster printing modes, this printer can fit
> a wide variety of uses … the printer can be connected and driven entirely
> by ASCII Escape commands. This makes the LabelWriter SE450 an ideal
> printer to use in embedded applications, including medical devices, paint
> matching systems, and so on."*

So the SE450 carries **two parallel protocols** in firmware:

1. **Raster mode** — 100 % compatible with LW 450 (minus `ESC G`
   short-form-feed and `ESC q` roll select; SE450 is single-roll). Today
   our 450 raster encoder works on it over USB.
2. **ASCII mode** — built-in fonts, built-in barcodes, immediate or
   page-buffered output. Selected implicitly by which commands you send;
   no mode-switch escape needed.

USB PID: `0x0400` (already in `devices.ts:81`).
Serial: RS-232 with XON/XOFF flow control, 1200 → 115.2K baud.

---

## What "ASCII mode" actually is on the SE450

Programming model from the SE450 reference:

- **8-bit byte stream.** Bytes 0x20–0xFF are printable; bytes < 0x20 are
  control characters with semantic meaning (CR, LF, FF, HT, SYN, ETB, …);
  ESC (0x1B) and GS (0x1D) introduce multi-byte command sequences.
- **Built-in fonts (5).** `ESC T`, `ESC U`, `ESC M`, `ESC P`, `ESC S`
  select 7 / 10 / 12 / 16 / 20 cpi monospace fonts. Modifiers: `SO`
  double-wide, `GS DC2` double-height, `GS RS` inverse.
- **Two orientations.**
  - *Portrait (immediate)* — every completed object (text line, barcode)
    prints as soon as it terminates; no two objects can share a row.
  - *Landscape (page-buffered)* — selected via `GS V`, sized via `GS t`.
    Objects accumulate in a buffer; `FF` flushes the page. Lets you place
    multiple objects on the same line via `ESC X` (h-pos) / `ESC Y`
    (v-pos), draw lines (`GS l`), and embed graphics (`GS *` — limited to
    256 dots wide).
- **Object types:** text object (terminated by CR/LF), barcode object
  (auto-terminates after the GS k payload), graphic object (landscape
  only, GS \*), line object (landscape only, GS l).
- **Built-in barcode symbologies (`GS k n`):**

  | n  | Symbology                          |
  |----|-------------------------------------|
  | 0  | POSTNET                             |
  | 2  | EAN/UPC Auto (m=6..18 selects variant) |
  | 4  | Code 3 of 9                         |
  | 5  | MSI Plessey                         |
  | 6  | Codabar                             |
  | 7  | Interleaved 2 of 5                  |
  | 8  | Code 128-A                          |
  | 9  | Code 128-B                          |
  | 10 | Code 128-C                          |
  | 11 | Code 128-Auto                       |
  | 12 | Bookland EAN                        |
  | 13 | SISAC                               |
  | 14 | PDF417                              |
  | 15 | Data Matrix (203×203 only)          |

- **Resolution modes:** `ESC y` 203×203 dpi, `ESC z` 136×203 dpi (note:
  SE450 head is 203 dpi — *different from the 300-dpi LW 450/550 family*;
  see §"Hidden surprise: dpi" below).
- **Status / debug:** `GS S` and `ESC A` return printer status; `GS ~`
  enters a hex/ASCII dump debug mode.
- **Forward compat with raster:** `ESC *`, `ESC @`, `ESC A`, `ESC B`,
  `ESC D`, `ESC E`, `ESC L`, `ESC Q`, `ESC a`, `ESC c/d/e/g`, `ESC F 1 n`,
  `SYN`, `ETB` are all also defined for raster compatibility — the SE450
  shares command bytes between protocols where it can.

### Is this Zebra-like?

No.

- **Zebra ZPL** is text mark-up: `^XA ^FO20,20 ^A0N,30,20 ^FDhello^FS ^XZ`
  — a complete label as a stream of `^`-prefixed fields, parsed as a
  document.
- **Zebra EPL2** is closer to ESC/POS but still line-oriented commands
  like `T 10,20,0,3,1,1,N,"hello"` followed by `P1` to print.
- **SE450 ASCII** is a byte-level imperative protocol: send the bytes
  `ESC P` to switch font, then send `Hello\r\n` and the printer immediately
  begins printing those characters in 16 cpi. No document framing, no
  field markup. The closest commercial relative is **Epson ESC/POS** for
  receipt printers — same control-char + ESC/GS letter-code pattern.

So if we ever support it we should NOT call it "ZPL-like" in docs; it's an
ESC/POS-shaped protocol descended from the original DYMO LabelWriter SE.

---

## What the current driver does with the SE450

`packages/core/src/devices.ts:76-89` registers the SE450 with:

```ts
LW_SE450: {
  name: 'LabelWriter SE450',
  vid: 0x0922,
  pid: 0x0400,
  headDots: 672,
  bytesPerRow: 84,
  // todo: is serial device?, might work different
  // Bi-directional, RS232 Serial (1200 to 115.2K baud)
  protocol: '450',
  network: 'none',
  nfcLock: false,
}
```

So today:

- Discovery + USB transport: works (it's the same VID, standard USB Printer
  Class).
- `encodeLabel()` dispatches the 450-protocol path: `ESC @`, `ESC D <bpp>`,
  `ESC <density>`, `ESC h/i`, `ESC L <len>`, raster rows wrapped in `0x16`,
  `ESC E` per copy. The SE450 spec says it accepts all of these in raster
  mode — *USB raster printing should already work*.
- Serial (RS-232) transport: not implemented anywhere.
- ASCII command mode: not implemented anywhere.

The TODO comment in `devices.ts` deserves to be replaced with an explicit
statement of capability ("USB raster supported; RS-232 and built-in
ASCII/barcode mode not implemented — see plans/backlog/se450-ascii-mode.md").

### Head geometry — possible bug to verify

The SE450 reference says the printer is **203 dpi** with `ESC y` (203×203)
and `ESC z` (136×203) modes. The LW 450/550 family is **300 dpi**.

`devices.ts` records `headDots: 672, bytesPerRow: 84` for the SE450 — those
numbers come from 300-dpi-style LW 450 geometry. If the SE450 head is
actually 203 dpi, the dot count for a given physical width is different:
2.25" head × 203 dpi ≈ 457 dots, not 672. **This is independent of the
ASCII-mode question and should be cross-checked against a real device** —
if our descriptor lies about head width, even raster-mode printing will be
wrong proportionally. (Possible counter-evidence: the SE450 might run a
672-dot 300-dpi head in raster mode and a 203-dpi virtual-grid mode for
ASCII. The reference is ambiguous on the physical print head; clarifying
this is a prerequisite for either workstream.)

Action item out of scope here but worth flagging: **verify SE450 native
resolution before doing anything else with this device.**

---

## Why we might want ASCII mode

1. **Embedded / driverless use cases.** The reference explicitly markets
   the SE450 for medical devices, paint mixing, etc. — hosts that have no
   rasterizer (no Canvas, no font engine, no PNG decoder). With ASCII mode
   you can print a label with ~50 bytes:
   ```
   ESC P "John Smith"  CR LF  "123 Main St"  CR LF  "Springfield"  FF
   ```
   vs ~50 KB of raster bitmap.
2. **Sharper barcodes.** Built-in `GS k` barcodes are constructed from
   exact dot patterns at print time — no host-side bitmap quantization.
   For small UPC/EAN/Code-128 barcodes this matters.
3. **No JS barcode dependency.** Our raster path needs the host to
   rasterize barcodes (today via the consumer's Canvas / barcode lib).
   Built-in symbologies remove that.
4. **RS-232 is viable.** At 9600 baud, raster is unusable (a single 89×28
   mm address label is ~70 KB → 70 s wall-clock); ASCII is fine (kilobytes,
   sub-second).
5. **Cleanup of the existing TODO** in `devices.ts` either way — even if
   we defer implementation, we should rewrite the comment with the actual
   facts.

## Why we might not

1. **One SKU.** Only the SE450 has it. The 14-device registry, the
   docs/api landing page, the 550-series work — none of it benefits.
   No transferability to the 550 effort.
2. **Doesn't fit `PrinterAdapter.print(image, media)`.** Our cross-driver
   contract takes a bitmap. ASCII mode is a structured-label model
   (objects, lifecycle, landscape page buffer). Supporting it cleanly
   means a *parallel* API on the SE450 adapter: `printAscii(label)` taking
   a typed structure of text/barcode/line/graphic items, plus state
   machine work for the immediate-vs-buffered semantics. That's a
   different shape from the rest of the project.
3. **Built-in fonts are limited.** Five fixed cpi values (7, 10, 12, 16,
   20) of bitmappy monospace. Anything else (custom font, kerned text,
   non-Latin) falls back to raster anyway — and at that point you might
   as well do the whole label as raster.
4. **Encoding / codepage gotchas.** Extended ASCII 0x80–0xFF is supported
   per docs but the codepage isn't named. Real-world use will hit
   "the ø in Brønshøj prints wrong" issues that we'd have to map by
   hand from a Dymo codepage table.
5. **Serial transport is a separate workstream.** RS-232 needs a node
   `serialport` dependency, WebSerial in the browser (Chromium-only,
   gated behind a user gesture, no Safari), and platform-specific
   permissions on Linux/macOS. ASCII-on-USB alone doesn't unlock the
   embedded use cases that motivate ASCII mode in the first place.
6. **Maintenance.** Barcode symbology validation (each symbology has its
   own data restrictions — Code 39 charset, UPC checksum, PDF417 row/col
   constraints, Data Matrix size table), object lifecycle correctness
   (don't issue font changes mid-text-object), and landscape page math
   are real work to keep correct without hardware on hand.

## Net judgement

Defer. The strongest argument for is "RS-232 SE450 in an embedded
context" — a real but niche audience that we have no evidence is asking
for it. The strongest arguments against are interface-shape mismatch and
ROI. The right next steps are documentation and verification, not code.

---

## If we do build it: a phased plan

### Phase 0 — verify, document, decide (no code)

1. Capture an SE450 packet trace from the official Dymo driver to confirm
   real-world raster command sequences (also useful for §"Head geometry"
   above).
2. Confirm SE450 native head resolution (203 vs 300 dpi) and update
   `devices.ts` if needed. **Do this regardless** of the ASCII-mode work.
3. Replace the `// todo: is serial device?` comment with a concrete
   capability statement.
4. Add an SE450 section to `docs/devices.md` (or wherever device coverage
   is documented) noting "USB raster supported; serial / ASCII /
   built-in-barcodes not implemented — open issue to track".

### Phase 1 — minimal viable ASCII path (USB only)

Scope: text + simple barcode, portrait only, single label.

- `packages/labelwriter-core/src/ascii.ts` (new module — keep it isolated
  from the raster `protocol.ts` so the two protocols don't drift into each
  other). Builders for `ESC T/U/M/P/S` font selection, `ESC X` / `ESC Y`
  positioning, `GS k` barcode (subset: Code 39, Code 128, EAN-13).
- A typed label model:
  ```ts
  type AsciiLabelItem =
    | { kind: 'text'; text: string; font: '7cpi'|'10cpi'|'12cpi'|'16cpi'|'20cpi'; doubleWide?: boolean; doubleHeight?: boolean }
    | { kind: 'barcode'; symbology: 'code39'|'code128'|'ean13'; data: string; heightDots?: number }
    | { kind: 'feed'; lines: number };
  ```
- A new SE450-specific adapter method `printAscii(items)` (or a tagged
  union into `print()` — but cleaner to keep the bitmap and structured
  paths separate in the adapter).
- Charset encoder: ASCII subset (0x20–0x7E) only at first; emit a clear
  error for non-ASCII input. Defer the extended-ASCII codepage table
  until someone asks.
- Tests: golden-byte tests for each builder; no hardware.

### Phase 2 — full feature parity (USB)

- Remaining symbologies (UPC variants, POSTNET, Codabar, Interleaved 2 of 5,
  PDF417, Data Matrix). Each needs symbology-specific input validation
  (Code 39 charset, UPC checksum digit, PDF417 row/col bounds, Data Matrix
  size lookup table from the reference).
- Landscape mode: `GS V`, `GS t`, page lifecycle (objects accumulate, `FF`
  flushes), `ESC X`/`ESC Y` placement, `GS l` lines, `GS *` graphics.
- Multi-label jobs / form-feed semantics.
- Status parser for `GS S` / `ESC A` (the SE450 status byte layout differs
  from LW 450 — needs its own parser).
- Hex/ASCII debug mode passthrough (`GS ~`) as a developer aid.

### Phase 3 — serial transport

- Node: `SerialTransport` in `@thermal-label/transport/node` wrapping the
  `serialport` package; XON/XOFF flow control as specified; baud
  negotiation.
- Web: WebSerial (`navigator.serial`) wrapper in
  `@thermal-label/transport/web`. Chromium-only; document the
  compatibility gap.
- `discovery.ts` extension to enumerate serial ports and probe for SE450
  (probably via `ESC V` Return Firmware Revision — the SE450 returns a
  10-character identifier).

### Phase 4 — codepage / i18n

Map the SE450's extended-ASCII range to a named codepage so non-Latin
input round-trips correctly. Until then, ASCII path errors out on
non-printable input rather than silently producing garbage.

---

## Other findings worth recording

- **`ESC G` and `ESC q` not supported on SE450.** The current 450 raster
  encoder emits `ESC G` (short form feed) only via `buildShortFormFeed()`,
  which isn't wired into `encodeLabel()` today, so we're accidentally
  safe. The `ESC q` (Select Roll) path **is** wired — passing
  `options.roll` to `print()` against an SE450 will emit a command the
  SE450 doesn't understand. Cheap fix: gate `buildSelectRoll` on the
  device having more than one roll (Twin Turbo / 450 Duo only).
- **SE450 `ESC L` is "Set Feed Length", same shape as LW 450** (`ESC L
  n1 n2`). This is one place where the 450 raster-style command builder
  is correct for SE450 but *wrong* for LW 550 (where `ESC L` is a mode
  flag, per the 550 plan in `support_550_devices.md`). Worth noting that
  the protocol field on the device descriptor is doing real work and
  should not be conflated with "is this an LW-family printer".
- **ESC \* meaning differs.** On 450/SE450 raster path, `ESC *` is
  "Restore Default Settings". On the 550, `ESC *` is "Restore Print
  Engine Factory Settings". Same intent, similar enough to share — but
  another reminder that re-using command bytes across protocol
  generations is a footgun.
