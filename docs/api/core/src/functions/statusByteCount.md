[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / statusByteCount

# Function: statusByteCount()

> **statusByteCount**(`device`): `number`

How many bytes to read from the transport for this device's status
response. 1 byte for the 450 family, 32 for the 550 family
(per `LW 550 Technical Reference.pdf` p.8 + 13-15).

## Parameters

### device

`DeviceEntry`

## Returns

`number`
