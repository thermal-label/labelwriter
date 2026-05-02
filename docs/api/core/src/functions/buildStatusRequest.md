[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / buildStatusRequest

# Function: buildStatusRequest()

> **buildStatusRequest**(`device`, `lock?`): `Uint8Array`

Build the status-request bytes for a given device, optionally with
a 550-family lock byte. On 450-protocol devices, the `lock`
argument is ignored — the firmware reads exactly two bytes.

Lock semantics (550 only, per spec p.13):
  0 = heartbeat / between-label query (default)
  1 = acquire print lock before sending a job
  2 = status query between labels in an active job

## Parameters

### device

`DeviceEntry`

### lock?

`0` \| `1` \| `2`

## Returns

`Uint8Array`
