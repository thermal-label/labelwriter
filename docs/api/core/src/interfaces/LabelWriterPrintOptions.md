[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterPrintOptions

# Interface: LabelWriterPrintOptions

Protocol-internal print options.

Extends the cross-driver `PrintOptions` with the LabelWriter-specific
`density` narrowed to the values the firmware recognises, the
text/graphics mode byte, RLE compression toggle, engine selector
(Twin Turbo / 450 Duo), and the optional 550-series job ID.

`engine` selects which `PrintEngine` on a multi-engine device handles
the job. Dymo labels the Twin Turbo's two rolls "left" and "right"
on the chassis; pass `'left'` or `'right'` to route there explicitly.
Pass `'auto'` (or omit on a Twin Turbo) to let the firmware pick an
available roll — emitted as `ESC q 0x30` per LW 450 Series Tech Ref
p.16. Single-engine devices ignore this option.

`rotate` overrides the orientation heuristic — `'auto'` (default)
defers to the media's `defaultOrientation`; an explicit angle
bypasses it.

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

### engine?

> `optional` **engine?**: `string`

Engine selector for multi-engine devices. `'auto'` is the special
routing mode (firmware-auto byte on Twin Turbo); any other string
is matched against `engines[].role`. Single-engine devices ignore
this. See `LabelWriterPrintOptions` JSDoc above for the full shape.

#### Overrides

`PrintOptions.engine`

***

### jobId?

> `optional` **jobId?**: `number`

***

### mode?

> `optional` **mode?**: `"text"` \| `"graphics"`

***

### rotate?

> `optional` **rotate?**: `0` \| `90` \| `270` \| `"auto"` \| `180`

***

### speed?

> `optional` **speed?**: `"normal"` \| `"high"`

550-only print speed. `'normal'` (the firmware default) prints
with the standard duty cycle; `'high'` engages the high-speed
path documented on LW 550 / 550 Turbo (not on 5XL — which simply
ignores the byte). Per spec, not all label rolls have the
high-speed feature; on rolls that don't, the printer falls back
to normal speed silently.

Omitted → encoder doesn't emit `ESC T` and the firmware default
(Normal Speed) is used.
