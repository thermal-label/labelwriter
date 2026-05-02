[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / findDevice

# Function: findDevice()

> **findDevice**(`vid`, `pid`): `DeviceEntry` \| `undefined`

Find a registry entry by USB VID and PID.

VIDs and PIDs in the registry are stored as hex strings (`'0x0922'`)
matching what every datasheet, lsusb output, and forum post uses.
Callers passing JS numbers (e.g. `usbDevice.vendorId`) are matched
after parsing.

## Parameters

### vid

`number`

### pid

`number`

## Returns

`DeviceEntry` \| `undefined`
