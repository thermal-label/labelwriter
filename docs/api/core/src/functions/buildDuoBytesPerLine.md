[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / buildDuoBytesPerLine

# Function: buildDuoBytesPerLine()

> **buildDuoBytesPerLine**(`n`, `headDots`): `Uint8Array`

`ESC D n` — set bytes-per-line.

Per PDF page 23, max is `headDots / 8` (12 for the 96-dot Duo,
16 for the 128-dot Duo). Out-of-range values are silently clamped
by the firmware; we throw to surface caller bugs early.

## Parameters

### n

`number`

### headDots

`number`

## Returns

`Uint8Array`
