[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / WebLabelWriterPrinter

# Class: WebLabelWriterPrinter

WebUSB `PrinterAdapter` for Dymo LabelWriter printers.

Thin wrapper around the shared `WebUsbTransport`. Mirrors the node
driver's `pickRotation` wiring: rectangular die-cut media auto-rotates
landscape input via the media's `defaultOrientation` hint.

## Implements

- `PrinterAdapter`

## Constructors

### Constructor

> **new WebLabelWriterPrinter**(`device`, `transport`): `WebLabelWriterPrinter`

#### Parameters

##### device

`DeviceEntry`

##### transport

`Transport`

#### Returns

`WebLabelWriterPrinter`

## Properties

### device

> `readonly` **device**: `DeviceEntry`

The device entry for the connected printer.

Useful for logging, diagnostics, and displaying VID/PID. Undefined
if the connection was established without device matching (e.g. a
raw TCP connection to a known IP).

#### Implementation of

`PrinterAdapter.device`

***

### engines

> `readonly` **engines**: `Readonly`\<`Record`\<`string`, `LabelWriterEngineHandle`\>\>

***

### family

> `readonly` **family**: `"labelwriter"`

Driver family identifier, e.g. `'brother-ql'` or `'labelwriter'`.

#### Implementation of

`PrinterAdapter.family`

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

Whether the printer is currently connected.

##### Returns

`boolean`

#### Implementation of

`PrinterAdapter.connected`

***

### model

#### Get Signature

> **get** **model**(): `string`

Human-readable model name from the driver's device registry.

##### Returns

`string`

#### Implementation of

`PrinterAdapter.model`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the connection. Always call in `finally` blocks.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`PrinterAdapter.close`

***

### createPreview()

> **createPreview**(`image`, `options?`): `Promise`\<`PreviewResult`\>

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

`PreviewOptions`

— optional media override. If media is omitted, uses
  detected media from the last `getStatus()`. If no status is
  available, the driver defaults to single-colour at the printer's
  native head width and sets `PreviewResult.assumed = true`.

#### Returns

`Promise`\<`PreviewResult`\>

#### Implementation of

`PrinterAdapter.createPreview`

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

> **getStatus**(): `Promise`\<`PrinterStatus`\>

Query printer status including detected media.

#### Returns

`Promise`\<`PrinterStatus`\>

#### Implementation of

`PrinterAdapter.getStatus`

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

`MediaDescriptor`

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

`PrinterAdapter.print`

***

### recover()

> **recover**(): `Promise`\<`void`\>

Driver-specific recovery sequence — mirror of the node driver.

550 family sends `ESC Q` (release pending job + host lock); 450
family sends the legacy 85×ESC + ESC A sync-flush. Drains the
device-appropriate status response in either case.

#### Returns

`Promise`\<`void`\>
