[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / getPrintableCanvasDots

# Function: getPrintableCanvasDots()

> **getPrintableCanvasDots**(`engine`, `media?`): [`PrintableCanvasDots`](../interfaces/PrintableCanvasDots.md)

Resolve the printable-canvas deductions for a given engine + media,
in dot space. Callers compose their authored bitmap at
`widthDots × (mediaLengthDots − leadingDots − trailingDots)` for
die-cut media (or any user-chosen height for continuous, minus the
dead zones).

The encoder no longer reads these values — they are the authoring
layer's responsibility. When a caller authors a bitmap shorter than
the actual label length, it must also pass
`options.labelLengthDots = media.lengthDots` to `encodeLabel` so the
printer's form-feed pitch is correct.

## Parameters

### engine

[`PrintEngine`](/contracts/api/interfaces/PrintEngine)

### media?

[`MediaDescriptor`](/contracts/api/interfaces/MediaDescriptor)

## Returns

[`PrintableCanvasDots`](../interfaces/PrintableCanvasDots.md)
