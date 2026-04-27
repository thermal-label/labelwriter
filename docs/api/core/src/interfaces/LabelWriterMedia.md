[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterMedia

# Interface: LabelWriterMedia

Dymo LabelWriter media descriptor.

Extends `MediaDescriptor` with the length in printer dots. Die-cut
media carries a fixed `heightMm`; continuous media leaves it
undefined. All LabelWriter media is single-ink (the base `palette`
field stays undefined).

## Extends

- `MediaDescriptor`

## Properties

### lengthDots?

> `optional` **lengthDots?**: `number`

Length in 300-dpi dots — used by the 550 to match status responses.

***

### type

> **type**: `"die-cut"` \| `"continuous"`

Media type classification — driver-specific string values.

Common values: `'continuous'`, `'die-cut'`, `'tape'`.
Drivers may define additional values as needed.

#### Overrides

`MediaDescriptor.type`
