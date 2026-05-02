[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / findMediaByDimensions

# Function: findMediaByDimensions()

> **findMediaByDimensions**(`widthMm`, `heightMm`): [`LabelWriterMedia`](../interfaces/LabelWriterMedia.md) \| `undefined`

Match a 550-series status response against the paper portion of the
media registry.

The status response carries paper roll dimensions in mm — a simple
filter is enough. Tape cassettes (`type: 'tape'`) are excluded since
the 550 doesn't have a tape head. Returns undefined for sizes
outside the registry; callers can still surface `rawBytes` for
unknown-roll diagnostics.

## Parameters

### widthMm

`number`

### heightMm

`number`

## Returns

[`LabelWriterMedia`](../interfaces/LabelWriterMedia.md) \| `undefined`
