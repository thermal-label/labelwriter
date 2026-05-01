# labelwriter — LabelWriter 300 / EL series support

> Add support for the pre-400 LabelWriter generation: the LW 300, 330,
> 330 Turbo, Turbo, EL40 and EL60. These are old (≈2001 vintage) but
> still in the wild — and the protocol question turns out to be
> already answered: the SE450 tech ref documents the same ESC command
> family these printers speak, just over a different transport mix.
> The work is mostly schema, descriptors, transport plumbing, and
> hardware-confirmation steps — not new protocol code.
>
> **Schema work + first three descriptors landed via
> [migrate-to-contracts-shape.md](./migrate-to-contracts-shape.md).**
> `LW_300`, `LW_310`, and `LW_330` are now in the registry with
> `transports.serial.defaultBaud: 115200` and `engines[0].dpi: 300`.
> The SE450's head metrics are corrected (448 dots / 203 dpi) and
> `transports.serial` added. Residual work: the four pre-CUPS-driver
> models with unknown PIDs (`LW_TURBO`, `LW_330_TURBO`, `LW_EL40`,
> `LW_EL60`), the serial-discovery wiring in the node driver
> (§4.5 below), and the host-side DPI scaling audit (§4.4).

---

## 1. Motivation

`HARDWARE.md` and the existing `LW_SE450` descriptor already
acknowledge there is a serial-capable LabelWriter dialect, but no
device in this codebase is openable over RS-232 today and several
older models are missing entirely. The 300 / EL family (per the
DYMO Declaration of Conformity in the user manual, p. i) covers:

| Model | DYMO P/N | DPI | Print width | Serial baud |
| --- | --- | --- | --- | --- |
| LabelWriter 300 | 90791 | 300 | 40 mm (1.57″) — narrow | 115 200 |
| LabelWriter 330 | 90792 | 300 | 56 mm (2.25″) | 115 200 |
| LabelWriter 330 Turbo | 90793 | 300 | 56 mm | 115 200 |
| LabelWriter Turbo | 90737 | 203 | 56 mm | 115 200 |
| LabelWriter EL40 | 90644 | 203 | 40 mm — narrow | 19 200 |
| LabelWriter EL60 | 90645 | 203 | 56 mm | 19 200 |

All six are **dual-interface**: bi-directional RS-232 *and* USB 1.1
(per Tech Specs p. 59). Max media width is 62 mm in all of them.

This adds two axes the codebase doesn't yet model:

- **DPI**: today every LabelWriter is implicitly 300 dpi (4XL too —
  it's a wider head at 300 dpi). The 203-dpi machines need to round-
  trip through the rasterizer at the right resolution.
- **Narrow head (40 mm)**: the LW 300 and EL40 have ~40 mm print
  widths. At 300 dpi that's 472 dots / 59 bytes; at 203 dpi (EL40)
  it's 320 dots / 40 bytes.

---

## 2. Protocol question — already answered

The serial protocol is the load-bearing unknown that motivated this
plan. The `LabelWriter SE450 Tech Ref.pdf` (p. 9, "Raster Mode")
resolves it without further reverse engineering needed:

> The LabelWriter SE450 command set includes most of the commands
> included in the command set for the LabelWriter 450 series
> printers… The two commands not available nor applicable to the
> LabelWriter SE450 printer are ESC G and ESC q. Data may be sent
> exactly as though it were being sent to a LabelWriter 450 series
> printer and the LabelWriter SE450 will process and print the
> data correctly.

The SE450 (2010, 203 dpi, 57 mm head, USB + RS-232) and the
300/EL family (2001, mixed 203/300 dpi, 40/56 mm heads, USB + RS-232)
are the same command set: **the LabelWriter 450 ESC commands minus
`ESC G` (short form feed) and `ESC q` (roll select)**, both of which
are roll-related and irrelevant on these single-roll machines.

What this means concretely:

- `encodeLabel` in `packages/core/src/protocol.ts` already emits a
  byte sequence that these printers accept — *provided* the
  bytes-per-line and head-dot values match the device. The
  encoder takes them from `device.headDots` / `device.bytesPerRow`,
  so the work is descriptor-only on the protocol side.
- The SE450's other 80% — ASCII print-job mode (ESC S/P/M/U/T fonts,
  ESC X/Y positioning, GS V orientation, GS k barcodes, etc.) — is
  an **alternative driverless mode** for embedded systems that
  rasterize on-device. We never use it. It is firmly out of scope
  for this driver, which always rasterizes host-side.
