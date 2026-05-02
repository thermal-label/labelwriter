[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / encode550Label

# Function: encode550Label()

> **encode550Label**(`device`, `bitmap`, `options?`): `Uint8Array`

Encode a complete 550-protocol print job for one or more copies.

The bitmap is fitted to the engine's `headDots` (right-padded if
narrower, cropped if wider) so each raster line is exactly
`headDots / 8` bytes. Copies share the same bitmap; each gets its
own `ESC n` index and `ESC D` header. Inter-copy feed is `ESC G`;
the final feed is `ESC E`. Job is closed with `ESC Q`.

`compress` is silently ignored — the 550 raster format does not
carry the 450's `SYN` / `ETB` framing and therefore cannot RLE.

## Parameters

### device

`DeviceEntry`

### bitmap

`LabelBitmap`

### options?

[`LabelWriterPrintOptions`](../interfaces/LabelWriterPrintOptions.md) = `{}`

## Returns

`Uint8Array`
