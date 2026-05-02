[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / build550SetLabelCount

# Function: build550SetLabelCount()

> **build550SetLabelCount**(`count`): `Uint8Array`

`ESC o <count>` — Set Label Count.

Per spec p.20, single-byte `count` (0..255). Use case unclear from
the spec — likely overrides the on-printer remaining-labels
counter. Exposed as a low-level builder; no driver method wraps it.

## Parameters

### count

`number`

## Returns

`Uint8Array`
