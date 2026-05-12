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
on the Duo, where the tape engine sits on its own USB interface and
speaks D1 (1-byte status reply via `@thermal-label/d1-core`) while
the label engine speaks lw-raster (1-byte) or lw5-raster (32-byte).

Adapters expose engines whose protocol the encoder dispatch handles
(`lw-raster` / `lw5-raster` natively; `d1-tape` via d1-core). Tape engines
only appear when a tape transport is provided to the adapter —
without one, the engine is declared in the registry but unreachable.

## Properties

### engine

> `readonly` **engine**: [`PrintEngine`](PrintEngine.md)

***

### role

> `readonly` **role**: `string`

## Methods

### getStatus()?

> `optional` **getStatus**(): `Promise`\<[`PrinterStatus`](PrinterStatus.md)\>

Query just this engine's status — useful on multi-engine devices.

#### Returns

`Promise`\<[`PrinterStatus`](PrinterStatus.md)\>

***

### print()

> **print**(`image`, `media?`, `options?`): `Promise`\<`void`\>

#### Parameters

##### image

`RawImageData`

##### media?

[`MediaDescriptor`](MediaDescriptor.md)

##### options?

`Omit`\<[`LabelWriterPrintOptions`](LabelWriterPrintOptions.md), `"engine"`\>

#### Returns

`Promise`\<`void`\>
