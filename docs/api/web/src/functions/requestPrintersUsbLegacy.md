[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / requestPrintersUsbLegacy

# ~~Function: requestPrintersUsbLegacy()~~

> **requestPrintersUsbLegacy**(`options?`): `Promise`\<`Record`\<`string`, [`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>\>

## Parameters

### options?

[`RequestOptions`](../interfaces/RequestOptions.md) = `{}`

## Returns

`Promise`\<`Record`\<`string`, [`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>\>

## Deprecated

Use the generic `requestPrinters({ transport: 'usb' })`
  from `./request-printers.ts`; the legacy USB-only `requestPrinters`
  is preserved as `requestPrintersUsbLegacy` for back-compat. Removed
  once consumers migrate (plan 11).
