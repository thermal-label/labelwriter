[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [node/src](../README.md) / LabelWriterPrinter

# Class: LabelWriterPrinter

Node.js driver for Dymo LabelWriter printers.

Implements the shared `PrinterAdapter` interface. Takes any
`Transport` — `UsbTransport` from `@thermal-label/transport/node` for
USB-attached printers, `TcpTransport` for the networked 550 Turbo /
5XL / Wireless.

Multi-engine devices (Twin Turbo, Duo) expose per-engine handles via
`engines`. The Twin Turbo's two label engines share the primary
transport (firmware-level routing by `ESC q`); the Duo's tape engine
needs its own transport on `bInterfaceNumber: 1`, passed via
`options.engineTransports.tape`.

Orientation for label engines is auto-decided via `pickRotation`;
tape engines emit head-aligned bitmaps without rotation logic for
now (the tape encoder does its own width-fit).

## Implements

- `PrinterAdapter`

## Constructors

### Constructor

> **new LabelWriterPrinter**(`device`, `transport`, `transportType`, `options?`): `LabelWriterPrinter`

#### Parameters

##### device

`DeviceEntry`

##### transport

`Transport`

##### transportType

`TransportType`

##### options?

`LabelWriterPrinterOptions` = `{}`

#### Returns

`LabelWriterPrinter`

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

***

### transportType

> `readonly` **transportType**: `TransportType`

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

### getEngineVersion()

> **getEngineVersion**(): `Promise`\<`EngineVersion` \| `undefined`\>

Fetch the print engine identity (HW / FW / PID) via `ESC V` (550 only).

Returns the parsed 34-byte structure on success. Throws
`UnsupportedOperationError` on non-550 devices. Useful as a sanity
check after USB enumeration ("did we open the right device?") or
for surfacing FW version in diagnostics.

#### Returns

`Promise`\<`EngineVersion` \| `undefined`\>

***

### getMedia()

> **getMedia**(): `Promise`\<`SkuInfo` \| `undefined`\>

Fetch the SKU info from the loaded consumable's NFC tag (550 only).

Returns the parsed 63-byte structure on success. Throws
`UnsupportedOperationError` on non-550 devices. Returns `undefined`
if the response is shorter than expected or the magic-number check
fails (no media present, counterfeit, or comm failure).

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

Send the error-recovery byte sequence and drain the response.
Driver-specific escape hatch — not on `PrinterAdapter`.

Protocol-aware:
- **450 family** (`lw-450`): the documented 85×ESC +
  ESC A sequence to flush a wedged sync state. Reads back the
  1-byte status response.
- **550 family**: `ESC Q` to release any pending job state and
  the host print lock (per `LW 550 Technical Reference.pdf`
  p.13). Reads back the 32-byte status response.

The 550 path is the soft recovery; for a destructive reboot
use `build550Restart()` directly with `transport.write()`.

#### Returns

`Promise`\<`void`\>
