# Hardware

The supported-devices table, per-device verification status, and protocol
notes live on the docs site:
<https://thermal-label.github.io/labelwriter/hardware/>.

The site is generated from each driver's authored device data — for this
package, `packages/core/data/devices/<KEY>.json5`. To update a device's
verification status, edit the matching JSON5 file's `support` block.

<!--@include: ./_status-fragment.md-->
