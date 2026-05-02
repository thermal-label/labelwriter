[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterEngineHandle

# Interface: LabelWriterEngineHandle

Adapter-side handle for a single `PrintEngine` on a multi-engine
device.

`print()` pre-binds `options.engine` to this engine's role and
forwards to the parent adapter's `print()`. Use it to route a job
explicitly: `printer.engines.left.print(image, media)`.

`getStatus()` queries the engine over its own transport — relevant
on the Duo, where the tape engine has its own status response shape
(8 bytes via `parseDuoTapeStatus`) on a different USB interface
than the label engine (1 byte via `parseStatus`).

Adapters expose engines whose protocol either the labelwriter
encoder handles (`lw-450` / `lw-550`) or the duo-tape encoder
handles (`d1-tape`). Tape engines only appear when a tape
transport is provided to the adapter — without one, the engine is
declared in the registry but unreachable.

## Properties

### engine

> `readonly` **engine**: `PrintEngine`

***

### role

> `readonly` **role**: `string`

## Methods

### getStatus()?

> `optional` **getStatus**(): `Promise`\<`PrinterStatus`\>

Query just this engine's status — useful on multi-engine devices.

#### Returns

`Promise`\<`PrinterStatus`\>

***

### print()

> **print**(`image`, `media?`, `options?`): `Promise`\<`void`\>

#### Parameters

##### image

`RawImageData`

##### media?

`MediaDescriptor`

##### options?

`Omit`\<[`LabelWriterPrintOptions`](LabelWriterPrintOptions.md), `"engine"`\>

#### Returns

`Promise`\<`void`\>
