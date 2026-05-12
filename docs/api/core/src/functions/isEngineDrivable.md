[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / isEngineDrivable

# Function: isEngineDrivable()

> **isEngineDrivable**(`engine`): `boolean`

Whether *this module's* `encodeLabel` produces a correct byte stream
for a given engine. Adapters use this to filter the device's
engines down to drivable ones at construction time.

## Parameters

### engine

[`PrintEngine`](../interfaces/PrintEngine.md)

## Returns

`boolean`
