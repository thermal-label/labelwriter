[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterDevice

# Type Alias: LabelWriterDevice

> **LabelWriterDevice** = [`DeviceEntry`](/contracts/api/interfaces/DeviceEntry)

Dymo LabelWriter device descriptor.

Alias of the cross-driver `DeviceEntry` shape; LabelWriter entries
declare `family: 'labelwriter'` and use protocol tags `'lw-raster'`,
`'lw5-raster'`, or `'d1-tape'` (Duo tape engine) on each `engines[]`
element.
