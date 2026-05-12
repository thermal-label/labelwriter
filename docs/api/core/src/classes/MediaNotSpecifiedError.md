[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / MediaNotSpecifiedError

# Class: MediaNotSpecifiedError

`PrinterAdapter.print()` or `createPreview()` was called without a
media argument and no detected media was available.

The caller must either pass `media` explicitly or call `getStatus()`
first so the adapter can cache a detected media descriptor.

## Extends

- `Error`

## Constructors

### Constructor

> **new MediaNotSpecifiedError**(): `MediaNotSpecifiedError`

#### Returns

`MediaNotSpecifiedError`

#### Overrides

`Error.constructor`
