[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / parseDuoTapeStatus

# Function: parseDuoTapeStatus()

> **parseDuoTapeStatus**(`bytes`): `Promise`\<[`PrinterStatus`](/contracts/api/interfaces/PrinterStatus)\>

Lazy parser for the Duo tape engine's 1-byte status reply. Throws
`DuoTapeUnavailableError` if d1-core isn't installed.

## Parameters

### bytes

`Uint8Array`

## Returns

`Promise`\<[`PrinterStatus`](/contracts/api/interfaces/PrinterStatus)\>
