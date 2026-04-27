[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterDevice

# Interface: LabelWriterDevice

Dymo LabelWriter device descriptor.

Extends the contracts base with LabelWriter-specific fields: head
geometry, protocol generation (`'450'` legacy ESC raster, `'550'`
job-header raster), network capability, and NFC roll authentication.

## Extends

- `DeviceDescriptor`

## Properties

### bytesPerRow

> **bytesPerRow**: `number`

***

### family

> **family**: `"labelwriter"`

Driver family this device belongs to, e.g. `'brother-ql'`.

#### Overrides

`DeviceDescriptor.family`

***

### headDots

> **headDots**: `number`

***

### network

> **network**: [`NetworkSupport`](../type-aliases/NetworkSupport.md)

***

### nfcLock

> **nfcLock**: `boolean`

***

### pid

> **pid**: `number`

USB Product ID. Required when `transports` includes `'usb'` or `'webusb'`.
Undefined for network-only printers.

#### Overrides

`DeviceDescriptor.pid`

***

### protocol

> **protocol**: `"450"` \| `"550"`

***

### vid

> **vid**: `number`

USB Vendor ID. Required when `transports` includes `'usb'` or `'webusb'`.
Undefined for network-only printers (e.g. a LabelWriter 550 Turbo
accessed purely over Ethernet).

#### Overrides

`DeviceDescriptor.vid`
