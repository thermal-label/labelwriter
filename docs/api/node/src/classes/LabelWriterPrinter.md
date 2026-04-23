[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [node/src](../README.md) / LabelWriterPrinter

# Class: LabelWriterPrinter

Defined in: node/src/printer.ts:57

## Constructors

### Constructor

> **new LabelWriterPrinter**(`device`, `xport`, `transport`): `LabelWriterPrinter`

Defined in: node/src/printer.ts:62

#### Parameters

##### device

[`DeviceDescriptor`](../interfaces/DeviceDescriptor.md)

##### xport

[`Transport`](../interfaces/Transport.md)

##### transport

`"usb"` \| `"tcp"`

#### Returns

`LabelWriterPrinter`

## Properties

### device

> `readonly` **device**: [`DeviceDescriptor`](../interfaces/DeviceDescriptor.md)

Defined in: node/src/printer.ts:58

***

### transport

> `readonly` **transport**: `"usb"` \| `"tcp"`

Defined in: node/src/printer.ts:59

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: node/src/printer.ts:109

#### Returns

`Promise`\<`void`\>

***

### getStatus()

> **getStatus**(): `Promise`\<[`PrinterStatus`](../interfaces/PrinterStatus.md)\>

Defined in: node/src/printer.ts:68

#### Returns

`Promise`\<[`PrinterStatus`](../interfaces/PrinterStatus.md)\>

***

### print()

> **print**(`bitmap`, `options?`): `Promise`\<`void`\>

Defined in: node/src/printer.ts:75

#### Parameters

##### bitmap

`LabelBitmap`

##### options?

[`PrintOptions`](../interfaces/PrintOptions.md)

#### Returns

`Promise`\<`void`\>

***

### printImage()

> **printImage**(`image`, `options?`): `Promise`\<`void`\>

Defined in: node/src/printer.ts:90

#### Parameters

##### image

`string` \| `Buffer`

##### options?

[`ImagePrintOptions`](../interfaces/ImagePrintOptions.md)

#### Returns

`Promise`\<`void`\>

***

### printText()

> **printText**(`text`, `options?`): `Promise`\<`void`\>

Defined in: node/src/printer.ts:80

#### Parameters

##### text

`string`

##### options?

[`TextPrintOptions`](../interfaces/TextPrintOptions.md)

#### Returns

`Promise`\<`void`\>

***

### recover()

> **recover**(): `Promise`\<`void`\>

Defined in: node/src/printer.ts:103

#### Returns

`Promise`\<`void`\>
