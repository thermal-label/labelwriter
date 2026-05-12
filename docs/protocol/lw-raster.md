# LW Raster Protocol

The classic LabelWriter raster wire protocol, spoken by DYMO's
LabelWriter 3xx (including 330 Turbo), 4xx (400, 400 Turbo, 450, 450
Turbo, 450 Twin Turbo, 4XL, SE450, Wireless), and the LabelWriter Duo's
label-side engine. The Duo's tape-side engine is a separate
[D1 tape](https://thermal-label.github.io/d1-core/protocol) device.

The 5xx-generation successor uses a different protocol —
see [LW5 raster](./lw5-raster).

## USB topology

Single full-speed USB 2.0 Printer-class device. VID is **`0x0922`**
(DYMO-CoStar); PIDs are listed on the [Hardware](../hardware) page.

```
Configuration 1
  Interface 0 — Printer class (bInterfaceClass 0x07)
    Bulk OUT  (print data)
    Bulk IN   (1-byte status reply)
```

The LabelWriter Duo enumerates as a composite device with two
printer-class interfaces — the label side speaks this protocol, the
tape side speaks D1. No mode-switch is required for any LabelWriter
chassis.

## Opcode vocabulary

| Opcode                                                           | Bytes           | Description                                                      |
| ---------------------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| [`ESC *`](#esc-—-restore-default-settings)                       | `1B 2A`         | Restore default settings.                                        |
| [`ESC @`](#esc-—-reset-printer)                                  | `1B 40`         | Reset all parameters; set Top-of-Form true.                      |
| [`ESC A`](#esc-a-—-get-printer-status)                           | `1B 41`         | Get printer status (1-byte reply).                               |
| [`ESC B`](#esc-b-—-set-dot-tab)                                  | `1B 42 n`       | Set Dot Tab — skip `n` bytes from the left of each row.          |
| [`ESC c`](#esc-c-—-set-print-density-light)                      | `1B 63`         | Set print density Light (75 % strobe duty).                      |
| [`ESC d`](#esc-d-—-set-print-density-medium)                     | `1B 64`         | Set print density Medium (87.5 % strobe duty).                   |
| [`ESC D`](#esc-d-—-set-bytes-per-line)                           | `1B 44 n`       | Set bytes-per-line for the rows that follow.                     |
| [`ESC e`](#esc-e-—-set-print-density-normal)                     | `1B 65`         | Set print density Normal (100 % strobe duty).                    |
| [`ESC E`](#esc-e-—-form-feed)                                    | `1B 45`         | Form feed — advance the printed label to the tear-off bar.       |
| [`ESC f 1 n`](#esc-f-1-n-—-skip-n-lines)                         | `1B 66 01 n`    | Skip `n` lines (0..255).                                         |
| [`ESC g`](#esc-g-—-set-print-density-dark)                       | `1B 67`         | Set print density Dark (112.5 % strobe duty).                    |
| [`ESC G`](#esc-g-—-short-form-feed)                              | `1B 47`         | Short form feed — advance between labels in a multi-label job.   |
| [`ESC h`](#esc-h-—-text-speed-mode)                              | `1B 68`         | Text Speed mode — 300 × 300 dpi (default).                       |
| [`ESC i`](#esc-i-—-barcode-and-graphics-mode)                    | `1B 69`         | Barcode and Graphics mode — 300 × 600 dpi.                       |
| [`ESC L`](#esc-l-—-set-label-length)                             | `1B 4C n1 n2`   | Set label length, big-endian dot count (`n1` = MSB, `n2` = LSB). |
| [`ESC q`](#esc-q-—-select-roll-twin-turbo)                       | `1B 71 n`       | Select roll (Twin Turbo only): `'0'` auto, `'1'` left, `'2'` right. |
| [`ESC V`](#esc-v-—-return-revision)                              | `1B 56`         | Return 10-byte ASCII model + firmware revision string.           |
| [`ETB`](#etb-—-transfer-compressed-print-data)                   | `17` + N        | Transfer one raster line, run-length encoded.                    |
| [`SYN`](#syn-—-transfer-print-data)                              | `16` + N        | Transfer one raster line, uncompressed.                          |

`n` is a single byte unless otherwise noted. All multi-byte counts
are stated explicitly in each opcode's section — `ESC L` is the only
two-byte count, and its order is MSB first.

## Print job structure

A complete job is a single byte stream sent to the OUT endpoint:

```
ESC @                  — reset printer
ESC D bytesPerLine     — set raster row width (default 84 for 672-dot heads)
ESC <density>          — print density (c / d / e / g)
ESC <mode>             — text (h) or graphics (i)
ESC L n1 n2            — set label length, big-endian dot count
[ESC q n]              — select roll (Twin Turbo only)
[per copy]
  [for each row]
    SYN row…           — one raster line, uncompressed
    or
    ETB row…           — one raster line, run-length encoded
  ESC E                — form feed
ESC A                  — get printer status (1-byte reply)
```

`ESC E` after each copy advances the label past the tear bar; emit
`ESC G` between copies and `ESC E` only after the last copy to skip
the reverse-feed step on every label but the last.

Raster rows may be intermixed: any individual row can be `SYN`
(uncompressed) or `ETB` (compressed) regardless of what surrounded
it. Both decode to exactly the bytes-per-line set by the preceding
`ESC D`.

## `ESC *` — restore default settings

```
1B 2A
```

Resets all internal parameters to their defaults. Acted upon when
received. The byte stream the LabelWriter encoder ships uses
[`ESC @`](#esc-—-reset-printer) at the head of a job instead.

*LabelWriter 450 Series Technical Reference*, p. 17.

## `ESC @` — reset printer

```
1B 40
```

Resets Dot Tab, bytes-per-line, label length, and other parameters to
their defaults, and sets Top-of-Form true. Any data still in the
print buffer is discarded. Emitted as the first command of every job.

*LabelWriter 450 Series Technical Reference*, p. 17.

## `ESC A` — get printer status

```
1B 41
```

The printer replies with **one byte** on the IN endpoint. Bit
meanings (1 = condition holds):

| Bit  | Mask   | Meaning                                                |
| ---: | -----: | ------------------------------------------------------ |
|    0 | `0x01` | Ready (paper in, no jam). Always returned as 1.        |
|    1 | `0x02` | Top of Form.                                           |
|    5 | `0x20` | No paper / labels.                                     |
|    6 | `0x40` | Paper jam.                                             |
|    7 | `0x80` | Printer error (jam, invalid sequence, and so on).      |

Bits 2, 3, 4 are reserved. A healthy idle printer returns `0x03`
(Ready + Top of Form). Bit 7 is also set when an out-of-paper
condition is detected.

*LabelWriter 450 Series Technical Reference*, p. 17.

## `ESC B` — set Dot Tab

```
1B 42 n
```

Shifts the starting dot position to the right by `n` bytes (i.e.
`8 × n` dots), effectively widening the left margin. Valid range
`0..83` on a 672-dot head. If `n` is increased, the bytes-per-line
must be decreased by the same amount; the firmware does not
cross-check the two values, so the host must keep them consistent.

*LabelWriter 450 Series Technical Reference*, p. 15.

## `ESC c` — set print density Light

```
1B 63
```

Sets the strobe time to 75 % of the standard duty cycle.

*LabelWriter 450 Series Technical Reference*, p. 19.

## `ESC d` — set print density Medium

```
1B 64
```

Sets the strobe time to 87.5 % of the standard duty cycle.

*LabelWriter 450 Series Technical Reference*, p. 19.

## `ESC D` — set bytes per line

```
1B 44 n
```

`n` is the number of payload bytes that follow each raster opcode
(`SYN` or `ETB`), in the range `1..84` for 672-dot heads. The
default is `84` (`84 × 8 = 672` dots). For the 1248-dot 4XL head the
value is `156`. The firmware does not validate `n` against the head
width; out-of-range values produce undefined output.

*LabelWriter 450 Series Technical Reference*, p. 15.

## `ESC e` — set print density Normal

```
1B 65
```

Sets the strobe time to 100 % of the standard duty cycle. This is
the default.

*LabelWriter 450 Series Technical Reference*, p. 19.

## `ESC E` — form feed

```
1B 45
```

Advances the most recently printed label so it can be torn off at the
tear bar. Because this advances past the next label's starting print
position, a reverse-feed is automatically performed before the next
label prints. In continuous-feed mode (negative `ESC L` value), this
feeds enough dot lines to push the last printed line past the tear
bar instead.

*LabelWriter 450 Series Technical Reference*, p. 16.

## `ESC f 1 n` — skip `n` lines

```
1B 66 01 n
```

Advances the label by `n` lines (0..255), where a "line" is one dot
row at the current resolution (set by [`ESC h`](#esc-h-—-text-speed-mode)
or [`ESC i`](#esc-i-—-barcode-and-graphics-mode)). The literal `0x01`
byte is part of the opcode, not a parameter. Buffered with the print
data so it takes effect inline; emitted once per skip.

*LabelWriter 450 Series Technical Reference*, pp. 17–18.

## `ESC g` — set print density Dark

```
1B 67
```

Sets the strobe time to 112.5 % of the standard duty cycle.

*LabelWriter 450 Series Technical Reference*, p. 19.

## `ESC G` — short form feed

```
1B 47
```

Advances the next label into print position without performing the
reverse-feed step that follows [`ESC E`](#esc-e-—-form-feed). The
previous label remains partially inside the printer and cannot be
torn off. Use between labels in a multi-label job; the final label
needs `ESC E` to reach the tear-off position.

*LabelWriter 450 Series Technical Reference*, p. 16.

## `ESC h` — Text Speed mode

```
1B 68
```

Selects 300 × 300 dpi printing — the default, high-speed mode.

*LabelWriter 450 Series Technical Reference*, p. 18.

## `ESC i` — Barcode and Graphics mode

```
1B 69
```

Selects 300 × 600 dpi printing. The printer steps half as far in
the feed direction per dot row, producing smaller and more precise
dots at the cost of speed. Useful for small barcodes and
detail-sensitive graphics.

*LabelWriter 450 Series Technical Reference*, p. 18.

## `ESC L` — set label length

```
1B 4C n1 n2
```

Sets the label length to a 16-bit dot count in 300ths of an inch.
`n1` is the MSB, `n2` is the LSB. Default `3058` (≈10.2 in).

The label length is the maximum distance the printer travels while
searching for the next top-of-form mark; print lines and feed lines
count toward this distance. It is conventionally set slightly larger
than the true label length to ensure the top-of-form mark is found
before the search is terminated. The firmware does **not** compare
this value against the loaded label stock — the host is responsible
for not overrunning the label area.

Any negative two-byte value (`0x8000..0xFFFF`) puts the printer in
continuous-feed mode, in which `ESC E` and `ESC G` feed a fixed
number of dot lines from the current position rather than seeking a
top-of-form mark.

*LabelWriter 450 Series Technical Reference*, p. 16.

## `ESC q` — select roll (Twin Turbo)

```
1B 71 n
```

Twin Turbo only. `n` selects the source roll:

| Byte           | Selection                                                  |
| -------------- | ---------------------------------------------------------- |
| `'0'` (`0x30`) | Automatic — firmware toggles between rolls as they empty.  |
| `'1'` (`0x31`) | Left roll.                                                 |
| `'2'` (`0x32`) | Right roll.                                                |

In Automatic mode the firmware assumes both rolls carry the same
media.

*LabelWriter 450 Series Technical Reference*, pp. 16–17.

## `ESC V` — return revision

```
1B 56
```

Returns a 10-byte ASCII string on the IN endpoint:

- Bytes 0–6: 7-digit model number (e.g. `93089`).
- Byte 7: lowercase letter (commonly `v`).
- Bytes 8–9: 2-digit firmware version (e.g. `0N`).

Example reply: `98039v0K`.

*LabelWriter 450 Series Technical Reference*, p. 18.

## `SYN` — transfer print data

```
16 b0 b1 ... b(N-1)
```

`0x16` is the SYN opcode. The `N` payload bytes carry one raster line
of pixel data, where `N` is the value set by the most recent
[`ESC D`](#esc-d-—-set-bytes-per-line). Bit 7 of `b0` is the leftmost
dot at the start of the print head; bit 0 of `b(N-1)` is the
rightmost. The data is not length-prefixed — the prior `ESC D` is
the only source of truth for row width.

After receiving `0x16`, the firmware ingests exactly `N` bytes as
raster pixels, treating any embedded `ESC`, `SYN`, or `ETB` bytes as
pixel data — there is no escape mechanism inside a raster row.

*LabelWriter 450 Series Technical Reference*, p. 18.

## `ETB` — transfer compressed print data

```
17 c0 c1 ... ck
```

`0x17` is the ETB opcode. The payload is a run-length encoding of one
raster line that decodes to exactly `8 × N` pixels, where `N` is the
current bytes-per-line. Each compressed byte encodes one run:

| Bit | Function          | Value                                   |
| --: | ----------------- | --------------------------------------- |
|   7 | Pixel colour      | `0` = white, `1` = black                |
| 6–0 | Run length − 1    | `0..127` (so run length is `1..128`)    |

Examples: `00` = 1 white pixel; `80` = 1 black pixel; `0F` = 16 white
pixels; `FF` = 128 black pixels. The sum of pixels per line must
equal `bytesPerLine × 8`; no error checking is done. Compressed and
uncompressed rows may be intermixed.

*LabelWriter 450 Series Technical Reference*, p. 21 (Appendix A).

## Synchronisation recovery

Raster bytes are not framed: after `SYN` or `ETB` the firmware reads
exactly `bytesPerLine` bytes as pixels, regardless of their values.
If the host and firmware get out of sync the device may sit waiting
for raster bytes the host is no longer sending. To force the parser
back to a command-accepting state the host can send 85 consecutive
`ESC` (`0x1B`) bytes — one more than the maximum bytes-per-line, so
the run is guaranteed to exhaust any in-progress raster expectation
and leave the parser looking for a command byte.

*LabelWriter 450 Series Technical Reference*, p. 9.

## References

- _LabelWriter® 450 Series Printers Technical Reference Manual_,
  Sanford, L.P. (Rev. 10/09). Authoritative byte-level reference for
  the 450, 450 Turbo, 450 Twin Turbo, 450 Duo (label side), and 4XL.
  Cited inline by page; not redistributed.
