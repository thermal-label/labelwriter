[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / encodeDuoTapeLabel

# Function: encodeDuoTapeLabel()

> **encodeDuoTapeLabel**(`device`, `bitmap`, `options?`, `media?`): `Promise`\<`Uint8Array`\>

Async tape-side encoder for the LabelWriter Duo (`d1-tape` protocol).

Lazy-loads `@thermal-label/d1-core`'s `buildPrinterStream` through
the duo-tape bridge — d1-core is an OPTIONAL peer of labelwriter-core,
so this throws `DuoTapeUnavailableError` if the consumer hasn't
installed it. Consumers driving only the LW/LW5 raster engines
never reach this path and don't pay the dep cost.

Validates that `media.type === 'tape'` when media is supplied, then
forwards to d1-core with `options.copies` and the media's
pre-computed `tapeColour` (ESC C selector).

## Parameters

### device

[`DeviceEntry`](../interfaces/DeviceEntry.md)

### bitmap

`LabelBitmap`

### options?

[`LabelWriterPrintOptions`](../interfaces/LabelWriterPrintOptions.md) = `{}`

### media?

[`MediaDescriptor`](../interfaces/MediaDescriptor.md)

## Returns

`Promise`\<`Uint8Array`\>
