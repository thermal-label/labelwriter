[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / SkuInfo

# Interface: SkuInfo

Parsed `ESC U` response — the 63-byte NFC SKU dump.

Field layout matches the spec table on p.16-19. All multi-byte
integers are little-endian. Dimensions are in millimetres
(per the spec `1...2^16 = length in mm`).

## Properties

### brand

> **brand**: `"unknown"` \| `"dymo"`

Brand identifier — `'dymo'` for `0x00`, `'unknown'` otherwise.

***

### contentColor

> **contentColor**: `"black"` \| `"unknown"` \| `"red-black"`

***

### counterMargin

> **counterMargin**: `number`

***

### counterStrategy

> **counterStrategy**: `"unknown"` \| `"count-up"` \| `"count-down"`

***

### crc

> **crc**: `number`

CRC over payload (u16 LE, bytes 4-5).

***

### labelColor

> **labelColor**: `"white"` \| `"clear"` \| `"yellow"` \| `"blue"` \| `"green"` \| `"unknown"` \| `"pink"`

***

### labelLengthMm

> **labelLengthMm**: `number`

Label length in mm (u16). 0 / 0xFFFF for continuous.

***

### labelType

> **labelType**: `"continuous"` \| `"unknown"` \| `"card"` \| `"die"`

***

### labelWidthMm

> **labelWidthMm**: `number`

Label width in mm (u16).

***

### length

> **length**: `number`

Payload length byte.

***

### linerWidthMm

> **linerWidthMm**: `number`

***

### magic

> **magic**: `number`

Magic number `0xCAB6` — used to validate the response.

***

### marker1ToStartMm

> **marker1ToStartMm**: `number`

***

### marker1WidthMm

> **marker1WidthMm**: `number`

***

### marker2OffsetMm

> **marker2OffsetMm**: `number`

***

### marker2WidthMm

> **marker2WidthMm**: `number`

***

### markerPitchMm

> **markerPitchMm**: `number`

***

### markerType

> **markerType**: `number`

***

### material

> **material**: `"removable"` \| `"durable"` \| `"clear"` \| `"unknown"` \| `"card"` \| `"paper"` \| `"permanent"` \| `"plastic"` \| `"time-exp"`

***

### printableHorizontalOffsetMm

> **printableHorizontalOffsetMm**: `number`

***

### printableVerticalOffsetMm

> **printableVerticalOffsetMm**: `number`

***

### productionDate

> **productionDate**: `string`

Production date in `DDYY` format (per spec p.19).

***

### productionTime

> **productionTime**: `string`

Production time in `HHMM` format.

***

### region

> **region**: `number`

Region code (`0xFF` = global per p.17).

***

### sku

> **sku**: `string`

12-char SKU number, e.g. `'30252      '`.

***

### totalLabelCount

> **totalLabelCount**: `number`

***

### totalLengthMm

> **totalLengthMm**: `number`

***

### version

> **version**: `number`

Spec version byte (currently `'0'` per p.16).

***

### verticalOffsetMm

> **verticalOffsetMm**: `number`
