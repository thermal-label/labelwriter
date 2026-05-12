[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / requestPrinters

# Function: requestPrinters()

> **requestPrinters**(`options?`): `Promise`\<`Record`\<`string`, [`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>\>

Show the browser's USB picker and return one `PrinterAdapter` per
drivable engine on the selected device, keyed by engine role.

- Single-engine devices (3xx/4xx/5xx, Twin Turbo) → 1-key record.
- Multi-interface composites (Duo family — `label` on IF 0, `tape`
  on IF 1) → N-key record, one transport per engine, one adapter
  per transport.

Each adapter is fully scoped to its engine: `print()` defaults
`options.engine` to that role; `getStatus()` uses that engine's
protocol; `close()` closes that engine's transport. The harness shell
stores the whole record and rebinds the active adapter when the
operator flips engine tabs.

Engines that fail to claim (browser refused the interface, IF
already held by another driver) are omitted from the returned
record. Callers should check `Object.keys(printers)` against the
device's engine list to surface partial-claim warnings —
"rails not walls": the operator can still drive whichever engines
did open.

## Parameters

### options?

[`RequestOptions`](../interfaces/RequestOptions.md) = `{}`

## Returns

`Promise`\<`Record`\<`string`, [`WebLabelWriterPrinter`](../classes/WebLabelWriterPrinter.md)\>\>
