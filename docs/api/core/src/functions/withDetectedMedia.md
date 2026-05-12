[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / withDetectedMedia

# Function: withDetectedMedia()

> **withDetectedMedia**(`status`, `sku`): [`PrinterStatus`](../interfaces/PrinterStatus.md)

Decorate a parsed status response with `detectedMedia` derived from
a freshly-fetched SKU dump. Used by the driver after `getMedia()`
returns, so subsequent `print()` / `createPreview()` calls have
something to fall back to.

## Parameters

### status

[`PrinterStatus`](../interfaces/PrinterStatus.md)

### sku

[`SkuInfo`](../interfaces/SkuInfo.md)

## Returns

[`PrinterStatus`](../interfaces/PrinterStatus.md)
