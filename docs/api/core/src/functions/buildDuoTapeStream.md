[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / buildDuoTapeStream

# Function: buildDuoTapeStream()

> **buildDuoTapeStream**(`bitmap`, `engine`, `options`, `media`): `Promise`\<`Uint8Array`\>

Encode a Duo tape-side job through d1-core's `buildPrinterStream`.
Throws `DuoTapeUnavailableError` if d1-core isn't installed.

Mirrors the arguments the static-import call site used to pass; the
`media` parameter is typed against the labelwriter-side narrowed
`LabelWriterTapeMedia` so the call site doesn't need to know the
shape of `D1Media` at runtime.

## Parameters

### bitmap

[`LabelBitmap`](/contracts/api/interfaces/LabelBitmap)

### engine

[`PrintEngine`](/contracts/api/interfaces/PrintEngine)

### options

#### copies?

`number`

#### tapeType?

`number`

### media

[`LabelWriterTapeMedia`](../interfaces/LabelWriterTapeMedia.md) \| `undefined`

## Returns

`Promise`\<`Uint8Array`\>
