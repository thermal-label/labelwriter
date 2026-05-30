[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / write550Job

# Function: write550Job()

> **write550Job**(`transport`, `job`, `options?`): `Promise`\<`void`\>

Write a composed 550 job interactively. See the `lw5-raster`
protocol doc — "Inter-label status handshake" — for the wire
contract.

Lock byte: `0` on the last label (final query + lock release), `2`
between labels (host defers the read to the next iteration).

## Parameters

### transport

[`Transport`](/contracts/api/interfaces/Transport)

### job

[`Composed550Job`](../interfaces/Composed550Job.md)

### options?

[`Write550JobOptions`](../interfaces/Write550JobOptions.md) = `{}`

## Returns

`Promise`\<`void`\>
