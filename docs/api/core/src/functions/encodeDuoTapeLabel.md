[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / encodeDuoTapeLabel

# Function: encodeDuoTapeLabel()

> **encodeDuoTapeLabel**(`device`, `bitmap`, `options?`): `Uint8Array`

Encode a complete tape print job.

Output is raw USB Printer-class bytes for the tape interface
(no HID framing). Caller is responsible for opening the right
`bInterfaceNumber` — see `engine.bind.usb.bInterfaceNumber` and
`@thermal-label/transport`'s `UsbTransport.open(vid, pid, opts)`.

Wire layout per copy:
  ESC @            (reset)
  ESC C n          (tape type)
  ESC D bytesPerLine
  <SYN> row …      (one per raster line, padded/cropped to head width)
  ESC E            (cut)

The bitmap must already be in head-aligned orientation (caller's
responsibility — typically via `pickRotation` + `renderImage`).
Width is fitted to `engine.headDots` by right-padding or cropping;
height is preserved.

## Parameters

### device

`DeviceEntry`

### bitmap

`LabelBitmap`

### options?

[`DuoTapePrintOptions`](../interfaces/DuoTapePrintOptions.md) = `{}`

## Returns

`Uint8Array`
