[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / compose550Job

# Function: compose550Job()

> **compose550Job**(`device`, `bitmap`, `options?`, `media?`): [`Composed550Job`](../interfaces/Composed550Job.md)

Compose a 550 print job as interleavable segments — see
`Composed550Job`. The bitmap is fitted to `headDots` (right-pad
narrower, crop wider) so each raster line is `headDots / 8` bytes.
`compress` is ignored — the 550 raster format has no `SYN` / `ETB`
framing.

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

[`Composed550Job`](../interfaces/Composed550Job.md)
