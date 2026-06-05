# Hardware

The supported-devices table, per-device verification status, and protocol
notes live on the docs site:
<https://thermal-label.github.io/labelwriter/hardware/>.

The site is generated from each driver's authored device data — for this
package, `packages/core/data/devices/<KEY>.json5`. To update a device's
verification status, edit the matching JSON5 file's `support` block.

## Supported devices

<!-- HARDWARE_TABLE:START -->
**22 devices** — 2 verified · 0 partial · 12 expected · 0 unsupported · 8 unverified

| Model | Key | USB PID | Transports | Status |
| --- | --- | --- | --- | --- |
| [LabelWriter 4XL](https://thermal-label.github.io/hardware/labelwriter/lw-4xl) | `LW_4XL` | 0x001f | USB | 🔄 expected |
| [LabelWriter 5XL](https://thermal-label.github.io/hardware/labelwriter/lw-5xl) | `LW_5XL` | 0x002a | USB, TCP | 🔄 expected |
| [LabelWriter 300](https://thermal-label.github.io/hardware/labelwriter/lw-300) | `LW_300` | 0x0009 | USB, Serial | 🔄 expected |
| [LabelWriter 310](https://thermal-label.github.io/hardware/labelwriter/lw-310) | `LW_310` | 0x0009 | USB, Serial | 🔄 expected |
| [LabelWriter 330](https://thermal-label.github.io/hardware/labelwriter/lw-330) | `LW_330` | 0x0007 | USB, Serial | 🔄 expected |
| [LabelWriter 330 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-330-turbo) | `LW_330_TURBO` | 0x0008 | USB, Serial | ✅ verified |
| [LabelWriter 400](https://thermal-label.github.io/hardware/labelwriter/lw-400) | `LW_400` | 0x0019 | USB | 🔄 expected |
| [LabelWriter 400 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-400-turbo) | `LW_400_TURBO` | 0x001a | USB | 🔄 expected |
| [LabelWriter 450](https://thermal-label.github.io/hardware/labelwriter/lw-450) | `LW_450` | 0x0020 | USB | 🔄 expected |
| [LabelWriter 450 Duo](https://thermal-label.github.io/hardware/labelwriter/lw-450-duo) | `LW_450_DUO` | 0x0023 | USB | ⏳ unverified |
| [LabelWriter 450 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-450-turbo) | `LW_450_TURBO` | 0x0021 | USB | 🔄 expected |
| [LabelWriter 450 Twin Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-450-twin-turbo) | `LW_450_TWIN_TURBO` | 0x0022 | USB | ⏳ unverified |
| [LabelWriter 550](https://thermal-label.github.io/hardware/labelwriter/lw-550) | `LW_550` | 0x0028 | USB | ✅ verified |
| [LabelWriter 550 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-550-turbo) | `LW_550_TURBO` | 0x0029 | USB, TCP | 🔄 expected |
| [LabelWriter Duo - 96](https://thermal-label.github.io/hardware/labelwriter/lw-duo-96) | `LW_DUO_96` | 0x0017 | USB | ⏳ unverified |
| [LabelWriter Duo - 128](https://thermal-label.github.io/hardware/labelwriter/lw-duo-128) | `LW_DUO_128` | 0x001d | USB | ⏳ unverified |
| [LabelWriter EL40](https://thermal-label.github.io/hardware/labelwriter/lw-el40) | `LW_EL40` | — | Serial | ⏳ unverified |
| [LabelWriter EL60](https://thermal-label.github.io/hardware/labelwriter/lw-el60) | `LW_EL60` | — | Serial | ⏳ unverified |
| [LabelWriter SE450](https://thermal-label.github.io/hardware/labelwriter/lw-se450) | `LW_SE450` | 0x0400 | USB, Serial | 🔄 expected |
| [LabelWriter Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-turbo) | `LW_TURBO` | — | Serial | ⏳ unverified |
| [LabelWriter Twin Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-twin-turbo) | `LW_TWIN_TURBO` | 0x0018 | USB | ⏳ unverified |
| [LabelWriter Wireless](https://thermal-label.github.io/hardware/labelwriter/lw-wireless) | `LW_WIRELESS` | 0x0031 | USB, TCP | 🔄 expected |

Click any model to open its detail page on the docs site, where engines, supported media, and verification reports live. The same data backs the [interactive cross-driver table](https://thermal-label.github.io/hardware/).
<!-- HARDWARE_TABLE:END -->
