# Web (browser)

`@thermal-label/labelwriter-web` is a browser-only package that uses the [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB) to communicate with Dymo LabelWriter printers directly from the browser — no backend, no drivers.

## Browser support

| Browser | Support |
|---------|---------|
| Chrome 61+ | ✅ |
| Edge 79+ | ✅ |
| Firefox | ❌ |
| Safari | ❌ |
| Samsung Internet | ❌ |

WebUSB requires a **secure context** — the page must be served over HTTPS or from `localhost`.

## Install

```bash
npm install @thermal-label/labelwriter-web
```

## Quick start

```ts
import { requestPrinter } from '@thermal-label/labelwriter-web';

// Opens the browser's USB device picker, filtered to known LabelWriter PIDs.
// Must be called in response to a user gesture (click, keypress, etc.)
const printer = await requestPrinter();

await printer.printText('Hello from the browser!', { density: 'high' });
await printer.disconnect();
```

## Connect to a known device

If you already have a `USBDevice` from `navigator.usb.getDevices()`:

```ts
import { fromUSBDevice } from '@thermal-label/labelwriter-web';

const [usbDevice] = await navigator.usb.getDevices();
const printer = fromUSBDevice(usbDevice);
await printer.printText('Reconnected!');
```

## Printing images

```ts
// From ImageData (e.g. from a <canvas>)
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
await printer.printImage(imageData, { threshold: 128 });

// From a URL
await printer.printImageURL('/logo.png', { rotate: 90 });
```

## Live demo

Try it in your browser: [Demo](/demo)

## NFC label lock

::: warning 550 series
The LabelWriter 550 series enforces NFC chip validation on label rolls at the hardware level. Non-certified labels will be rejected. See [Getting started — NFC label lock](/getting-started#nfc-label-lock).
:::

## API

### `requestPrinter()`

Calls `navigator.usb.requestDevice()` filtered to all known LabelWriter PIDs and wraps the selected device in a `WebLabelWriterPrinter`. Must be called inside a user gesture handler.

### `fromUSBDevice(device)`

Wraps an existing `USBDevice` in a `WebLabelWriterPrinter`. Throws if the device is not a recognised LabelWriter model.

### `WebLabelWriterPrinter`

| Member | Type | Description |
|--------|------|-------------|
| `device` | `USBDevice` | Underlying USB device |
| `descriptor` | `DeviceDescriptor` | Device metadata (name, protocol, etc.) |
| `getStatus()` | `Promise<PrinterStatus>` | Read printer status |
| `print(bitmap, options?)` | `Promise<void>` | Print a `LabelBitmap` |
| `printText(text, options?)` | `Promise<void>` | Render text and print |
| `printImage(imageData, options?)` | `Promise<void>` | Print from `ImageData` |
| `printImageURL(url, options?)` | `Promise<void>` | Load URL and print |
| `recover()` | `Promise<void>` | Send error recovery |
| `isConnected()` | `boolean` | Whether the device is open |
| `disconnect()` | `Promise<void>` | Close USB connection |
