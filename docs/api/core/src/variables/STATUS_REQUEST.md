[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / STATUS\_REQUEST

# Variable: STATUS\_REQUEST

> `const` **STATUS\_REQUEST**: `Uint8Array`

`ESC A` — Request Print Engine Status. Two-byte form on the 450
family (`1B 41`); three-byte form on the 550 family with a lock
parameter (`1B 41 <lock>`). Use `buildStatusRequest(device)` to
pick the right shape.

Constant kept for back-compat — it's the 450 form, which is also
what the 550 firmware accepts as a no-lock heartbeat (the lock
byte defaults to 0).
