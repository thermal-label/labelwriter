# Duo Tape Protocol

This page documents the wire protocol of the **LabelWriter Duo's tape
engine** (`engine.protocol === 'd1-tape'`). The Duo is a dual-engine
chassis: a 672-dot label engine on `bInterfaceNumber 0` (handled by
[LW 450](./lw-450)) and a 96- or 128-dot tape engine on
`bInterfaceNumber 1`, documented here.

::: info Source
The byte sequences below are sourced from _DYMO LabelWriter 450 Series
Technical Reference_, **Appendix B (pp. 23–25)**. The PDF is the
authoritative reference; this page summarises what the driver actually
emits and parses. The reference document is **not** redistributed —
DYMO publishes it from their support site.
:::

::: tip Related pages

- [LW 450](./lw-450) — the Duo's label-side engine.
- [LabelManager D1 protocol](https://thermal-label.github.io/labelmanager/protocol)
  — closely related protocol on the LabelManager line. See
  [Relationship to LabelManager D1](#relationship-to-labelmanager-d1).
- [Protocol overview](./) — index of all protocols implemented here.
- [Core](../core) — the TypeScript API.
  :::

## Models and engines

| Chassis             | Tape head dots | Wire-protocol slug |
| ------------------- | -------------: | ------------------ |
| LabelWriter Duo 96  |             96 | `d1-tape`          |
| LabelWriter Duo 128 |            128 | `d1-tape`          |

Both Duo engines share `vid:pid = 0x0922:0x0023`. The chassis exposes
two USB Printer-class interfaces; the tape engine is on
`bInterfaceNumber 1`. Engines are addressed by **interface number**,
not by an `ESC q` byte.

## USB topology

```
Configuration 1
  Interface 0  (label engine — see LW 450)
  Interface 1  Printer class — TAPE ENGINE
    Endpoint OUT  Bulk  (print data)
    Endpoint IN   Bulk  (8-byte status replies)
```

Open the right interface with
`UsbTransport.open(0x0922, 0x0023, { bInterfaceNumber: 1 })`. The
driver reads `engine.bind.usb.bInterfaceNumber` from the registry to
route automatically.

## Status — `ESC A`

```
1B 41
```

Returns **8 bytes**, but only **byte 0** carries data on current Duo
firmware. Bits 1–7 are reserved for future use; the driver captures
all 8 in `rawBytes` for forward compat and only branches on byte 0.

| Bit | Meaning when set                         |
| --: | ---------------------------------------- |
|   2 | General error (motor stalled / tape jam) |
|   4 | Cutter jammed (blade may be exposed!)    |
|   6 | Cassette inserted                        |

A healthy idle printer returns `0x40` (cassette present, no errors).

::: warning Cutter-jam safety
PDF p. 25 calls out specifically: _"the cutter blade is not retracted
and may present a very sharp, dangerous edge."_ The driver maps bit 4
to a distinct `cutter_jam` error code rather than the generic
`paper_jam` so UIs can warn the user before they reach into the
cassette bay.
:::

## Print job structure

Per copy:

```
ESC @                — reset
ESC C <selector>     — set tape type (0..12, palette / heat profile)
ESC D <bytesPerLine> — set raster row width
SYN <row>            — one raster line (repeated)
SYN <row>
…
ESC E                — cut tape (mandatory at end)
```

There is no feed-without-cut command — the tape engine **always cuts**
at the end of every label.

### `ESC @` — reset (`1B 40`)

Resets the engine to defaults. Always the first command in a copy.

### `ESC C <selector>` — set tape type (`1B 43 nn`)

`selector` is a value in `0..12` from the palette table on PDF p. 24:

| `n` | Cassette type           |
| --: | ----------------------- |
|   0 | Black on white / clear  |
|   1 | Black on blue           |
|   2 | Black on red            |
|   3 | Black on yellow         |
|   4 | Black on green          |
|   5 | Black on transparent    |
|   6 | White on black          |
|   7 | White on clear          |
|   8 | Black on silver         |
|   9 | Black on gold           |
|  10 | White on red            |
|  11 | Black on flexible white |
|  12 | Red on white            |

The byte tells the firmware **what cassette is loaded** so it can pick
the right strobe profile — it does **not** change the printed ink
(the colour comes from the cassette itself). The driver derives the
selector from the loaded cassette's media descriptor and defaults to
`0` (black-on-white/clear) when omitted.

### `ESC D <n>` — set bytes per line (`1B 44 nn`)

`n` is the row width in bytes — `engine.headDots / 8`. Maximum is
`12` for the 96-dot Duo and `16` for the 128-dot Duo. Out-of-range
values are silently clamped by the firmware; the driver throws a
`RangeError` to surface caller bugs early.

### `SYN <row bytes>` — raster row (`16 …`)

```
16 b0 b1 ... b(N-1)
```

`0x16` is the SYN opcode followed by exactly `N` payload bytes
(matching the last `ESC D` value). Bit 7 of byte 0 is the leftmost
dot at the top of the head; rows advance with the feed.

The driver right-pads (or crops) the bitmap to `engine.headDots`
before emitting rows, so each `SYN` payload is exactly `headDots / 8`
bytes.

### `ESC E` — cut tape (`1B 45`)

Cuts the tape and ejects. **Mandatory at the end of every label** —
the Duo tape engine has no feed-without-cut equivalent. Multi-copy
jobs simply repeat the full per-copy block (reset → tape type → bpl
→ rows → cut) for each copy.

## Relationship to LabelManager D1

The `d1-tape` slug names the same wire-format family used by the
[LabelManager line](https://thermal-label.github.io/labelmanager/protocol):
both share the `SYN`-row framing and the `ESC C` / `ESC D` opcodes
described above. The two diverge in three places:

| Aspect                     | LabelManager (d1-tape)                | LabelWriter Duo (d1-tape)            |
| -------------------------- | ------------------------------------- | ------------------------------------ |
| Cut command                | `ESC G` / `ESC A` (`1B 47` / `1B 41`) | **`ESC E`** (`1B 45`)                |
| Tape-type byte (`ESC C n`) | `n = 0` (always — single tape mode)   | `n = 0..12` (palette selector)       |
| Status reply length        | **1 byte** (busy / no-tape / low)     | **8 bytes** (only byte 0 used today) |

Because of the cut and status divergence, the driver keeps `duo-tape.ts`
and `duo-tape-status.ts` as their own modules rather than reusing
`@thermal-label/labelmanager-core`. Both repos register `d1-tape` as
the engine protocol slug; the docs site disambiguates by the device's
family (`labelmanager` vs `labelwriter`) when building per-device
protocol links.

## WebUSB

Same protocol as USB. The browser package selects
`bInterfaceNumber 1` for the tape side, `transferOut` for the encoded
job, `transferIn(8)` for the status reply.

## References

- _DYMO LabelWriter 450 Series Technical Reference_, Appendix B
  (pp. 23–25). Cited inline; not redistributed.
- Implementation in this driver:
  - `packages/core/src/duo-tape.ts` — encoder.
  - `packages/core/src/duo-tape-status.ts` — 8-byte status parser.
