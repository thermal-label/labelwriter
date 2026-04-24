# Decisions — LabelWriter retrofit to contracts/transport

Follows the plan in `../driver-retrofit-amendment.md`. The shared
conventions (D1-D8 below) are identical to
`../labelmanager/DECISIONS.md` — phase B of the retrofit; same
playbook as phase A.

## D1 — contracts + transport

- `@thermal-label/contracts@^0.1.1` — interface package.
- `@thermal-label/transport@^0.1.0` — shared USB/TCP/WebUSB classes.

Consumed from npm. No workspace linking between the three driver
repos.

## D2 — One `print(RawImageData, media?, options?)`

`printText`, `printImage`, `printImageURL` are deleted. Callers pass
full RGBA; the driver thresholds/dithers via `@mbtech-nl/bitmap`
internally.

## D3 — Local type renames

- `DeviceDescriptor` (local) → `LabelWriterDevice extends DeviceDescriptor`.
- `LabelWriterMedia extends MediaDescriptor` for label dimensions.
- `PrintOptions` (local) → `LabelWriterPrintOptions extends PrintOptions`.
- `PrinterStatus` (local) stays as a type alias of the contracts
  `PrinterStatus`; no driver-specific extensions needed for LabelWriter.

Contracts base types are re-exported from `*-core` for consumer
convenience.

## D4 — `PrinterStatus` shape

LabelWriter 450 returns a single status byte — mapping to
`ready/mediaLoaded/errors` only; `detectedMedia: undefined`.

LabelWriter 550 returns a 32-byte response. The width/height bytes are
resolved against the media registry to populate `detectedMedia`. When
the loaded roll is unknown, `detectedMedia: undefined`.

Error codes:
- `not_ready` — printer busy
- `no_media` — no labels loaded / paper out
- `label_too_long` — label exceeded max length
- `paper_jam` — jam detected
- `cover_open` — cover is open (550)

## D5 — `DEFAULT_MEDIA`

89×28 mm address (`ADDRESS_STANDARD`) — the most common LabelWriter
consumable. Used when `createPreview()` runs without media and without
a detected roll on the 550.

## D6 — `discovery` named export

The node package exports a singleton `discovery: PrinterDiscovery` so
the unified `thermal-label-cli` can load it by convention. TCP
discovery returns `[]` from `listPrinters()` (there is no mDNS
implementation here yet); network printers are opened by explicit
`openPrinter({ host, port })`.

Web packages do not implement `PrinterDiscovery` — browser discovery
is `navigator.usb.requestDevice()` via `WebUsbTransport.request()`.

## D7 — Transport byte-interface

All transports use `Uint8Array` and `async close()`, per the contracts
`Transport` interface. The local USB + TCP + WebUSB implementations
are replaced with `UsbTransport` / `TcpTransport` from
`@thermal-label/transport/node` and `WebUsbTransport` from
`@thermal-label/transport/web`.

## D8 — CLI removal + version bump

- `packages/cli/` removed; superseded by the unified `thermal-label-cli`.
- Maintainer unpublishes `@thermal-label/labelwriter-cli` separately.
- core/node/web bump 0.0.1 → 0.2.0.
