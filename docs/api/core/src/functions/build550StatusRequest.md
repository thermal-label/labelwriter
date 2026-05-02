[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / build550StatusRequest

# Function: build550StatusRequest()

> **build550StatusRequest**(`lock?`): `Uint8Array`

`ESC A <lock>` — Request Print Engine Status.

Lock semantics per spec p.13:
  0 = no lock (heartbeat / status query during error / between-label query)
  1 = lock interface for printing (acquire before sending a job)
  2 = status query between labels in an active job (does not block)

## Parameters

### lock?

`0` \| `1` \| `2`

## Returns

`Uint8Array`
