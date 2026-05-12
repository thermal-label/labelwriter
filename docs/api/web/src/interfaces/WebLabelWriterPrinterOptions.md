[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / WebLabelWriterPrinterOptions

# Interface: WebLabelWriterPrinterOptions

## Properties

### engine?

> `optional` **engine?**: [`PrintEngine`](../../../core/src/interfaces/PrintEngine.md)

The engine this instance is scoped to. Defaults to `device.engines[0]`
— back-compat for single-engine LWs (3xx/4xx/5xx) and the Twin Turbo
(single shared transport, in-band ESC q routing on the primary).

For multi-interface composite devices (Duo family — `label` on IF 0,
`tape` on IF 1) callers must construct ONE instance per engine,
each with its own `Transport` claimed against the engine's
`bind.usb.bInterfaceNumber`. The encoder dispatches by
`engine.protocol`, so per-engine `print()` writes the correct
protocol bytes (lw-raster vs d1-tape) to the correct endpoint.
