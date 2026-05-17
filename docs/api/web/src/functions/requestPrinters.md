[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / requestPrinters

# Function: requestPrinters()

> **requestPrinters**(`opts`): `Promise`\<`Readonly`\<`Record`\<`string`, [`PrinterAdapter`](/contracts/api/interfaces/PrinterAdapter)\>\>\>

Unified browser-picker factory for the labelwriter driver family.

LabelWriter devices are USB-only — the registry declares no other
transports. Non-USB transports throw immediately.

USB path: opens the picker, auto-identifies via VID/PID against the
registry. Composite devices (LW 450 Duo) get one transport per
engine (label on IF 0, tape on IF 1) so the returned
`PrinterAdapterMap` has one entry per engine role. Single-engine
devices return a 1-key map.

Throws `DeviceIdentificationRequiredError` (with USB-capable
candidates + a `continueWith` closure reusing the picked
USBDevice) when the picked device's VID/PID is not in the
labelwriter registry.

## Parameters

### opts

[`ConnectOptions`](/contracts/api/type-aliases/ConnectOptions)

## Returns

`Promise`\<`Readonly`\<`Record`\<`string`, [`PrinterAdapter`](/contracts/api/interfaces/PrinterAdapter)\>\>\>
