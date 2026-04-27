# Web (browser)

`@thermal-label/labelwriter-web` talks to Dymo LabelWriter printers
directly from Chrome or Edge via the
[WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB) —
no backend, no native drivers. It implements the same `PrinterAdapter`
the Node.js driver does, backed by `WebUsbTransport` from
`@thermal-label/transport/web`.

## Browser support

| Browser    | Support |
| ---------- | ------- |
| Chrome 61+ | ✅      |
| Edge 79+   | ✅      |
| Firefox    | ❌      |
| Safari     | ❌      |

WebUSB requires a **secure context** (HTTPS or `localhost`) and a
**user gesture** (click / keypress) for the initial pairing prompt.

## Install

```bash
pnpm add @thermal-label/labelwriter-web
```

## Quick start

```ts
import { requestPrinter } from '@thermal-label/labelwriter-web';
import { MEDIA } from '@thermal-label/labelwriter-core';

// Must run from a user gesture.
const printer = await requestPrinter();
try {
  await printer.print(image, MEDIA.ADDRESS_STANDARD);
} finally {
  await printer.close();
}
```

`image` is `RawImageData` — build one from `ImageData` returned by a
canvas `getImageData()` call, or from an `<img>` drawn to an
`OffscreenCanvas`:

```ts
const bmp = await createImageBitmap(file);
const canvas = new OffscreenCanvas(bmp.width, bmp.height);
const ctx = canvas.getContext('2d')!;
ctx.drawImage(bmp, 0, 0);
const id = ctx.getImageData(0, 0, bmp.width, bmp.height);
const image = { width: id.width, height: id.height, data: new Uint8Array(id.data.buffer) };
```

## Connect to a previously paired device

```ts
import { fromUSBDevice } from '@thermal-label/labelwriter-web';

const [usbDevice] = await navigator.usb.getDevices();
const printer = await fromUSBDevice(usbDevice);
```

`fromUSBDevice()` is async — it hands the device to
`WebUsbTransport.fromDevice()` which opens it and claims interface 0.

## Status

```ts
const status = await printer.getStatus();

status.ready; // printer idle and error-free
status.mediaLoaded; // label roll present
status.detectedMedia; // LabelWriterMedia | undefined (550 only)
status.errors; // PrinterError[] — same shape as the node driver
```

On the 550 series, `detectedMedia` is populated automatically from
the 32-byte status response. Subsequent `print()` calls can omit
`media` and the adapter will reuse the detection.

## Preview

```ts
const preview = await printer.createPreview(image, {
  media: MEDIA.SHIPPING_STANDARD,
});
preview.planes[0].bitmap; // 1bpp LabelBitmap
preview.planes[0].displayColor; // '#000000' — single-colour driver
```

For offline previews, import `createPreviewOffline` from
`@thermal-label/labelwriter-core`.

## Live demo

Try it in your browser: [Demo](/demo/labelwriter)

## NFC label lock

::: warning 550 series
The LabelWriter 550 series enforces NFC chip validation on label
rolls at the hardware level. Non-certified labels will be rejected.
See [Getting started — NFC label lock](./getting-started#nfc-label-lock).
:::

## API summary

| Export                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `requestPrinter(opts?)` | Show the USB picker and wrap the selected device |
| `fromUSBDevice(device)` | Wrap a pre-paired `USBDevice` (async)            |
| `WebLabelWriterPrinter` | Adapter class                                    |
| `DEFAULT_FILTERS`       | LabelWriter VID/PID filter set                   |

`WebLabelWriterPrinter` implements `PrinterAdapter` from
`@thermal-label/contracts` — `print`, `createPreview`, `getStatus`,
`close`, plus the `family`, `model`, `device`, `connected` getters
and the driver-specific `recover()` helper.
