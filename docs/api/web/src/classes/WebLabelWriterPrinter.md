[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / WebLabelWriterPrinter

# Class: WebLabelWriterPrinter

WebUSB `PrinterAdapter` for Dymo LabelWriter printers.

Each instance is scoped to **one** `PrintEngine`. Single-engine
devices (most of the LW family) get one instance; multi-interface
composite devices (Duo: `label` on IF 0, `tape` on IF 1) get one
instance per engine, each holding its own transport. `requestPrinters()`
returns a `Record<role, PrinterAdapter>` covering every drivable
engine on the picked device.

Mirrors the node driver's `pickRotation` wiring: rectangular die-cut
media auto-rotates landscape input via the media's
`defaultOrientation` hint.

## Implements

- [`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md)

## Constructors

### Constructor

> **new WebLabelWriterPrinter**(`device`, `transport`, `options?`): `WebLabelWriterPrinter`

#### Parameters

##### device

[`DeviceEntry`](../../../core/src/interfaces/DeviceEntry.md)

##### transport

[`Transport`](../../../core/src/interfaces/Transport.md)

##### options?

[`WebLabelWriterPrinterOptions`](../interfaces/WebLabelWriterPrinterOptions.md) = `{}`

#### Returns

`WebLabelWriterPrinter`

## Properties

### device

> `readonly` **device**: [`DeviceEntry`](../../../core/src/interfaces/DeviceEntry.md)

The device entry for the connected printer.

Useful for logging, diagnostics, and displaying VID/PID. Undefined
if the connection was established without device matching (e.g. a
raw TCP connection to a known IP).

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`device`](../../../core/src/interfaces/PrinterAdapter.md#device)

***

### engine

> `readonly` **engine**: [`PrintEngine`](../../../core/src/interfaces/PrintEngine.md)

***

### engines

> `readonly` **engines**: `Readonly`\<`Record`\<`string`, `LabelWriterEngineHandle`\>\>

***

### family

> `readonly` **family**: `"labelwriter"`

Driver family identifier, e.g. `'brother-ql'` or `'labelwriter'`.

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`family`](../../../core/src/interfaces/PrinterAdapter.md#family)

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

Whether the printer is currently connected.

##### Returns

`boolean`

Whether the printer is currently connected.

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`connected`](../../../core/src/interfaces/PrinterAdapter.md#connected)

***

### model

#### Get Signature

> **get** **model**(): `string`

Human-readable model name from the driver's device registry.

##### Returns

`string`

Human-readable model name from the driver's device registry.

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`model`](../../../core/src/interfaces/PrinterAdapter.md#model)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the connection. Always call in `finally` blocks.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`close`](../../../core/src/interfaces/PrinterAdapter.md#close)

***

### createPreview()

> **createPreview**(`image`, `options?`): `Promise`\<[`PreviewResult`](../../../core/src/interfaces/PreviewResult.md)\>

Generate a preview showing how this printer would reproduce the
design on the given media. Returns separated 1bpp planes with
display colours.

The driver uses its own colour-splitting logic (the same code that
`print()` uses internally) to produce the planes. The consuming app
renders whatever planes come back without needing to know the
splitting rules.

For offline preview without a live connection, use the static
`createPreviewOffline()` function exported from the driver's
`*-core` package instead.

#### Parameters

##### image

`RawImageData`

— full RGBA, typically from `designer.render()`.

##### options?

[`PreviewOptions`](../../../core/src/interfaces/PreviewOptions.md)

— optional media override. If media is omitted, uses
  detected media from the last `getStatus()`. If no status is
  available, the driver defaults to single-colour at the printer's
  native head width and sets `PreviewResult.assumed = true`.

#### Returns

`Promise`\<[`PreviewResult`](../../../core/src/interfaces/PreviewResult.md)\>

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`createPreview`](../../../core/src/interfaces/PrinterAdapter.md#createpreview)

***

### getEngineVersion()

> **getEngineVersion**(): `Promise`\<`EngineVersion` \| `undefined`\>

Fetch the print engine's HW/FW/PID identity block (`ESC V`,
550 only). Mirror of the node driver's `getEngineVersion()`.

Named `getEngineVersion` for parity with the node driver
(`@thermal-label/labelwriter-node`); the harness adapter reads it
under that name. 550-only — throws `UnsupportedOperationError` on
every other engine, same shape as `getMedia()`.

#### Returns

`Promise`\<`EngineVersion` \| `undefined`\>

***

### getMedia()

> **getMedia**(): `Promise`\<`SkuInfo` \| `undefined`\>

Fetch SKU info from the loaded consumable's NFC tag (550 only).
Mirror of the node driver's `getMedia()` — see that JSDoc for the
full contract.

#### Returns

`Promise`\<`SkuInfo` \| `undefined`\>

***

### getStatus()

> **getStatus**(): `Promise`\<[`PrinterStatus`](../../../core/src/interfaces/PrinterStatus.md)\>

Status read for this instance's scoped engine. Dispatches by
`engine.protocol`:

- `d1-tape` (Duo tape side) — `SYN` request, 1-byte reply parsed
  via `@thermal-label/d1-core`.
- `lw-raster` / `lw5-raster` — `ESC A`-shaped request, multi-byte reply
  parsed via labelwriter-core.

Pre-refactor this was hardcoded to `device.engines[0].protocol`,
which on the Duo always meant `lw-raster` and silently corrupted the
tape engine's status byte stream. The per-engine instance now
routes by its own engine.

#### Returns

`Promise`\<[`PrinterStatus`](../../../core/src/interfaces/PrinterStatus.md)\>

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`getStatus`](../../../core/src/interfaces/PrinterAdapter.md#getstatus)

***

### onStatus()

> **onStatus**(`cb`): () => `void`

Subscribe to status updates. LabelWriter firmware (across the
3xx/4xx/5xx and Duo families) doesn't push unsolicited status
frames; this is a polling shim built on `pollingOnStatus` from
contracts, which calls `getStatus()` on first subscribe and then
every 4 s.

Per plan 11 §`onStatus` parity — every driver-web printer
implements `onStatus` so the harness shell can collapse its
push-vs-pull branch in `createStatusPolling.ts` into a single
subscription path. On the LW Duo each engine instance gets its
own poll loop (the harness creates one subscription per role).

#### Parameters

##### cb

(`status`) => `void`

#### Returns

() => `void`

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`onStatus`](../../../core/src/interfaces/PrinterAdapter.md#onstatus)

***

### print()

> **print**(`image`, `media?`, `options?`): `Promise`\<`void`\>

Print from a full-colour RGBA image.

The driver converts to its native format internally:

- Single-colour media (`media.palette` undefined) — threshold/dither
  RGBA to a single 1bpp plane via `renderImage`.
- Multi-ink media (`media.palette` defined) — split into planes via
  `renderMultiPlaneImage` using that palette.

**Orientation:** drivers compute the rotation via `pickRotation`
(see `./orientation.ts`) — the input image is treated as the
intended visual; the driver auto-rotates landscape input on media
tagged `defaultOrientation: 'horizontal'`.

**Multi-ink splitting:** the palette on the media descriptor names
every ink the driver should classify pixels into; the contracts
package does not pick "red" or "black" — those facts live with the
media entry.

**Batch printing:** call `print()` once per label. The driver
handles job framing internally (e.g. Brother QL page-break commands
between sequential `print()` calls within the same session).

#### Parameters

##### image

`RawImageData`

— full RGBA, typically from `designer.render()`.

##### media?

[`MediaDescriptor`](../../../core/src/interfaces/MediaDescriptor.md)

— which media to print on. Determines dimensions,
  margins, and colour mode. If omitted, uses detected media from
  the last `getStatus()`.

##### options?

`LabelWriterPrintOptions`

— per-call options (copies, density, etc.).

#### Returns

`Promise`\<`void`\>

#### Throws

MediaNotSpecifiedError if no media is known.

#### Implementation of

[`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md).[`print`](../../../core/src/interfaces/PrinterAdapter.md#print)

***

### recover()

> **recover**(): `Promise`\<`void`\>

Driver-specific recovery sequence — mirror of the node driver.

550 family sends `ESC Q` (release pending job + host lock); 450
family sends the legacy 85×ESC + ESC A sync-flush. Drains the
device-appropriate status response in either case.

D1 tape engines have no protocol-level recovery sequence — calling
recover on a tape-scoped instance is a no-op.

#### Returns

`Promise`\<`void`\>
