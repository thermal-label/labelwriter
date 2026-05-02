[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / buildDuoSetTapeType

# Function: buildDuoSetTapeType()

> **buildDuoSetTapeType**(`selector`): `Uint8Array`

`ESC C n` — set tape type (heat sensitivity / colour palette).

`n` is a selector 0..12 from the palette table in PDF page 24:
  0 black-on-white/clear, 1 black-on-blue, …, 12 red-on-white.

The byte identifies what cassette is loaded so the firmware can
pick the right strobe profile; it does not change the printed ink
(ink is determined by the cassette itself).

## Parameters

### selector

`number`

## Returns

`Uint8Array`
