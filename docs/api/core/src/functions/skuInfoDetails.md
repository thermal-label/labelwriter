[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / skuInfoDetails

# Function: skuInfoDetails()

> **skuInfoDetails**(`sku`): [`StatusDetail`](../interfaces/StatusDetail.md)[]

Build driver-formatted `details[]` rows describing the *specific
loaded roll instance* from an `ESC U` SKU dump.

These are roll-instance forensics — SKU code, material, total label
count, production date, counter strategy — beyond what
`detectedMedia` carries (which stays the catalogue-ish dimensions +
SKU id). The driver attaches them to the cached status so subsequent
`getStatus()` polls replay them in the harness diagnostics panel.

## Parameters

### sku

[`SkuInfo`](../interfaces/SkuInfo.md)

## Returns

[`StatusDetail`](../interfaces/StatusDetail.md)[]
