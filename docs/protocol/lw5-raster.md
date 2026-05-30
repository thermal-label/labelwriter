# LW5 Raster Protocol

The wire protocol introduced with the LabelWriter 5xx generation —
LabelWriter 550, 550 Turbo, and 5XL. A clean break from the classic
LabelWriter raster protocol: an explicit job header and trailer,
per-label `ESC D` block with a 12-byte preamble in front of an unframed
raster payload, and a 32-byte status reply with NFC-derived media
diagnostics.

The classic LabelWriter raster predecessor it supersedes is documented
separately in [LW raster](./lw-raster). The two are not wire-compatible.

## USB topology

Standard USB Printer-class device on Vendor ID **`0x0922`**
(DYMO / Sanford). Per-model PIDs are listed on the
[Hardware](../hardware) page.

```
Configuration 1
  Interface 0 — Printer class (bInterfaceClass 0x07)
    Endpoint OUT  Bulk    (print data + commands)
    Endpoint IN   Bulk    (32-byte status replies)
```

LabelWriter 550 Turbo and 5XL additionally expose a 10/100 Mbit
Ethernet interface; the byte stream is identical.

Head geometry: 672 addressable dots on the 550 / 550 Turbo, 1248 on
the 5XL. All chassis print at 300 dpi.

## Opcode vocabulary

