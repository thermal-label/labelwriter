[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / PreviewPlane

# Interface: PreviewPlane

A single colour plane in a preview.

Single-colour drivers return exactly one plane. Two-colour drivers
return one plane per colour the printer physically produces.

## Properties

### bitmap

> **bitmap**: `LabelBitmap`

The 1bpp bitmap for this plane.

***

### displayColor

> **displayColor**: `string`

CSS colour to display this plane in the preview UI, e.g.
`'#000000'` for black or `'#ff0000'` for red.

The consuming app renders each plane in its own colour and
composites them — it does not need to know how the driver split
the colours.

***

### name

> **name**: `string`

Plane name, e.g. `'black'` or `'red'`.
