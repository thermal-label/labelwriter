[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / Composed550Job

# Interface: Composed550Job

A 550 print job split into the segments an interactive write routine
interleaves with `ESC A` status reads. See the
`lw5-raster` protocol doc — "Inter-label status handshake" — for the
wire contract this shape encodes; `write550Job` is its driver.

## Properties

### finalize

> **finalize**: `Uint8Array`

Once, after the last label's handshake: `ESC E` + `ESC Q`.

***

### labels

> **labels**: `Uint8Array`[]

One per copy: `ESC n` + `ESC D` + raster + `ESC G`.

***

### preamble

> **preamble**: `Uint8Array`

Once: `ESC s`, `ESC h`/`ESC i`, `ESC C`, optional `ESC T`.
