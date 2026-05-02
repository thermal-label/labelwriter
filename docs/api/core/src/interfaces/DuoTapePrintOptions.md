[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / DuoTapePrintOptions

# Interface: DuoTapePrintOptions

Tape-side print options.

`tapeType` is the `ESC C` selector (0..12) — usually derived from
the loaded cassette's media descriptor rather than passed by the
caller; defaults to 0 (black-on-white/clear) when omitted.

`engine` follows the same routing rules as the label side. On a
Duo, callers typically pass `'tape'` to disambiguate from the
label engine.

## Extends

- `Pick`\<[`LabelWriterPrintOptions`](LabelWriterPrintOptions.md), `"engine"` \| `"copies"`\>

## Properties

### engine?

> `optional` **engine?**: `string`

Engine selector for multi-engine devices. `'auto'` is the special
routing mode (firmware-auto byte on Twin Turbo); any other string
is matched against `engines[].role`. Single-engine devices ignore
this. See `LabelWriterPrintOptions` JSDoc above for the full shape.

#### Inherited from

[`LabelWriterPrintOptions`](LabelWriterPrintOptions.md).[`engine`](LabelWriterPrintOptions.md#engine)

***

### tapeType?

> `optional` **tapeType?**: `number`
