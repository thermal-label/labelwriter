[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterDevice

# Type Alias: LabelWriterDevice

> **LabelWriterDevice** = `DeviceEntry`

Dymo LabelWriter device descriptor.

Alias of the cross-driver `DeviceEntry` shape; LabelWriter entries
declare `family: 'labelwriter'` and use protocol tags `'lw-450'`,
`'lw-550'`, or `'d1-tape'` (Duo tape engine) on each `engines[]`
element.
