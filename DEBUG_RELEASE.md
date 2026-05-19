# Debug release — `0.6.3-debug.x`

This branch (`debug/print-flow`) carries **temporary `console.debug` tracing
through the print flow**. It exists only to publish an instrumented build to
npm so a downstream CI can be debugged against a real package. It must never
merge to `main`.

## What's instrumented

`console.debug` calls (one `dbg()` helper per package, grep-able) at the
crucial print-flow points:

- `packages/node/src/printer.ts` — `doPrint()`: start, 550 lock, media
  resolved, rotation/bitmap, encoded bytes, write complete.
- `packages/web/src/printer.ts` — same points in its `doPrint()`.
- `packages/core/src/protocol.ts` — `encodeLabel()` entry + 450 byte count,
  `encodeDuoTapeLabel()` entry.

Log prefixes: `[lw-node]`, `[lw-web]`, `[lw-core]`.

## How it reaches npm

`.github/workflows/release.yml` on this branch detects a prerelease tag
(a `-` in the version) and publishes under that identifier as an npm
**dist-tag** instead of `latest` — so `latest` is untouched. This change
lives only on this branch; `main`'s `release.yml` is unchanged.

Publish:

```sh
git push origin debug/print-flow
git tag v0.6.3-debug.0 && git push origin v0.6.3-debug.0
```

The Release workflow publishes all three packages at `0.6.3-debug.0` to the
`debug` dist-tag.

## How a consumer uses it

```jsonc
// CI / consumer package.json
"@thermal-label/labelwriter-node": "debug"   // or pin "0.6.3-debug.0"
```

npm `^`/`~` ranges never resolve to a prerelease, and it is not on `latest`,
so no other consumer picks it up by accident.

## Teardown — there is no revert release

1. Consumer drops the `@debug` pin, back to `^0.6.3` (or whatever stable).
2. `npm dist-tag rm @thermal-label/labelwriter-core debug` (and `-node`, `-web`).
3. Delete this branch.

Iterating? Bump to `0.6.3-debug.1`, re-tag.