- The 300-series serial settings (115 200 8N1 hardware-handshake for
  the 300/330/Turbo, 19 200 for the EL40/EL60) are the same physical
  layer the SE450 documents on pp. 3-4 — just different baud rates.
  The bit-level framing matches.

**Net: no new protocol code is required.** The plan is descriptors,
transports, discovery and tests.

---

## 3. Gap

### 3.1 Missing devices

`packages/core/src/devices.ts` does not list the LW 300, 330,
330 Turbo, Turbo, EL40 or EL60. Discovery cannot match them on
either USB or serial.

### 3.2 The existing `LW_SE450` descriptor is wrong

`devices.ts:76-89`:

```ts
LW_SE450: {
  name: 'LabelWriter SE450',
  family: 'labelwriter',
  transports: ['usb', 'webusb'],
  vid: 0x0922,
  pid: 0x0400,
  headDots: 672,        // ← WRONG: SE450 head is 57 bytes / ~456 dots
  bytesPerRow: 84,      // ← WRONG: 84 overruns a 57-byte head
  protocol: '450',
  network: 'none',
  nfcLock: false,
},
```

The SE450 has a 203-dpi 57-mm-wide head. Per the SE450 tech ref
(p. 1 introduction), that's a `~456`-dot / 57-bytes-per-line
configuration, not the 672 / 84 we currently advertise. Sending
`ESC D 84` to a real SE450 either truncates at the head edge or
prints garbage off the right margin. Also, `transports` lists only
USB — the `'serial'` transport type already exists in
`@thermal-label/transport` but is not advertised here.

This bug pre-dates the 300-series work but blocks any downstream
testing of "narrow-head LW", since SE450 is the only narrow-head
device currently in the registry. Fix it as **step zero** of this
plan.

### 3.3 No DPI field on `LabelWriterDevice`

`packages/core/src/types.ts:13-22` has `headDots`, `bytesPerRow`,
`protocol` and a few network/lock flags, but no DPI. The 300/330
(300 dpi) and Turbo/EL40/EL60 (203 dpi) need to be distinguished so
the host rasterizer scales bitmaps to the right physical size. The
current implicit assumption "every LabelWriter is 300 dpi" holds for
every device in the registry today (4XL, 5XL, 550, 450, 400, all 300 dpi)
and breaks the moment a 203-dpi machine shows up.

### 3.4 No serial discovery / transport advertisement

`packages/node/src/discovery.ts` (`enumerateUsbDevices`) only walks
USB. `TransportType` already includes `'serial'`, and
`@thermal-label/transport/node/serial.ts` already implements
`SerialTransport`. The gap is at the discovery layer:

- USB-side these printers enumerate with their own VID/PID pair
  (vendor is `0x0922` per all DYMO devices, but the **PIDs are not
  documented** in either the user manual or the SE450 tech ref).
  This is the load-bearing empirical unknown — see open questions.
- Serial-side, RS-232 has no enumeration story by definition: the
  user passes a port path (`/dev/ttyUSB0`, `/dev/ttyS0`, `COM3`)
  and the driver has to take their word for which model is on the
  other end.

### 3.5 PIDs are unknown

The 400 series tech ref documents PIDs for the LW 400 / 400 Turbo /
Twin Turbo / Duo (already in `devices.ts`). The 300 series tech ref
does not exist as a public document — only the user manual, which
omits PIDs. The SE450 tech ref also doesn't list its own PID
(the existing `0x0400` entry is marked "unconfirmed").

This is the only thing in the plan that genuinely needs hardware
in hand or a community datapoint. Nothing else blocks on it for
serial-only access.

---

## 4. Proposed steps

### 4.1 Step zero — fix `LW_SE450` — DONE

Landed via the migrate-to-contracts-shape PR. SE450 entry now has
`headDots: 448`, `dpi: 203`, `transports.usb`, and `transports.serial`
with `defaultBaud: 9600`. PID `0x0400` is confirmed (no longer marked
unconfirmed).

### 4.2 Schema additions — DONE

The contracts `PrintEngine` shape carries `dpi: number` (loosened from
the 203 | 300 union the original draft proposed — accepts both).
`transports.serial.defaultBaud` carries the baud rate. Both are now
in use across the registry; no `LabelWriterDevice` interface
extension is needed.

### 4.3 Add 300-series descriptors — PARTIALLY DONE

Three confirmed-PID descriptors now live in
`packages/core/data/devices/`: `LW_300.json5`, `LW_310.json5`,
`LW_330.json5`. The four pre-CUPS-driver models below remain
unimplemented because their PIDs are still unknown — the
`compile-data.mjs` validator rejects entries without a real
`transports.usb.pid`, so a placeholder `0x0000` would fail the build.

