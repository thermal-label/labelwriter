[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / parseD1Status

# Function: parseD1Status()

> **parseD1Status**(`bytes`): [`PrinterStatus`](../interfaces/PrinterStatus.md)

Parse a D1 status reply (8 bytes; only byte 0 used).

Bit layout in byte 0 — bench-confirmed (LM_PNP, 2026-05-09):

  bit 6 — cassette detection (set = inserted)
  bit 4 — cutter jammed (may not fire on manual cutters)
  bit 2 — general error (1 = error, 0 = no error)

Other bits reserved / unobserved. Bench captures:
  loaded + ready → 0x40 (bit 6 only)
  no media       → 0x00

Earlier versions of this parser used `bit 1 = no tape` derived
from a spec snippet; LM_PNP wire shows that bit doesn't toggle
on cassette removal. Bit 6 is the actual indicator.

`detectedMedia` is always `undefined` — D1 firmware can detect
cassette **presence** but not **type**. Callers must pass media
explicitly to `print()` / `createPreview()`.

## Parameters

### bytes

`Uint8Array`

## Returns

[`PrinterStatus`](../interfaces/PrinterStatus.md)
