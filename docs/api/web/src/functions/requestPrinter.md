[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / requestPrinter

# Function: requestPrinter()

> **requestPrinter**(`options?`): `Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>

Show the browser's USB picker and wrap the selected device.

Requires a user gesture. The selected `USBDevice` is handed to
`WebUsbTransport.fromDevice()`, which opens it and claims interface 0.

## Parameters

### options?

[`RequestOptions`](../interfaces/RequestOptions.md) = `{}`

## Returns

`Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>
