[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / PROTOCOLS

# Variable: PROTOCOLS

> `const` **PROTOCOLS**: `ReadonlySet`\<`string`\>

Protocols this core's encoder produces correct wire bytes for.
Pair with `REGISTRY_LW` and pass to `resolveSupportedDevices` from
`@thermal-label/contracts` to filter a device list down to what
this runtime can actually drive.

Note: the LabelWriter Duo's tape engine uses `d1-tape`, which is
encoded by `@thermal-label/labelmanager-core`, not here.
