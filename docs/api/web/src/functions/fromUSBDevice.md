[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / fromUSBDevice

# Function: fromUSBDevice()

> **fromUSBDevice**(`usbDevice`): `Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>

Wrap an already-selected `USBDevice` (e.g. from
`navigator.usb.getDevices()`) and return the **primary** engine's
adapter. The primary is the first `lw-*` engine on the device, or
the first drivable engine if none speak `lw-*`.

## Parameters

### usbDevice

`USBDevice`

## Returns

`Promise`\<[`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>

## Throws

when the VID/PID is not in the LabelWriter registry.
