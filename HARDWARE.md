# Hardware Reference

## Supported Devices

All devices share Vendor ID `0x0922` (Dymo-CoStar Corp.) and use USB Printer Class (bulk transfer).

| Device                     | USB PID  | Head dots | Network | NFC lock | Status      | Notes                                                         |
| -------------------------- | -------- | --------- | ------- | -------- | ----------- | ------------------------------------------------------------- |
| LabelWriter 400            | `0x0019` | 672       | ❌      | ❌       | 🟡 Expected | Predecessor to 450 series, same protocol                      |
| LabelWriter 400 Turbo      | `0x0023` | 672       | ❌      | ❌       | 🟡 Expected | Same protocol as 450                                          |
| LabelWriter 450            | `0x0020` | 672       | ❌      | ❌       | 🟡 Expected | Reference 450 protocol                                        |
| LabelWriter 450 Turbo      | `0x002A` | 672       | ❌      | ❌       | 🟡 Expected |                                                               |
| LabelWriter 450 Twin Turbo | `0x002B` | 672       | ❌      | ❌       | 🟡 Expected | Dual roll — `ESC q` roll select                               |
| LabelWriter 450 Duo        | `0x002C` | 672       | ❌      | ❌       | 🟡 Expected | Also has D1 tape head (128 dots, 180 dpi) — tape out of scope |
| LabelWriter 4XL            | `0x0025` | 672       | ❌      | ❌       | 🟡 Expected | Wide format labels                                            |
| LabelWriter Wireless       | `0x0031` | 672       | WiFi    | ❌       | 🟡 Expected | TCP supported                                                 |
| LabelWriter 550            | `0x0052` | 672       | ❌      | ✅       | 🟡 Expected | NFC lock — genuine labels only                                |
| LabelWriter 550 Turbo      | `0x0053` | 672       | LAN     | ✅       | 🟡 Expected | NFC lock + TCP                                                |
| LabelWriter 5XL            | `0x0054` | 1248      | LAN     | ✅       | 🟡 Expected | Wide head (101mm) + NFC lock + TCP                            |

> Have a device marked 🟡 Expected? Run `LABELWRITER_INTEGRATION=1 pnpm test` and open a
> [hardware verification issue](/.github/ISSUE_TEMPLATE/hardware_verification.md).

## NFC Label Lock (550 Series)

> **Warning:** The LabelWriter 550, 550 Turbo, and 5XL only print with authentic Dymo labels that
> carry a valid NFC tag. This is enforced in hardware and **cannot be bypassed in software**.

The NFC lock was introduced with the 550 series. When you load a non-genuine label roll, the
printer detects the missing or invalid NFC tag and refuses to print. The driver sends a valid job
stream — the printer simply ignores it.

**Affected models:** LabelWriter 550 (`0x0052`), 550 Turbo (`0x0053`), 5XL (`0x0054`).

**Not affected:** All 400 series, 450 series, Wireless, and 4XL models.

If you see a print job sent without errors but no label comes out, check that you are using genuine
Dymo labels and that the NFC tag on the roll is intact.

**Hardware workaround (unofficial):** the [free-dmo-stm32](https://github.com/free-dmo/free-dmo-stm32)
project replaces the printer's STM32 firmware to remove the NFC check. This is a third-party
firmware mod — flashing the wrong build or interrupting the flash can brick the printer, and it
voids your warranty. Not endorsed by this project; linked here only because users keep asking.

## Protocol Generations

### 450 Series Protocol

Used by: LabelWriter 400, 400 Turbo, 450, 450 Turbo, 450 Twin Turbo, 450 Duo, 4XL, Wireless.

No job header. Print sequence:

```
ESC @       software reset
ESC h       text speed (300×300 dpi) — or ESC i for graphics (300×600 dpi)
ESC L n1 n2 label length in dots (little-endian 16-bit)
SYN [bytes] raster row (one per dot row)
...
ESC E       form feed
```

### 550 Series Protocol

Used by: LabelWriter 550, 550 Turbo, 5XL.

Mandatory job header (`ESC s`) before any raster data. Core raster format is identical to 450.

```
ESC s n1 n2 n3 n4   job start — unique 4-byte job ID
ESC h               text speed (or ESC i for graphics)
ESC L n1 n2         label length in dots
SYN [bytes]         raster row
...
ESC E               form feed
```

The job header does **not** affect or disable the NFC label lock. The NFC check is independent of
the job stream format.

## Print Head Geometry

| Model family                         | Head dots | Bytes per raster row | Paper path |
| ------------------------------------ | --------- | -------------------- | ---------- |
| 450 series, Wireless, 550, 550 Turbo | 672       | 84                   | 63 mm      |
| 5XL                                  | 1248      | 156                  | ~110 mm    |

A `1` bit = black dot (printed). A `0` bit = white dot (unprinted).  
MSB = leftmost dot on the label. No built-in fonts — the host renders everything to a bitmap.

## Error Recovery

To recover from an unknown or error state, send 85 consecutive `ESC` (`0x1B`) bytes followed by
`ESC A` (status request). This exceeds the maximum raster line length (84 bytes) and forces the
printer back into command mode.

```
0x1B × 85
0x1B 0x41   ESC A — status request
```

Wait for the status response before sending further commands.
