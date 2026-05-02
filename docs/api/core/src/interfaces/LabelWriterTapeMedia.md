[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterTapeMedia

# Interface: LabelWriterTapeMedia

Duo tape-cassette media descriptor.

Tape is continuous along its length, so `heightMm` is omitted —
`widthMm` is the tape width (6, 9, 12, 19, or 24 mm). `tapeColour`
is the `ESC C` selector (0..12 per PDF p.24) identifying which
cassette is loaded; defaults to 0 (black on white/clear) when
omitted.

Parallel to (not a variant of) `LabelWriterMedia`: the tape engine
has its own protocol module and doesn't share the die-cut/continuous
length-dots plumbing. Routed via discrimination on `type`.

Catalogue metadata (`material`, `background`, `text`) is optional
to keep the type compatible with user-constructed descriptors;
`DUO_TAPE_MEDIA` entries declare all three.

## Extends

- `MediaDescriptor`

## Properties

### background?

> `optional` **background?**: [`D1TapeColor`](../type-aliases/D1TapeColor.md)

Background colour of the tape — drives preview rendering.

***

### material?

> `optional` **material?**: [`D1Material`](../type-aliases/D1Material.md)

Cartridge material family — drives docs grouping + UI.

***

### tapeColour?

> `optional` **tapeColour?**: `number`

ESC C selector 0..12; defaults to 0 (black on white) when omitted.

***

### tapeWidthMm

> **tapeWidthMm**: [`DuoTapeWidth`](../type-aliases/DuoTapeWidth.md)

***

### text?

> `optional` **text?**: [`D1TapeColor`](../type-aliases/D1TapeColor.md)

Print colour.

***

### type

> **type**: `"tape"`

Media type classification — driver-specific string values.

Common values: `'continuous'`, `'die-cut'`, `'tape'`.
Drivers may define additional values as needed.

#### Overrides

`MediaDescriptor.type`
