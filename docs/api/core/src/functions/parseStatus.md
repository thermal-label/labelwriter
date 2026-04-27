[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / parseStatus

# Function: parseStatus()

> **parseStatus**(`device`, `bytes`): `PrinterStatus`

Dispatch to the right protocol parser.

Call `byteCount(device)` first to know how many bytes to read from
the transport. The two protocols differ — 450 is one byte, 550 is 32.

## Parameters

### device

[`LabelWriterDevice`](../interfaces/LabelWriterDevice.md)

### bytes

`Uint8Array`

## Returns

`PrinterStatus`
