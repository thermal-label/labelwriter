[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / requestPrinter

# Function: requestPrinter()

> **requestPrinter**(`options?`): `Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>

Show the browser's USB picker and wrap the selected device.

Requires a user gesture. Returns the **primary** engine adapter — for
single-engine devices that's the only adapter; for the Duo it's the
label engine (the `lw-*` one). To get every engine adapter on a
multi-interface device, call `requestPrinters()` instead.

Pre-refactor this returned a single instance that routed every print
through one transport — fine for single-interface devices, but the
Duo's tape engine emitted D1 bytes onto the label endpoint. The
per-engine refactor narrows this entry to "primary engine only" and
promotes `requestPrinters()` for full multi-engine coverage.

## Parameters

### options?

[`RequestOptions`](../interfaces/RequestOptions.md) = `{}`

## Returns

`Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>
