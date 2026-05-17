[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / loadD1Core

# Function: loadD1Core()

> **loadD1Core**(): `Promise`\<`D1CoreModule`\>

Lazy-load `@thermal-label/d1-core`. Returns the module on success;
throws `DuoTapeUnavailableError` on `ERR_MODULE_NOT_FOUND` (the
`vite`/`rollup`/`node` shape when the optional peer is absent).

The dynamic import is the load-bearing bit for the optional-peer
contract: bundlers (Vite/Rollup/webpack) treat `await import(...)` of
a bare specifier as a code-split point, so consumers that never
traverse this function don't pull d1-core into their bundle.

## Returns

`Promise`\<`D1CoreModule`\>
