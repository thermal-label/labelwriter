[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / isDuoTapeEngine

# Function: isDuoTapeEngine()

> **isDuoTapeEngine**(`engine`): `boolean`

Whether an engine speaks the D1 tape protocol (the Duo's tape
side). Used by adapters to route status queries through d1-core's
1-byte parser instead of the 450/550 multi-byte parsers.

## Parameters

### engine

[`PrintEngine`](/contracts/api/interfaces/PrintEngine)

## Returns

`boolean`
