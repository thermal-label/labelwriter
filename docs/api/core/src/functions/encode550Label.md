[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / encode550Label

# Function: encode550Label()

> **encode550Label**(`device`, `bitmap`, `options?`, `media?`): `Uint8Array`

Encode a complete 550 print job as one contiguous byte array —
`preamble` + every `labels` segment + `finalize` from
`compose550Job`, with the inter-segment status handshakes omitted.

This is the offline / test view of the job. **Real printing must go
through `compose550Job` + the driver's interactive routine** —
writing this blob in one shot hangs the 550 firmware (see
`Composed550Job`).

## Parameters

### device

[`DeviceEntry`](/contracts/api/interfaces/DeviceEntry)

### bitmap

[`LabelBitmap`](/contracts/api/interfaces/LabelBitmap)

### options?

[`LabelWriterPrintOptions`](../interfaces/LabelWriterPrintOptions.md) = `{}`

### media?

[`MediaDescriptor`](/contracts/api/interfaces/MediaDescriptor)

## Returns

`Uint8Array`
