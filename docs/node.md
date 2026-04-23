# Node.js package

`@thermal-label/labelwriter-node` provides USB and TCP transport implementations and a high-level `LabelWriterPrinter` class for use in Node.js.

## Install

```bash
npm install @thermal-label/labelwriter-node
```

## USB

The USB transport wraps the `usb` npm package (libusb). It claims interface 0 and uses bulk endpoints for data transfer.

```ts
import { openPrinter } from '@thermal-label/labelwriter-node';

const printer = await openPrinter();
// or target a specific device by serial number:
const printer2 = await openPrinter({ serialNumber: 'AB1234' });
```

### Linux udev

See [Getting started — Linux udev rule](/getting-started#linux-udev-rule) for the required udev configuration.

## TCP

Wireless LabelWriter models expose port 9100 over the network.

```ts
import { openPrinterTcp } from '@thermal-label/labelwriter-node';

const printer = await openPrinterTcp('192.168.1.100');
// custom port:
const printer2 = await openPrinterTcp('192.168.1.100', 9200);
```

## Listing printers

```ts
import { listPrinters } from '@thermal-label/labelwriter-node';

const printers = listPrinters();
for (const p of printers) {
  console.log(p.device.name, p.path, p.serialNumber);
}
```

## Printing text

```ts
await printer.printText('Hello, world!', {
  density: 'high',
  copies: 2,
  invert: false,
  scaleX: 1.5,
});
```

## Printing images

Requires the optional dependency `@napi-rs/canvas`:

```bash
npm install @napi-rs/canvas
```

```ts
await printer.printImage('./label.png', {
  threshold: 128,
  dither: false,
  rotate: 90,
  density: 'normal',
});
```

## Checking status

```ts
const status = await printer.getStatus();
console.log(status.ready);    // true if printer is ready to print
console.log(status.paperOut); // true if paper out
console.log(status.errors);   // string[] of active errors
```

## Error recovery

If the printer is stuck after an error, send the recovery sequence:

```ts
await printer.recover();
const status = await printer.getStatus();
```

## API

### `listPrinters()`

Returns `PrinterInfo[]` for all connected Dymo LabelWriter USB printers.

### `openPrinter(options?)`

Opens the first matching USB printer. Options:

| Option | Type | Description |
|--------|------|-------------|
| `vid` | `number` | Filter by USB vendor ID |
| `pid` | `number` | Filter by USB product ID |
| `serialNumber` | `string` | Filter by serial number |

### `openPrinterTcp(host, port?)`

Connects to a printer over TCP. Default port is `9100`.

### `LabelWriterPrinter`

| Method | Returns | Description |
|--------|---------|-------------|
| `getStatus()` | `Promise<PrinterStatus>` | Read printer status |
| `print(bitmap, options?)` | `Promise<void>` | Send pre-encoded bitmap |
| `printText(text, options?)` | `Promise<void>` | Render and print text |
| `printImage(path, options?)` | `Promise<void>` | Load and print image file |
| `recover()` | `Promise<void>` | Send error recovery sequence |
| `close()` | `Promise<void>` | Close transport connection |
