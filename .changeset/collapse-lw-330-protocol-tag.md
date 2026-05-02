---
'@thermal-label/labelwriter-core': minor
---

Collapse the `lw-330` protocol tag into `lw-450`. The encoder produced
identical byte streams for both — the distinction was carrying
unactioned firmware-quirk documentation rather than a runtime branch.
The 7 affected devices (LW_300, LW_310, LW_330, LW_330_TURBO,
LW_EL40, LW_EL60, LW_TURBO) now declare `protocol: 'lw-450'`. If a
future code path needs to gate `ESC G` (short form feed) or
unconditional `ESC q` (select roll) on 300-series firmware, model it
as an `engine.capabilities` flag rather than a separate protocol tag.
