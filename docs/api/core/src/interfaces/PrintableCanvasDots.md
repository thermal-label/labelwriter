[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / PrintableCanvasDots

# Interface: PrintableCanvasDots

## Properties

### leadingDots

> **leadingDots**: `number`

Feed-direction dots the authoring layer must subtract from the
label's physical length to get the printable height. With LW 3xx
/4xx/5xx engines this is `Math.round(6 mm * dpi / 25.4)` — 71 dots
at 300 dpi.

***

### leftDots

> **leftDots**: `number`

Left-edge cross-feed dead zone. `0` everywhere on LW today.

***

### rightDots

> **rightDots**: `number`

Right-edge cross-feed dead zone. `0` everywhere on LW today.

***

### trailingDots

> **trailingDots**: `number`

Trailing-edge dead zone in feed direction. `0` everywhere on LW
today (the head reaches the trailing edge); plumbed through for
symmetry and future-proofing.

***

### widthDots

> **widthDots**: `number`

Cross-feed dimension the authored bitmap should use. Equals
`engine.headDots − leftDots − rightDots`. With today's all-zero
`left`/`right` values across LW devices this is just `headDots`.
