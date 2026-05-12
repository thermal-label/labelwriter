[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / DeviceSupport

# ~~Interface: DeviceSupport~~

Verification state for a device.

Always present on `DeviceEntry` (defaults to `{ status: 'untested' }`)
so consumer types stay unconditional.

## Deprecated

Superseded by `DeviceVerifications` in
`./verifications.js` (per-transport `VerificationCell`s, no
`reports`/`lastVerified`/`packageVersion`/`quirks`/engine axis).
Codegen synthesises this from `verifications` and maps legacy
`status` values to the new rungs (`'broken'` → `'unsupported'`,
`'untested'` → absent). Retained during the alias transition;
removed in the cleanup PR once all drivers have migrated.

## Properties

### ~~engines?~~

> `optional` **engines?**: `Record`\<`string`, `LegacySupportStatus`\>

Per-engine status — useful for the Duo's "label works, tape
doesn't" case. Keys must match `engines[].role`.

***

### ~~lastVerified?~~

> `optional` **lastVerified?**: `string`

ISO date of the most recent accepted report.

***

### ~~packageVersion?~~

> `optional` **packageVersion?**: `string`

Driver package version the most recent reports were filed against.

***

### ~~quirks?~~

> `optional` **quirks?**: `string`

Editorial caveats. Markdown. Changes with firmware revisions.

***

### ~~reports?~~

> `optional` **reports?**: readonly `DeviceReport`[]

Accepted verification reports backing the status above.

***

### ~~status~~

> **status**: `LegacySupportStatus`

Worst-case status across declared transports and engines.

***

### ~~transports?~~

> `optional` **transports?**: `Partial`\<`Record`\<[`TransportType`](../type-aliases/TransportType.md), `LegacySupportStatus`\>\>

Per-transport status, where the data records it.
