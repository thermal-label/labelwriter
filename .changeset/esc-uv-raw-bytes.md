---
'@thermal-label/labelwriter-core': patch
---

Expose the raw `ESC U` / `ESC V` response bytes on `SkuInfo` and `EngineVersion`.

`parseSkuInfo` and `parseEngineVersion` now retain the verbatim response in a
`rawBytes: Uint8Array` field, mirroring `PrinterStatus.rawBytes`. This lets a
downstream report carry the undecoded frame — invaluable when the parse is
wrong, or a firmware revision adds fields, and there is no LW 5xx unit on hand
to re-probe.
