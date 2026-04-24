# Core protocol reference

`@thermal-label/labelwriter-core` is the shared protocol layer used by
both the Node.js and Web packages. It contains the ESC/raster
encoder, the 450/550 status parsers, the device and media
registries, and the offline preview helper. It also re-exports the
`@thermal-label/contracts` base types.

Consume `*-core` directly when you need the protocol encoder or
offline preview without a live printer.

## Install

```bash
pnpm add @thermal-label/labelwriter-core
```

## Core exports

| Export                                                               | Description                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `DEVICES` / `findDevice`                                             | Device registry (family, transports, protocol `'450' \| '550'`)             |
| `MEDIA` / `DEFAULT_MEDIA`                                            | Media registry and the 89×28 mm fallback for assumed previews               |
| `findMediaByDimensions(w, h)`                                        | Match a 550-status response to a registry entry                             |
| `STATUS_REQUEST`                                                     | `ESC A` byte sequence                                                       |
| `parseStatus(device, bytes)`                                         | Parse the status response into `PrinterStatus`                              |
| `statusByteCount(device)`                                            | 1 for 450-series, 32 for 550-series                                         |
| `createPreviewOffline(image, media)`                                 | Render `PreviewResult` without a live printer connection                    |
| `encodeLabel(device, bitmap, opts)`                                  | Full job byte stream — job header (550) + raster + form feed                |
| `buildReset`, `buildDensity`, `buildRasterRow`, …                    | Per-command byte builders                                                   |
| `LabelWriterDevice`                                                  | Device descriptor type (extends contracts `DeviceDescriptor`)               |
| `LabelWriterMedia`                                                   | Media descriptor type (extends contracts `MediaDescriptor`)                 |
| `LabelWriterPrintOptions`                                            | Protocol options (`density`, `mode`, `compress`, `copies`, `roll`, `jobId`) |
| `Density`                                                            | `'light' \| 'medium' \| 'normal' \| 'high'`                                 |
| `PrinterAdapter`, `MediaDescriptor`, `PrinterStatus`, `Transport`, … | Re-exported from `@thermal-label/contracts`                                 |

## Encoding a label

```ts
import { encodeLabel, DEVICES, type LabelBitmap } from '@thermal-label/labelwriter-core';

const bitmap: LabelBitmap = { widthPx: 672, heightPx: 200, data: new Uint8Array((672 / 8) * 200) };
const bytes = encodeLabel(DEVICES.LW_450, bitmap);
// bytes is a Uint8Array ready to send to the printer transport
```

## Protocol command reference

### Reset — `ESC @`

```
0x1B 0x40
```

Resets the printer to its default state. Always the first command in a 450-series job. In 550-series jobs, the job header comes first.

### Set bytes per line — `ESC D <n>`

```
0x1B 0x44 <bytesPerRow>
```

Sets the number of bytes per raster row. For most models this is `84` (672 dots); for the 5XL it is `156`.

### Set label length — `ESC L <lo> <hi>`

```
0x1B 0x4C <len_lo> <len_hi>
```

Specifies the label length in dots as a 16-bit little-endian value.
Example: 200 dots → `0x1B 0x4C 0xC8 0x00`.

### Print density — `ESC e <n>`

```
0x1B 0x65 <density>
```

| Value | Density |
| ----- | ------- |
| 0     | Light   |
| 1     | Medium  |
| 2     | Normal  |
| 4     | High    |

### Print mode — `ESC i <n>`

```
0x1B 0x69 <mode>
```

| Value | Mode     |
| ----- | -------- |
| 0     | Text     |
| 1     | Graphics |

### Form feed — `ESC E`

```
0x1B 0x45
```

Advances the label to the tear-off position.

### Short form feed — `ESC m`

```
0x1B 0x6D
```

Advances by a small fixed amount.

### Select roll — `ESC C <n>`

```
0x1B 0x43 <roll>
```

Selects roll 0 or 1 on Twin Turbo models.

### Uncompressed raster row — `0x16`

```
0x16 <len> <data[bytesPerRow]>
```

Sends one row of raster data. `<len>` is `bytesPerRow + 1`. Each bit is one dot; bit 7 of byte 0 is the leftmost dot.

### RLE-compressed raster row — `0x17`

```
0x17 <len> <pairs…>
```

Run-length encoded variant. Each pair is `<count> <value>` where `<count>` is the number of times `<value>` repeats. `<len>` is the total length of the pairs.

Example: 84 bytes of `0x00` encodes as `0x17 0x02 0x53 0x00` (1 pair: 83 × 0x00).

### Status request — `ESC A`

```
0x1B 0x41
```

Requests printer status. The printer responds with 1 byte (450-series) or 32 bytes (550-series).

### Error recovery — 85 × `ESC` + `ESC A`

```
0x1B 0x1B … (85 times) … 0x1B 0x1B 0x41
```

Sends 85 `ESC` bytes followed by `ESC A`. Clears the printer's command buffer and requests fresh status.

## 550-series job header — `ESC s <jobId[4]>`

```
0x1B 0x73 <id0> <id1> <id2> <id3>
```

Required before every reset on 550-series devices. `jobId` is a 4-byte identifier (any value); auto-generated from `Date.now() & 0xFFFFFFFF` if not provided.

::: info Job header does not disable NFC checking
Sending a valid job header does not disable the NFC label validation. The NFC check is performed by the printer hardware independently of the protocol commands. Use genuine Dymo-certified label rolls with 550-series devices.
:::

## 450-series full job stream

```
ESC @               ; reset
ESC D <84>          ; set bytes per line
ESC e <density>     ; density
ESC i <mode>        ; mode
ESC L <lo> <hi>     ; label length
<raster rows>       ; one 0x16 or 0x17 command per row
ESC E               ; form feed
```

## 550-series full job stream

```
ESC s <id[4]>       ; job header (REQUIRED first)
ESC @               ; reset
ESC D <84>          ; set bytes per line
ESC e <density>     ; density
ESC i <mode>        ; mode
ESC L <lo> <hi>     ; label length
<raster rows>       ; one 0x16 or 0x17 command per row
ESC E               ; form feed
```
