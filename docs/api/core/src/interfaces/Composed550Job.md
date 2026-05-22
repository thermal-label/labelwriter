[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / Composed550Job

# Interface: Composed550Job

A 550 print job split into the segments an interactive print routine
writes, with a status handshake between them.

The 550 firmware stops draining the bulk-OUT endpoint after each
label's `ESC G` footer until the host issues `ESC A` and reads the
32-byte status reply — a monolithic write of the whole job therefore
hangs mid-stream. Confirmed against minlux/dymon's Wireshark capture
(`dymon.cpp`) and the LW 550 Technical Reference. The driver must:
write `preamble`, then for each `labels` segment write it, issue
`ESC A` and drain the 32-byte status, then write `finalize`.

## Properties

### finalize

> **finalize**: `Uint8Array`

Job trailer — written once after the last label's handshake: `ESC E` + `ESC Q`.

***

### labels

> **labels**: `Uint8Array`[]

One segment per copy: `ESC n` + `ESC D` + raster + `ESC G`. After
writing each, the driver must issue `ESC A` and drain the 32-byte
status reply before the next segment / the trailer.

***

### preamble

> **preamble**: `Uint8Array`

Job preamble — written once: `ESC s`, `ESC h`/`ESC i`, `ESC C`, optional `ESC T`.
