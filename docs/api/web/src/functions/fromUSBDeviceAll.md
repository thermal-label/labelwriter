[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / fromUSBDeviceAll

# Function: fromUSBDeviceAll()

> **fromUSBDeviceAll**(`usbDevice`): `Promise`\<`Record`\<`string`, [`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>\>

Wrap an already-selected `USBDevice` and return one adapter per
drivable engine. Public surface for `requestPrinters()`; exported so
harnesses that already hold a `USBDevice` (e.g. picked-up via
`navigator.usb.getDevices()` on a returning visit) can skip the
picker.

## Parameters

### usbDevice

`USBDevice`

## Returns

`Promise`\<`Record`\<`string`, [`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>\>
