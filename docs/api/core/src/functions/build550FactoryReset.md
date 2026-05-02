[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / build550FactoryReset

# Function: build550FactoryReset()

> **build550FactoryReset**(): `Uint8Array`

`ESC *` — Restore Print Engine Factory Settings.

**Destructive — wipes user-tunable settings.** Not exposed on the
driver adapter; callers who deliberately want to factory-reset the
engine can write these bytes directly via `transport.write()`.

## Returns

`Uint8Array`
