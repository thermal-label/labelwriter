[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / build550Recovery

# Function: build550Recovery()

> **build550Recovery**(): `Uint8Array`

550 recovery sequence — `ESC Q` to release any pending job state
and the host print lock. Soft path; safe to send at any time.

For a hard recovery (`ESC @` reboot), use `build550Restart()`
separately — it will lose any buffered data and is documented as
destructive.

## Returns

`Uint8Array`
