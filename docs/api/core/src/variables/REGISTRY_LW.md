[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / REGISTRY\_LW

# Variable: REGISTRY\_LW

> `const` **REGISTRY\_LW**: `DeviceRegistry` = `REGISTRY`

Aggregated LabelWriter device registry.

The data is authored as one `data/devices/<KEY>.json5` file per
device; `scripts/compile-data.mjs` validates and aggregates them
into the build artifact `data/devices.json` and the typed
`src/devices.generated.ts` re-exported here.
