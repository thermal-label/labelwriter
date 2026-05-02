[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / skuInfoToMedia

# Function: skuInfoToMedia()

> **skuInfoToMedia**(`sku`): `object`

Map a `SkuInfo` payload to a `PrinterStatus`-compatible
`detectedMedia` descriptor for round-tripping into the registry.

The SKU number and dimensions are sufficient to identify the roll
for downstream UI ("you have X loaded"). We deliberately don't
extend the `MediaDescriptor` shape here; consumers that need
material / counter / NFC fields can read the full `SkuInfo`.

## Parameters

### sku

[`SkuInfo`](../interfaces/SkuInfo.md)

## Returns

`object`

### heightMm?

> `optional` **heightMm?**: `number`

### id

> **id**: `string`

### name

> **name**: `string`

### type

> **type**: `"die-cut"` \| `"continuous"`

### widthMm

> **widthMm**: `number`
