[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / D1\_TAPE\_COLOR\_HEX

# Variable: D1\_TAPE\_COLOR\_HEX

> `const` **D1\_TAPE\_COLOR\_HEX**: `Record`\<[`D1TapeColor`](../type-aliases/D1TapeColor.md), `string` \| `null`\>

Canonical Dymo-brand hex values for `D1TapeColor`. UI consumers
map symbolic colours through this table to render preview swatches;
`clear` is `null` (render as a checkerboard or surface colour).

Approximated from the swatches in `dymo-labels-lm.pdf`; swap in
authoritative brand values if Dymo's design team publishes them.
