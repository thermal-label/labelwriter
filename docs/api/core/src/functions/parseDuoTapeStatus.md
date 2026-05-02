[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / parseDuoTapeStatus

# Function: parseDuoTapeStatus()

> **parseDuoTapeStatus**(`bytes`): `PrinterStatus`

Parse the 8-byte Duo tape status response.

Cutter-jam and cassette-absent are mapped to distinct
`PrinterError.code` values rather than collapsing into
`paper_jam` — the cutter-jam state has a safety caveat
(PDF p.25: "the cutter blade is not retracted and may present
a very sharp, dangerous edge") that warrants its own UI
treatment.

## Parameters

### bytes

`Uint8Array`

## Returns

`PrinterStatus`
