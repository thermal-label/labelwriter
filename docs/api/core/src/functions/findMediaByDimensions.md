[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / findMediaByDimensions

# Function: findMediaByDimensions()

> **findMediaByDimensions**(`widthMm`, `heightMm`): [`LabelWriterMedia`](../interfaces/LabelWriterMedia.md) \| `undefined`

Match a 550-series status response against the media registry.

The response carries media dimensions in mm — a simple filter over
`MEDIA` is enough. Returns undefined for sizes outside the registry;
callers can still surface `rawBytes` for unknown roll diagnostics.

## Parameters

### widthMm

`number`

### heightMm

`number`

## Returns

[`LabelWriterMedia`](../interfaces/LabelWriterMedia.md) \| `undefined`
