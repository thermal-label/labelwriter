[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / UnsupportedOperationError

# Class: UnsupportedOperationError

The requested operation is not supported by this driver, printer, or
media.

Used by drivers to reject e.g. an unknown `PrintOptions.density` value,
a cut command on a printer without a cutter, or a two-colour image on
single-colour media.

## Extends

- `Error`

## Constructors

### Constructor

> **new UnsupportedOperationError**(`operation`, `reason`): `UnsupportedOperationError`

#### Parameters

##### operation

`string`

##### reason

`string`

#### Returns

`UnsupportedOperationError`

#### Overrides

`Error.constructor`
