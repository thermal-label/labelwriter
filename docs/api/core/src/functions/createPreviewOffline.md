[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / createPreviewOffline

# Function: createPreviewOffline()

> **createPreviewOffline**(`image`, `media`): `PreviewResult`

Offline preview without a live printer connection.

LabelWriter is single-colour, so the result is always a single black
plane. Callers that need the preview to match the exact 300-DPI head
geometry are responsible for scaling; this function just renders the
RGBA with the same Atkinson dither used by `print()`.

## Parameters

### image

`RawImageData`

### media

[`LabelWriterMedia`](../interfaces/LabelWriterMedia.md)

## Returns

`PreviewResult`
