[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / build550LabelHeader

# Function: build550LabelHeader()

> **build550LabelHeader**(`widthLines`, `heightDots`, `options?`): `Uint8Array`

`ESC D` Start of Label Print Data — 12-byte header followed by raster
payload. Per spec p.12:

  Byte 0     ESC (0x1b)
  Byte 1     D   (0x44)
  Byte 2     BPP (default 1)
  Byte 3     Alignment (2 = bottom)
  Bytes 4-7  Width = number of lines (label length in raster rows)
  Bytes 8-11 Height = number of dots per line (head width)
  Bytes 12+  Print data — width * roundup(height*bpp/8) bytes

Note the axis convention: spec "Width" is the feed direction
(= our `bitmap.heightPx`); spec "Height" is across the head
(= our `bitmap.widthPx`). The diagram on p.12 makes this
concrete — dot 0 is at the bottom of the head; raster rows
advance with the feed.

## Parameters

### widthLines

`number`

### heightDots

`number`

### options?

#### alignment?

`number`

#### bpp?

`number`

## Returns

`Uint8Array`