| Opcode                                          | Bytes           | Description                                      |
| ----------------------------------------------- | --------------- | ------------------------------------------------ |
| [`ESC @`](#esc-—-restart-print-engine)          | `1B 40`         | Restart print engine (reboot).                   |
| [`ESC *`](#esc-—-restore-factory-settings)      | `1B 24`         | Restore factory settings.                        |
| [`ESC A`](#esc-a-—-request-print-engine-status) | `1B 41 nn`      | Request print engine status (lock byte selects). |
| [`ESC C`](#esc-c-—-set-print-density)           | `1B 43 nn`      | Set print density (duty 0..200 %).               |
| [`ESC D`](#esc-d-—-start-of-label-print-data)   | `1B 44 …`       | Start of label print data (12-byte header).      |
| [`ESC e`](#esc-e-—-reset-print-density)         | `1B 65`         | Reset print density to 100 %.                    |
| [`ESC E`](#esc-e-—-feed-to-tear-position)       | `1B 45`         | Feed to tear position (long form feed).          |
| [`ESC G`](#esc-g-—-feed-to-print-head)          | `1B 47`         | Feed to print head (short form feed).            |
| [`ESC h`](#esc-h-esc-i-—-output-mode)           | `1B 68`         | Select text output mode.                         |
| [`ESC i`](#esc-h-esc-i-—-output-mode)           | `1B 69`         | Select graphics output mode.                     |
| [`ESC L`](#esc-l-—-set-maximum-label-length)    | `1B 4C …`       | Set maximum label length (continuous stock).     |
| [`ESC n`](#esc-n-—-set-label-index)             | `1B 6E N N`     | Set label index (u16 LE).                        |
| [`ESC o`](#esc-o-—-set-label-count)             | `1B 6F nn`      | Set label count.                                 |
| [`ESC Q`](#esc-q-—-end-of-print-job)            | `1B 51`         | End of print job (mandatory trailer).            |
| [`ESC s`](#esc-s-—-start-of-print-job)          | `1B 73 N N N N` | Start of print job (u32 LE Job ID).              |
| [`ESC T`](#esc-t-—-set-content-type)            | `1B 74 nn`      | Set content type / speed mode.                   |
| [`ESC U`](#esc-u-—-get-sku-information)         | `1B 55`         | Get SKU information (63-byte NFC dump).          |
| [`ESC V`](#esc-v-—-get-engine-version)          | `1B 56`         | Get engine version (34-byte HW/FW/PID block).    |

All multi-byte integers are little-endian.

## Print job structure

A complete job is a sequence of bulk-OUT writes framed by a job
header and trailer with one or more labels between them. The wire
**layout** is a single byte stream, but the host writes it in
segments: the firmware blocks the OUT endpoint after every label
until the host drains a 32-byte status reply (see
[Inter-label status handshake](#inter-label-status-handshake)).

```
[print job header]
  ESC s <jobId u32>          — start of print job (mandatory)
  [ESC L]                    — set maximum label length (optional)
  ESC h | ESC i              — text vs graphics output mode
  [ESC T <speed>]            — content type / speed (optional)
  ESC C <duty>               — set print density

[per label, index 0..N-1]
  ESC n <index u16>          — label index
  ESC D <bpp> <align> <width u32> <height u32>
                             — start of label print data (12-byte header)
  <print data>               — width × ceil(height × bpp / 8) bytes
  ESC G                      — feed to print head
  [host: ESC A <lock>          ← MANDATORY footer handshake;
        read 32-byte status]    firmware stalls bulk-OUT until drained

ESC E                        — feed to tear position (once, after last label)
ESC Q                        — end of print job (mandatory)
```

`ESC s` and `ESC Q` are mandatory. The per-label structure (`ESC n` +
`ESC D` + print data + `ESC G`) repeats for every label in the job;
every footer is followed by the inter-label `ESC A` handshake. After
the last label's handshake, `ESC E` feeds the printed label to the
tear bar and `ESC Q` closes the job. The `ESC s` job ID is echoed
back in every status reply during the job so the host can correlate.
See _LabelWriter 550 Series Printers Technical Reference Manual_,
pp. 4–6, for the job-structure diagram.

The print data follows the `ESC D` header **directly** — no `SYN`
prefix, no per-row framing, no length byte. Row width is fixed by
the `ESC D` `width` field and head pin count.

### Lock acquisition

Only one host may drive the print engine at a time. To take the
lock, send `ESC A 1` and read the 32-byte status reply: print-status
byte `0` indicates whether the lock was granted (`0`..`3`) or whether
another host holds it (`5`). A host that does not hold the lock can
still issue `ESC A 0` heartbeats but cannot send a job. The lock
releases on `ESC Q` (Tech Ref, p. 7).

### Inter-label status handshake

After each label's `ESC G` footer the firmware stops draining the
bulk-OUT endpoint until the host issues `ESC A` and reads the 32-byte
reply. Streaming the whole job in one write hangs mid-job and leaves
the printer lock-held until power-cycle.

| Position       | `lock` byte | Reply timing                                                                          |
| -------------- | ----------: | ------------------------------------------------------------------------------------- |
| Between labels |         `2` | Host may defer the read until just before the next label's segment ships.             |
| Last label     |         `0` | Host must drain the reply before sending `ESC E` + `ESC Q`. Also drops the host lock. |

The `ESC s` job ID and `ESC n` label index are echoed in the reply
(bytes 1–4 and 5–6) so the host can correlate the handshake to the
label it just finished.

## `ESC @` — restart print engine

```
1B 40
```

Reboots the print engine. Any buffered data is lost. Intended for
recovery when the engine is wedged; the soft path (`ESC Q` to
release the lock) is preferred for a stuck job.

## `ESC *` — restore factory settings

```
1B 24
```

Wipes user-tunable settings back to factory defaults.

The Tech Ref (p. 20) lists this command with mnemonic `ESC *` but
hex `1B 24`. `0x24` is ASCII `$`, not `*` (`0x2A`); the
mnemonic-vs-byte discrepancy is a known inconsistency in the
manual. The hex is authoritative on the wire.

## `ESC A` — request print engine status

```
1B 41 <lock>
```

Three-byte form. The `lock` byte selects the request type:

| `lock` | Purpose                                            |
| -----: | -------------------------------------------------- |
|    `0` | No lock — heartbeat / status query                 |
|    `1` | Lock interface for printing (acquire before a job) |
|    `2` | Status query between labels in an active print job |

The printer replies with **32 bytes** on the IN endpoint:

| Offset | Field              | Type      | Notes                                                                           |
| -----: | ------------------ | --------- | ------------------------------------------------------------------------------- |
|      0 | Print status       | u8        | See sub-state table below.                                                      |
|    1–4 | Job ID             | u32 LE    | Echoes the most recent `ESC s`. `0` when idle.                                  |
|    5–6 | Label index        | u16 LE    | Echoes the current `ESC n`.                                                     |
|      7 | Reserved           | u8        | Default `0`.                                                                    |
|      8 | Print-head status  | u8        | `0` ok · `1` overheated · `2` status unknown (default).                         |
|      9 | Print density      | u8        | Duty percent. `0` disables printing; `1..200` is the duty value.                |
|     10 | Main bay status    | u8        | NFC media diagnostic — see table below.                                         |
|  11–22 | SKU number         | char × 12 | 12-byte ASCII SKU of the inserted consumable. `0` = empty.                      |
|  23–26 | Error ID           | u32 LE    | `0` = no error; non-zero = error code.                                          |
|  27–28 | Label count        | u16 LE    | Remaining labels on the inserted roll. `0` = empty.                             |
|     29 | EPS status         | u8        | Bit 0 = external power supply present. Bits 4–7 reserved.                       |
|     30 | Print-head voltage | u8        | `0` unknown · `1` ok · `2` low · `3` critically low · `4` too low for printing. |
|     31 | Reserved           | u8        | Default `0xFF`.                                                                 |

### Print-status sub-states (byte 0)

| Value | Meaning                                                                                                                               |
| ----: | ------------------------------------------------------------------------------------------------------------------------------------- |
|   `0` | Idle — lock held by this host.                                                                                                        |
|   `1` | Printing.                                                                                                                             |
|   `2` | Error.                                                                                                                                |
|   `3` | Cancel.                                                                                                                               |
|   `4` | Printer just woke from standby.                                                                                                       |
|   `5` | Status reply **before** the lock is granted to the requesting host (i.e. another host holds the lock, or the printer hasn't decided). |

Values `0`..`3` only appear once the lock has been granted to the
host receiving the reply (Tech Ref, p. 13–14). Value `5` is how
the printer signals "your `ESC A 1` request did not give you the
lock."

### Main bay status (byte 10)

NFC-derived diagnostic of the loaded roll. The 550 chassis reads
an NFC tag embedded in every genuine spool; non-genuine media is
detected here and printing is refused.

| Code | Meaning                           |
| ---: | --------------------------------- |
|  `0` | Bay status unknown.               |
|  `1` | Bay open; media presence unknown. |
|  `2` | No media present.                 |
|  `3` | Media not inserted properly.      |
|  `4` | Media present — status unknown.   |
|  `5` | Media present — empty.            |
|  `6` | Media present — critically low.   |
|  `7` | Media present — low.              |
|  `8` | Media present — ok.               |
|  `9` | Media present — jammed.           |
| `10` | Media present — counterfeit.      |

Code `10` is surfaced by firmware when the inserted spool fails NFC
validation. The host cannot bypass this — the check happens during
cassette insertion, independent of the wire protocol. See _Label
Length_, Tech Ref p. 7: "Only authentic Dymo labels with a valid
NFC Tag can be used for printing."

## `ESC C` — set print density

```
1B 43 <duty>
```

`duty` is the strobe duty cycle as a percentage. Range `0..200`,
default `100`. `0` disables printing; lower values produce lighter
output, higher values darker. The setting persists until reset by
`ESC e`, a power cycle, or the end of the job.

## `ESC D` — start of label print data

```
1B 44 <bpp> <align> <width0..3> <height0..3> <print data>
```

12-byte fixed header followed immediately by the raster payload.

| Field        | Bytes | Meaning                                                    |
| ------------ | ----: | ---------------------------------------------------------- |
| `bpp`        |     1 | Bits per pixel. Default `1`.                               |
| `align`      |     1 | Print alignment. `2` = bottom (the only documented value). |
| `width`      |  4 LE | Number of raster lines along the feed direction (u32).     |
| `height`     |  4 LE | Number of dots per raster line, across the head (u32).     |
| `print data` |     … | `width × ceil(height × bpp / 8)` bytes, contiguous.        |

Axis convention per the Tech Ref p. 12 diagram: `width` is the
feed-direction line count; `height` is the cross-head dot count.
This is the opposite of the natural "width × height" reading of a
printed label.

The most significant bit of the first print-data byte is the lower
pixel of the first line (dot 0 of the head is at the bottom). Bytes
per line is computed as `roundup(height × bpp / 8)`. The control
electronics do not validate that `height` matches the installed
head width — the host is responsible for sending only as many
bytes per line as the head can address (84 on a 672-dot head, 156
on the 1248-dot 5XL).

## `ESC e` — reset print density

```
1B 65
```

Resets the print density to the default 100 %.

## `ESC E` — feed to tear position

```
1B 45
```

Advances the most recently printed label to a position where it can
be torn off, placing the next label beyond the starting print
position. The firmware automatically reverse-feeds when the next
label begins printing. Use `ESC E` for the **last** label of a job;
for inter-label feeds inside a multi-label job, use `ESC G` so the
firmware can skip the reverse-feed step (Tech Ref, p. 7).

## `ESC G` — feed to print head

```
1B 47
```

Short form feed: advances the next label into print position. The
previously printed label may still be partially inside the printer
and cannot be torn off — `ESC G` is for multi-label jobs where
inter-label tear-off is not wanted. Use `ESC E` instead when the
label must reach the tear bar.

## `ESC h` / `ESC i` — output mode

```
1B 68    — select text mode (default)
1B 69    — select graphics output mode
```

Text mode optimises for text printing; graphics mode prints with
settings tuned for graphics and barcodes, at potentially reduced
print speed. Sent once per job, in the print job header.

## `ESC L` — set maximum label length

```
1B 4C …
```

Selects the print engine mode between normal label stock and
continuous label stock. Normal stock is the default and the label
length is taken from the NFC tag of the inserted roll; `ESC L` is
only needed when overriding to continuous mode.

The parameter format is not specified in the Tech Ref (p. 11). For
authentic media the length comes from NFC, so `ESC L` is rarely
needed in practice.

## `ESC n` — set label index

```
1B 6E <index0..1>
```

2-byte little-endian label index. Sent before each label's `ESC D`
block. The first label of a job is index `0`; subsequent labels
increment. The current index is echoed back in status-reply bytes
5–6 (also u16) so the host can track which label is being printed —
the wire field width matches.

## `ESC o` — set label count

```
1B 6F <count>
```

Single-byte count `0..255`. Overrides the on-printer remaining-
labels counter. The Tech Ref (p. 20) documents the command but
does not specify the use case beyond "Sets label count."

## `ESC Q` — end of print job

```
1B 51
```

Mandatory job trailer. The print engine releases its lock and
begins accepting jobs from other hosts on receipt. Every job must
end with `ESC Q`.

`ESC Q` also serves as a soft-recovery primitive: sending it at any
time releases the host's print lock and returns the engine to an
idle state without losing power-on calibration.

## `ESC s` — start of print job

```
1B 73 <jobId0..3>
```

Mandatory job header. 4-byte little-endian Job ID; the value is
host-chosen and is echoed back in status-reply bytes 1–4 throughout
the job. Any 32-bit value is acceptable.

## `ESC T` — set content type

```
1B 74 <speed>
```

| `speed` | Mode                   |
| ------: | ---------------------- |
|  `0x10` | Normal speed (default) |
|  `0x20` | High speed             |

Optional. Selects the print speed mode; affects the print head duty
cycle. Not all label rolls support the high-speed mode (Tech Ref,
p. 8 — the LW 5XL does not support high speed at all).

## `ESC U` — get SKU information

```
1B 55
```

Retrieves the NFC dump of the inserted consumable. The printer
replies with a **63-byte** structure (Tech Ref, pp. 16–19).

> **Unit caveat — length fields are deci-mm, not mm.** The Tech Ref
> labels every length field "Length in mm". On the wire the NFC tag
> encodes **tenths of a millimetre** — confirmed by an S0722540 bench
> capture (a 57.1 × 31.7 mm roll reports `571` / `317`). Divide by
> 10 for the millimetre value. Count, strategy, and date fields are
> not affected.

| Offset | Field                      | Type      | Notes                                                                                                                                |
| -----: | -------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
|    0–1 | Magic                      | u16 LE    | `0xCAB6` — validates the response.                                                                                                   |
|      2 | Version                    | u8        | Currently `'0'`.                                                                                                                     |
|      3 | Length                     | u8        | Payload length.                                                                                                                      |
|    4–5 | CRC                        | u16 LE    | CRC over payload.                                                                                                                    |
|   8–19 | SKU number                 | char × 12 | ASCII SKU.                                                                                                                           |
|     20 | Brand ID                   | u8        | `0x00` = DYMO, `0x01..0xFF` undefined.                                                                                               |
|     21 | Region                     | u8        | `0xFF` = global.                                                                                                                     |
|     22 | Material type              | u8        | `0x00` card · `0x01` clear · `0x02` durable · `0x03` paper · `0x04` permanent · `0x05` plastic · `0x06` removable · `0x07` time-exp. |
|     23 | Label type                 | u8        | `0x00` continuous · `0x01` die · `0x02` card.                                                                                        |
|     24 | Label colour               | u8        | `0x00` clear · `0x01` white · `0x02` pink · `0x03` yellow · `0x04` green · `0x05` blue.                                              |
|     25 | Content colour             | u8        | `0x00` black · `0x01` red/black.                                                                                                     |
|     26 | Marker type                | u8        | Marker / cut-edge geometry; values `0x00..0x03`.                                                                                     |
|     27 | Reserved                   | u8        |                                                                                                                                      |
|  28–29 | Marker pitch               | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  30–31 | Marker 1 width             | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  32–33 | Marker 1 to start of label | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  34–35 | Marker 2 width             | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  36–37 | Marker 2 offset            | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  38–39 | Vertical offset            | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  40–41 | Label length               | u16 LE    | Length in deci-mm (÷10 for mm). `0` / `0xFFFF` for continuous stock.                                                                 |
|  42–43 | Label width                | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  44–45 | Printable area H. offset   | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  46–47 | Printable area V. offset   | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  48–49 | Liner width                | u16 LE    | Length in deci-mm (÷10 for mm).                                                                                                      |
|  50–51 | Total label count          | u16 LE    | Labels on a full roll.                                                                                                               |
|  52–53 | Total length               | u16 LE    | Roll length in deci-mm (÷10 for mm).                                                                                                 |
|  54–55 | Counter margin             | u16 LE    | Used by the printer to compute labels remaining.                                                                                     |
|     56 | Counter strategy           | u8        | `0x00` = count up from `0x0000`; `0x01` = count down from `0xFFFF - amount - margin`.                                                |
|  57–59 | Reserved                   |           |                                                                                                                                      |
|  60–61 | Production date            | ASCII × 2 | `DDYY` format.                                                                                                                       |
|  62–63 | Production time            | ASCII × 2 | `HHMM` format.                                                                                                                       |

The Marker / Counter Strategy fields cover both die-cut and
continuous variants; many fields are `0` / `0xFFFF` on continuous
stock. The byte layout for fields after byte 27 is described as
inclusive ranges in the Tech Ref (e.g. "Byte 28 to Byte 29 — Marker
Pitch") and the response is documented as 63 bytes total despite
the table extending to offset 63 (Tech Ref, p. 16: "the following is
the 63-Byte response to ESC U").

## `ESC V` — get engine version

```
1B 56
```

Retrieves the hardware / firmware identity block. The printer
replies with **34 bytes** (Tech Ref, p. 20):

| Offset | Field            | Type      | Notes                                          |
| -----: | ---------------- | --------- | ---------------------------------------------- |
|   0–15 | Hardware version | char × 16 | UTF-8 string, right-padded with `0x00`.        |
|  16–19 | FW kind          | char × 4  | `"FWAP"` = application, `"FWBL"` = bootloader. |
|  20–23 | Major version    | char × 4  | ASCII version string.                          |
|  24–27 | Minor version    | char × 4  | ASCII version string.                          |
|  28–31 | Release date     | char × 4  | `MMYY` format.                                 |
|  32–33 | USB PID          | u16 LE    | This chassis's product ID.                     |

## References

- _LabelWriter® 550 Series Printers Technical Reference Manual_,
  for LabelWriter 550 / 550 Turbo / 5XL, Sanford L.P., 2021. The
  authoritative byte-level reference. Cited inline by page; not
  redistributed.
- **minlux/dymon** — open-source DYMO print tool; reverse-engineered
  the LabelWriter Wireless / 550 protocol via Wireshark capture over
  USB and TCP:9100. `protocol.md` + `src/dymon/dymon.cpp`.
  <https://github.com/minlux/dymon>.
