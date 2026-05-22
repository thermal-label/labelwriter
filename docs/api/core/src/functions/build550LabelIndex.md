[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / build550LabelIndex

# Function: build550LabelIndex()

> **build550LabelIndex**(`index`): `Uint8Array`

`ESC n <index>` — Set Label Index. 2-byte u16, little-endian.

The 550 status frame echoes the label index back in a u16 field
(status bytes 5-6), and minlux/dymon's Wireshark capture of the DYMO
software shows a 2-byte field on the wire. An earlier revision
emitted a u32 here — two bytes too wide — which left two stray `0x00`
bytes in the job stream ahead of `ESC D` and can desync the
firmware's command parser.

## Parameters

### index

`number`

## Returns

`Uint8Array`
