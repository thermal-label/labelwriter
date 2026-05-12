[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / PROTOCOLS

# Variable: PROTOCOLS

> `const` **PROTOCOLS**: `ReadonlySet`\<`string`\>

Protocols this core's encoder produces correct wire bytes for.
Pair with `REGISTRY_LW` and pass to `resolveSupportedDevices` from
`@thermal-label/contracts` to filter a device list down to what
this runtime can actually drive.

`d1-tape` (Duo tape side) is dispatched through
`@thermal-label/d1-core`'s `buildPrinterStream`; the entry here
keeps device-list filters simple — a Duo is fully drivable from
this driver alone.