When community datapoints land (PR with `lsusb -v` output), add the
matching JSON5 file under `data/devices/` using the head metrics from
the table below.

```ts
LW_300:        { pid: 0x0009, headDots: 464, bytesPerRow: 58, dpi: 300, serialBaud: 115200, ... }, // PID ≈, head ✓
LW_310:        { pid: 0x0009, headDots: 464, bytesPerRow: 58, dpi: 300, serialBaud: 115200, ... }, // ✓ (PID labelled "LabelWriter 310" in usb.ids)
LW_330:        { pid: 0x0007, headDots: 672, bytesPerRow: 84, dpi: 300, serialBaud: 115200, ... }, // ✓ PID, ✓ head
LW_330_TURBO:  { pid: 0x0000, headDots: 672, bytesPerRow: 84, dpi: 300, serialBaud: 115200, ... }, // PID unknown, head ✓ (lw330t.ppd)
LW_TURBO:      { pid: 0x0000, headDots: 448, bytesPerRow: 56, dpi: 203, serialBaud: 115200, ... }, // estimated — predates open drivers
LW_EL40:       { pid: 0x0000, headDots: 320, bytesPerRow: 40, dpi: 203, serialBaud: 19200,  ... }, // estimated
LW_EL60:       { pid: 0x0000, headDots: 448, bytesPerRow: 56, dpi: 203, serialBaud: 19200,  ... }, // estimated
```

Notes from the research:

- The LW 300 and LW 310 are different products but the
  `dymo-cups-drivers` driver treats them as a single PPD family
  ("DYMO LabelWriter 300/310/315") with shared MaxPrintWidth = 58
  bytes. linux-usb.org labels PID `0x0009` as "LabelWriter 310"
  — the 300 itself is **not separately registered upstream**.
  We list both descriptors with the same PID; whichever the host
  reports, `findDevice` picks the 310 entry first and the user
  doesn't need to care.
- The LW 300 head is **464 dots, not 472** as the inch-rounding
  math would suggest (1.57″ × 300 dpi = 471). The driver clamps
  to 464 — likely an 8-dot left-margin convention. Trust the
  driver.
- LW Turbo (90737, 203 dpi 56 mm), EL40 and EL60 predate the
  open CUPS driver. **No PPD exists, no PID is registered.** Best
  effort: head metrics from the inch-rounding math, treat them as
  experimental, flag with `experimental: true` (a flag the
  LabelManager driver already uses for similar cases —
  `labelmanager-core/devices.ts` MOBILE_LABELER).

`transports: ['usb', 'webusb', 'serial']` for all seven
(300/310/330/330 Turbo/Turbo/EL40/EL60). `vid: 0x0922` everywhere.

### 4.4 Encoder adjustments

