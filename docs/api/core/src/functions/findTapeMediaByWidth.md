[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / findTapeMediaByWidth

# Function: findTapeMediaByWidth()

> **findTapeMediaByWidth**(`widthMm`): [`LabelWriterTapeMedia`](../interfaces/LabelWriterTapeMedia.md) \| `undefined`

Find the lowest-numbered cartridge variant at a given tape width.

For UIs that just want "any 12 mm tape" — typically returns the
Standard Black on White variant. Use `findTapeMediaByWidthAll()`
when the caller needs every variant.

## Parameters

### widthMm

`number`

## Returns

[`LabelWriterTapeMedia`](../interfaces/LabelWriterTapeMedia.md) \| `undefined`
