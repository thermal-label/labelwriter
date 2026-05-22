[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / compose550Job

# Function: compose550Job()

> **compose550Job**(`device`, `bitmap`, `options?`, `media?`): [`Composed550Job`](../interfaces/Composed550Job.md)

Compose a 550 print job as interleavable segments — see
`Composed550Job` for why the 550 can't take a monolithic write.

The bitmap is fitted to the engine's `headDots` (right-padded if
narrower, cropped if wider) so each raster line is exactly
`headDots / 8` bytes. Copies share the same bitmap; each gets its
own `ESC n` index and `ESC D` header and ends with an `ESC G`
footer. `ESC E` (feed to tear) + `ESC Q` (end job) close the job
once, in `finalize`.

`compress` is silently ignored — the 550 raster format does not
carry the 450's `SYN` / `ETB` framing and therefore cannot RLE.

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
