[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / EngineVersion

# Interface: EngineVersion

Parsed `ESC V` response — the 34-byte HW/FW/PID identity block.

## Properties

### fwKind

> **fwKind**: `"application"` \| `"bootloader"` \| `"unknown"`

Firmware kind: `'application'` (FWAP) or `'bootloader'` (FWBL).

***

### fwMajor

> **fwMajor**: `string`

4-char major release version.

***

### fwMinor

> **fwMinor**: `string`

4-char minor release version.

***

### fwReleaseDate

> **fwReleaseDate**: `string`

4-char release date in `MMYY` format.

***

### hwVersion

> **hwVersion**: `string`

16-char UTF-8 hardware version string (right-padded with nulls).

***

### pid

> **pid**: `number`

USB Product ID (u16, little-endian over bytes 32-33).
