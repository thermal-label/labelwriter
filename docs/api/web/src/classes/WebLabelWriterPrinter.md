[**labelwriter**](../../../README.md)

---

[labelwriter](../../../README.md) / [web/src](../README.md) / WebLabelWriterPrinter

# Class: WebLabelWriterPrinter

Defined in: web/src/printer.ts:23

## Constructors

### Constructor

> **new WebLabelWriterPrinter**(`device`, `descriptor`): `WebLabelWriterPrinter`

Defined in: web/src/printer.ts:28

#### Parameters

##### device

`USBDevice`

##### descriptor

[`DeviceDescriptor`](../../../node/src/interfaces/DeviceDescriptor.md)

#### Returns

`WebLabelWriterPrinter`

## Properties

### descriptor

> `readonly` **descriptor**: [`DeviceDescriptor`](../../../node/src/interfaces/DeviceDescriptor.md)

Defined in: web/src/printer.ts:25

---

### device

> `readonly` **device**: `USBDevice`

Defined in: web/src/printer.ts:24

## Methods

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: web/src/printer.ts:95

#### Returns

`Promise`\<`void`\>

---

### getStatus()

> **getStatus**(): `Promise`\<[`PrinterStatus`](../interfaces/PrinterStatus.md)\>

Defined in: web/src/printer.ts:34

#### Returns

`Promise`\<[`PrinterStatus`](../interfaces/PrinterStatus.md)\>

---

### isConnected()

> **isConnected**(): `boolean`

Defined in: web/src/printer.ts:91

#### Returns

`boolean`

---

### print()

> **print**(`bitmap`, `options?`): `Promise`\<`void`\>

Defined in: web/src/printer.ts:41

#### Parameters

##### bitmap

`LabelBitmap`

##### options?

[`PrintOptions`](../../../node/src/interfaces/PrintOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

---

### printImage()

> **printImage**(`imageData`, `options?`): `Promise`\<`void`\>

Defined in: web/src/printer.ts:56

#### Parameters

##### imageData

`ImageData`

##### options?

[`ImagePrintOptions`](../interfaces/ImagePrintOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

---

### printImageURL()

> **printImageURL**(`url`, `options?`): `Promise`\<`void`\>

Defined in: web/src/printer.ts:73

#### Parameters

##### url

`string`

##### options?

[`ImagePrintOptions`](../interfaces/ImagePrintOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

---

### printText()

> **printText**(`text`, `options?`): `Promise`\<`void`\>

Defined in: web/src/printer.ts:46

#### Parameters

##### text

`string`

##### options?

[`TextPrintOptions`](../interfaces/TextPrintOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

---

### recover()

> **recover**(): `Promise`\<`void`\>

Defined in: web/src/printer.ts:85

#### Returns

`Promise`\<`void`\>
