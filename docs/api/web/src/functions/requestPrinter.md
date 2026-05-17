[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / requestPrinter

# ~~Function: requestPrinter()~~

> **requestPrinter**(`options?`): `Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>

Show the browser's USB picker and wrap the selected device.

Requires a user gesture. Returns the **primary** engine adapter — for
single-engine devices that's the only adapter; for the Duo it's the
label engine (the `lw-*` one).

## Parameters

### options?

[`RequestOptions`](../interfaces/RequestOptions.md) = `{}`

## Returns

`Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>

## Deprecated

Use `requestPrinters({ transport: 'usb' })` from
  `./request-printers.ts` — the generic factory returns the full
  per-engine `PrinterAdapterMap`. Removed once consumers migrate
  (plan 11).
