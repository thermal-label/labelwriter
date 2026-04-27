[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterPrintOptions

# Interface: LabelWriterPrintOptions

Protocol-internal print options.

Extends the cross-driver `PrintOptions` with the LabelWriter-specific
`density` narrowed to the values the firmware recognises, the
text/graphics mode byte, RLE compression toggle, roll selector (Twin
Turbo / 450 Duo), and the optional 550-series job ID. `rotate`
overrides the orientation heuristic — `'auto'` (default) defers to
the media's `defaultOrientation`; an explicit angle bypasses it.

## Extends

- `PrintOptions`

## Properties

### compress?

> `optional` **compress?**: `boolean`

***

### density?

> `optional` **density?**: [`Density`](../type-aliases/Density.md)

Driver-specific density setting.

Common values: `'light'`, `'normal'`, `'dark'`. Some drivers support
additional values such as `'medium'` or `'high'`. Drivers throw
`UnsupportedOperationError` for unrecognised values.

`'normal'` is universally supported across all drivers.

#### Overrides

`PrintOptions.density`

***

### jobId?

> `optional` **jobId?**: `number`

***

### mode?

> `optional` **mode?**: `"text"` \| `"graphics"`

***

### roll?

> `optional` **roll?**: `0` \| `1`

***

### rotate?

> `optional` **rotate?**: `0` \| `90` \| `270` \| `"auto"` \| `180`