Audit `encodeLabel` in `protocol.ts` for any implicit-300-dpi
assumptions. There shouldn't be any — the encoder is byte-for-byte
neutral on DPI; the rasterizer above it owns dimensional scaling.
But verify: `buildSetLabelLength` takes `dots` (300ths-of-an-inch
on the 450 manual; the SE450 manual confirms it's "dot lines" and
the dot-line resolution is whatever the head's native DPI is).
On a 203-dpi head, dots-per-inch in the feed direction is 203, so
the same `n1 n2` value means a different physical length. The
driver layer (`LabelWriterPrinter.print`) needs to convert
`media.heightMm` → `dots` using `device.dpi`, not a hard-coded 300.

`packages/core/src/preview.ts` likely has the same scaling
assumption — sweep it.

### 4.5 Driver — wire serial into discovery

`packages/node/src/discovery.ts`:

- `listPrinters()` keeps walking USB, no change in shape.
- `openPrinter()` gains a serial branch:
  ```ts
  if (options.serialPath !== undefined) {
    const transport = await SerialTransport.open(options.serialPath, {
      baudRate: options.baudRate ?? descriptor.serialBaud ?? 115200,
      ...rs232Defaults, // 8 data bits, no parity, 1 stop, hardware flow
    });
    return new LabelWriterPrinter(descriptor, transport, 'serial');
  }
  ```
  The caller has to pass `pid` (or `name`) as a hint, since serial
  has no enumeration. If they pass nothing, default to `LW_330`
  (the most common surviving 300-series model) with a console
  warning, OR throw — preference: throw, force the caller to be
  explicit. The error message should suggest the descriptor keys
  and document why ("RS-232 has no enumeration; pass `model:` to
  declare which descriptor to use").
- `OpenOptions` (in `@thermal-label/contracts`) needs
  `serialPath?` and `baudRate?` fields. This is a contracts-level
  change but a strictly additive one.

### 4.6 PID discovery

Pre-research baseline (post-online sweep — see Appendix A):

- ✓ **LW 330** → `0x0007` (linux-usb.org `usb.ids`).
- ✓ **LW 310** → `0x0009` (linux-usb.org `usb.ids`); **LW 300**
  uses the same PID per the dymo-cups-drivers PPD groupings.
- ✓ **SE450** → `0x0400` (DYMO's own SE450 USB Specifications page).
- ✗ **LW 330 Turbo, LW Turbo, EL40, EL60** — *no* community
  datapoint exists. dymo-cups-drivers identifies devices by the
  CUPS make-and-model string, not by PID, so its source carries
  no mapping table; `usb.ids` only has the four entries above for
  the pre-450 era.

For the four still-unknown PIDs, the only routes left are:

1. **Real hardware**: a `lsusb -v` from anyone with the printer
   closes the gap in one shot. Document the contribution path
   in `HARDWARE.md` so a future user of an EL60 can drop us a
   datapoint.
2. **Windows DYMO Label v8 INF/CAT files**: archived install
   bundles on dymo.com's older download pages (and the Internet
   Archive) carry `.inf` files that list every PID the driver
   supports. The 90792/90793 (LW 330 / 330 Turbo) era should be
   covered by `DYMO Label v7` install media.
3. **DriverGuide / WHQL signature databases**: the EL40/EL60 era
   predates DYMO's open-source efforts but Windows Update kept
   their drivers signed for a long time. Search `0922&PID_*` in
   driver listings.

Until those land, descriptors carry `pid: 0x0000` with a
`// unconfirmed` comment. `findDevice(vid, pid)` won't auto-match
them on USB, but the explicit `openPrinter({ serialPath, model:
'LW_EL60' })` path works regardless. **The serial path is the
robustness lever** — it works without USB enumeration.

### 4.7 Tests

- `devices.test.ts` — assert each new descriptor has correct
  `dpi`, `headDots`, `bytesPerRow`, `serialBaud` values; assert
  `LW_SE450` has the corrected head metrics.
- `protocol.test.ts` — golden-bytes test for a 56-byte (`ESC D 56`)
  emission to verify the encoder respects narrow `bytesPerRow`.
  Also assert that no `ESC G` or `ESC q` ever appears in encoder
  output for these descriptors (per SE450 tech ref — the firmware
  rejects them on this family).
- `discovery.test.ts` — mock a `SerialTransport.open` and assert
  `openPrinter({ serialPath: '/dev/ttyUSB0', model: 'LW_330' })`
  routes correctly. Mock `usb.getDeviceList()` to return the (yet
  unknown) PIDs once they land.

### 4.8 Documentation

- `HARDWARE.md` — replace the "Bi-directional, RS232 Serial (1200 to
  115.2K baud)" comment in the SE450 section with a proper
  "Serial-capable LabelWriters" subsection covering all seven
  models, baud rates, and the `serialPath` opening pattern.
- `README.md` — short example showing `openPrinter({ serialPath })`.

### 4.9 Out of scope

- The SE450's ASCII print-job mode (ESC S/P/M/U/T fonts, GS V
  orientation, GS k barcodes, the "Caret feature", PDF417). That
  is a separate feature stack designed for embedded hosts that
  cannot rasterize. We always rasterize. Implementing it would be
  a parallel driver, not an extension of this one.
- LabelWriter parallel-port adapters (DYMO part #60616/60617, per
  user manual p. 58). The host needs a parallel port and we have
  no LPT transport. If a user has one they can wire it up; we
  don't ship it.
- Bluetooth-bridged serial. None of these printers have native
  BT, but the `SerialTransport` already covers RFCOMM if a user
  pairs an external adapter — no driver work needed.

---

## 5. Sequencing

1. **Step zero** (4.1): fix `LW_SE450` head metrics and add
   `'serial'` to its transports. Land alone — small, defensive.
2. Schema additions (4.2): `dpi` and `serialBaud` fields.
   Touches every existing descriptor (backfill with `dpi: 300`).
3. Serial transport wiring (4.5): `OpenOptions.serialPath`
   in contracts; `openPrinter` branch in discovery.
4. 300-series descriptors (4.3): land with `pid: 0x0000` placeholders.
5. Encoder/preview audit (4.4): confirm no DPI-300 hardcodes.
6. PID resolution (4.6): merge as datapoints come in.

