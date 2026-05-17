[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterTapeMedia

# Interface: LabelWriterTapeMedia

Duo tape-cassette media descriptor.

Extends `D1Media` from `@thermal-label/d1-core` (the shared D1 tape
shape) with LabelWriter-specific narrowing: `type` fixed to `'tape'`,
`tapeWidthMm` narrowed to the supported widths, `text` / `background`
narrowed to `D1TapeColor`, plus the catalogue's pre-computed
`tapeColour` (ESC C selector) and `material` family for picker UX.

Routed by the `encodeLabel` dispatcher to `@thermal-label/d1-core`'s
`buildPrinterStream` — same encoder the LabelManager driver uses.

## Extends

- `D1Media`

## Properties

### background?

> `optional` **background?**: [`D1TapeColor`](../type-aliases/D1TapeColor.md)

Background colour of the tape — drives preview rendering.

#### Overrides

`D1Media.background`

***

### material?

> `optional` **material?**: [`D1Material`](../type-aliases/D1Material.md)

Cartridge material family — drives docs grouping + UI.

#### Overrides

`D1Media.material`

***

### tapeColour?

> `optional` **tapeColour?**: `number`

Pre-computed ESC C selector 0..12; mirrors `tapeTypeFor(media)`.

***

### tapeWidthMm

> **tapeWidthMm**: [`DuoTapeWidth`](../type-aliases/DuoTapeWidth.md)

Tape width in mm — informational; the encoder reads `printableDots`.

#### Overrides

`D1Media.tapeWidthMm`

***

### text?

> `optional` **text?**: [`D1TapeColor`](../type-aliases/D1TapeColor.md)

Print colour.

#### Overrides

`D1Media.text`

***

### type

> **type**: `"tape"`

Media type classification — driver-specific string values.

Common values: `'continuous'`, `'die-cut'`, `'tape'`.
Drivers may define additional values as needed.

#### Overrides

`D1Media.type`
