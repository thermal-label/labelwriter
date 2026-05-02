[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / isEngineDrivable

# Function: isEngineDrivable()

> **isEngineDrivable**(`engine`): `boolean`

Whether *this module's* `encodeLabel` produces a correct byte stream
for a given engine. Adapters use this together with `isDuoTapeEngine`
to route engines to the right encoder (label vs tape).

## Parameters

### engine

`PrintEngine`

## Returns

`boolean`
