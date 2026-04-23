# @thermal-label/labelwriter-web

WebUSB browser driver for Dymo LabelWriter printers.

## Browser support

| Browser | Support |
|---------|---------|
| Chrome / Edge | ✅ |
| Firefox | ❌ (WebUSB not supported) |
| Safari | ❌ (WebUSB not supported) |

Requires a secure context (HTTPS or localhost).

## Install

```bash
npm install @thermal-label/labelwriter-web
```

## Quick start

```ts
import { requestPrinter } from '@thermal-label/labelwriter-web';

const printer = await requestPrinter();
await printer.printText('Hello, world!');
await printer.disconnect();
```

## NFC label lock (550 series)

The LabelWriter 550 series enforces NFC chip validation on Dymo-branded labels at the hardware level. This cannot be bypassed in software. Use compatible labels to avoid paper-out errors.

## API

### `requestPrinter()`

Opens a browser USB device picker filtered to known LabelWriter PIDs, then returns a `WebLabelWriterPrinter`.

### `fromUSBDevice(device)`

Wraps an already-obtained `USBDevice` in a `WebLabelWriterPrinter`.

### `WebLabelWriterPrinter`

| Method | Description |
|--------|-------------|
| `getStatus()` | Read printer status (1 byte for 450, 32 for 550) |
| `print(bitmap, options?)` | Print a raw bitmap |
| `printText(text, options?)` | Render text and print |
| `printImage(imageData, options?)` | Print from `ImageData` |
| `printImageURL(url, options?)` | Load image URL and print |
| `recover()` | Send error recovery sequence |
| `isConnected()` | Check USB connection state |
| `disconnect()` | Close USB connection |

## License

MIT © Mannes Brak
