---
'@thermal-label/labelwriter-core': patch
---

Fix `ESC U` SKU geometry: the NFC tag reports deci-millimetres, not mm.

`parseSkuInfo` read the label / marker / offset / liner geometry fields as
whole millimetres, per the 550 reference table (`1...2^16 = length in mm`). An
on-the-wire capture of an S0722540 (57×32 mm) roll disproves that — it reports
571 / 317. All `*Mm` geometry fields are now converted from deci-mm, so
`detectedMedia` reports 57.1 × 31.7 mm instead of 571 × 317. Counts
(`totalLabelCount`, `counterMargin`) are left unscaled.

The `MULTI_PURPOSE_MEDIUM` catalogue entry was stored transposed (32×57); it
is corrected to 57×32 — `widthMm` is the across-head dimension and `heightMm`
the feed length, matching the ESC U tag.

`findMediaByDimensions` is now `@deprecated` — nothing maps `detectedMedia`
onto a catalogue entry, and its exact dimension equality cannot match the
deci-mm values `parseSkuInfo` now produces. Behaviour is unchanged; it is
scheduled for removal in 0.7.0.
