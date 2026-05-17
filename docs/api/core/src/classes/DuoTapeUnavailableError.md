[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / DuoTapeUnavailableError

# Class: DuoTapeUnavailableError

Thrown when a Duo tape-side code path needs `@thermal-label/d1-core`
but the package isn't installed in the consuming app. `d1-core` is an
**optional** peer of `@thermal-label/labelwriter-core` — apps that
only drive the LW/LW5 raster engines don't need it. Apps that drive
the LabelWriter Duo's tape engine install `d1-core` as a peer and
pay no facade tax: they import it directly when they need its types.

Subclasses `Error` (matching the contracts package's error style:
`MediaNotSpecifiedError`, `UnsupportedOperationError`, …) so consumers
can catch by class. The `name` is set explicitly so it survives
structuredClone / `JSON.stringify` round-trips.

## Extends

- `Error`

## Constructors

### Constructor

> **new DuoTapeUnavailableError**(): `DuoTapeUnavailableError`

#### Returns

`DuoTapeUnavailableError`

#### Overrides

`Error.constructor`
