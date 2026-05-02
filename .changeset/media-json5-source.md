---
'@thermal-label/labelwriter-core': patch
---

Move the LabelWriter media registry to a `data/media.json5` source file
compiled into `data/media.json` + `src/_generated/media.ts` by
`scripts/compile-data.mjs`. Mirrors the device-registry pattern in
this package and brother-ql's media setup, and lets external doc
generators read the json5 source directly. Public API is unchanged
(`MEDIA.ADDRESS_STANDARD` still resolves to the same descriptor),
plus a new exported `MediaKey` literal-union type.
