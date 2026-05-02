[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [node/src](../README.md) / LabelWriterDiscovery

# Class: LabelWriterDiscovery

`PrinterDiscovery` implementation for Dymo LabelWriter printers.

`listPrinters()` only enumerates USB — there is no mDNS / DNS-SD
implementation for the networked 550 Turbo / 5XL / Wireless. Network
printers are opened by explicit `openPrinter({ host, port })`.

## Implements

- `PrinterDiscovery`

## Constructors

### Constructor

> **new LabelWriterDiscovery**(): `LabelWriterDiscovery`

#### Returns

`LabelWriterDiscovery`

## Properties

### family

> `readonly` **family**: `"labelwriter"` = `'labelwriter'`

Driver family identifier — matches `DeviceEntry.family`.

#### Implementation of

`PrinterDiscovery.family`

## Methods

### listPrinters()

> **listPrinters**(): `Promise`\<`DiscoveredPrinter`[]\>

List connected printers on this driver's supported transports.

#### Returns

`Promise`\<`DiscoveredPrinter`[]\>

#### Implementation of

`PrinterDiscovery.listPrinters`

***

### openPrinter()

> **openPrinter**(`options?`): `Promise`\<[`LabelWriterPrinter`](LabelWriterPrinter.md)\>

Open a printer matching the given options.

If no options are provided, opens the first available printer.

#### Parameters

##### options?

`OpenOptions` = `{}`

#### Returns

`Promise`\<[`LabelWriterPrinter`](LabelWriterPrinter.md)\>

#### Implementation of

`PrinterDiscovery.openPrinter`