(1)–(3) are all independently shippable; (4)–(5) are blocked on
nothing; (6) is open-ended community work.

---

## 6. Open questions

### 6.1 SE450 PID — RESOLVED

DYMO's own SE450 Tech Ref USB Specifications page documents
`0x0922:0x0400`. linux-usb.org's `usb.ids` corroborates. Drop
the `// unconfirmed` comment in step 4.1.

### 6.2 300-series PIDs

Status after research:
- ✓ LW 330 = `0x0007`, LW 310/300 = `0x0009` (linux-usb.org).
- ✗ LW 330 Turbo, LW Turbo (90737), EL40, EL60: still unknown.
  Not blocking for the serial path — the user opens by
  `serialPath` + model name.

### 6.3 Exact narrow-head dot counts — RESOLVED for the
common cases

From the dymo-cups-drivers source:
- LW 300/310/315 → **464 dots** (not 472 as the inch math suggests
  — driver clamps to 58 bytes/line).
- LW 330 / 330 Turbo / 400 / 400 Turbo / 450 / 450 Turbo / 450
  Twin Turbo / Duo / 550 family → **672 dots** (84 bytes).
- SE450 → **448 dots** (56 bytes).
- 4XL → **1248 dots** (156 bytes).

Still unknown for LW Turbo (90737), EL40 (90644), EL60 (90645)
— predate the open driver. Estimates in 4.3 are best-effort.

### 6.4 EL40/EL60 baud-rate compatibility with `SerialTransport`

19 200 8N1 with hardware handshaking (RTS/CTS) is well within
node-serialport's range, but the existing `SerialTransport`
defaults are `9600` baud and there's no test asserting hardware
flow control works end-to-end. Worth a smoke test before claiming
EL40/EL60 support.

The SE450 tech ref itself says "configure the RS-232 port as a
dumb printer port, with no special handling, control characters
or form feeds" — strongly suggesting the printer doesn't *require*
hardware flow control. Treat RTS/CTS as opportunistic: enable if
the OS exposes it, ignore failures.

### 6.5 Should the 4XL split into 203-dpi and 300-dpi variants?

The 4XL is currently `headDots: 1248, bytesPerRow: 156` with no
DPI. The dymo-cups-drivers source confirms the 4XL is 300 dpi
(matches 4″ × 300 = 1200 dots + 48-dot margin = 1248). Backfill
`dpi: 300` when the schema lands. No split needed.

---

## Appendix A — Empirical research summary (2026-04-29)

Online sweep findings, kept here so future re-research can start
from a known baseline rather than re-doing the same searches.

| Source | What it gives us |
| --- | --- |
| `linux-usb.org/usb.ids` | LW 330 = `0x0007`, LW 310 = `0x0009`, LW 400 = `0x0019`, LW 400 Turbo = `0x001a`, LW 450 = `0x0020`, SE450 = `0x0400`. Nothing for 330 Turbo / Turbo / EL40 / EL60. |
| `matthiasbock/dymo-cups-drivers` (`src/lw/CupsFilterLabelWriter.cpp`, `src/lw/LabelWriterDriver.cpp`, `ppd/lw*.ppd`) | Authoritative `MaxPrintWidth` (in bytes) per model. LW 300/310/315 = 58, LW 330/Turbo/400 family/450 family = 84, SE450 = 56, 4XL = 156. Identifies devices by CUPS make-and-model, *not* by PID — no PID table. |
| DYMO `download.dymo.com/UserManuals/.../LWSE450_Tech_Ref/` HTML mirror | Confirms SE450 USB PID `0x0400` and serial settings 9600/8N1, no flow-control mention. |
| `minlux/dymon` (GitHub) | Reverse-engineered LW Wireless / 450 / 550 protocol via Wireshark. Useful for cross-checking the 450 raster shape but does not cover pre-400 models. |
| OpenPrinting database, DriverGuide | Searched. No pre-CUPS-driver-era PID listings — the LW Turbo / EL40 / EL60 are genuinely undocumented in open sources. |

**Gaps requiring real hardware** (anyone with the printer can
unblock us with one `lsusb -v`):

- LW Turbo (90737) — VID/PID and exact head dot count
- LW 330 Turbo (90793) — VID/PID
- LW EL40 (90644) — VID/PID and exact head dot count
- LW EL60 (90645) — VID/PID and exact head dot count
- LW 300 vs LW 310 — confirm whether `0x0009` is shared or
  whether the 300 uses a different (currently unregistered) PID.
