[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [web/src](../README.md) / DeviceIdentificationRequiredError

# Class: DeviceIdentificationRequiredError

A driver-web `requestPrinters(opts)` factory opened the browser
picker and got a port/device back, but couldn't decide which
registry entry it corresponds to. The picker may have offered an
unidentifiable serial port (Web Serial doesn't expose BT device
names) or the picked USB device's VID/PID didn't match anything in
the driver's registry.

The error carries the candidate registry entries (filtered to ones
declaring the connecting transport) and a `continueWith(deviceKey)`
closure that resumes the connect flow with the operator's choice —
no second picker open required, the original port/device is held
inside the closure.

Harness-shell shape:
```ts
try {
  return await adapter.requestPrinters({ transport });
} catch (err) {
  if (err instanceof DeviceIdentificationRequiredError) {
    const choice = await showDropdown(err.candidates);
    return await err.continueWith(choice);
  }
  throw err;
}
```

## Extends

- `Error`

## Constructors

### Constructor

> **new DeviceIdentificationRequiredError**(`candidates`, `continueWith`): `DeviceIdentificationRequiredError`

#### Parameters

##### candidates

readonly [`DeviceEntry`](../../../core/src/interfaces/DeviceEntry.md)[]

##### continueWith

(`deviceKey`) => `Promise`\<`Readonly`\<`Record`\<`string`, [`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md)\>\>\>

#### Returns

`DeviceIdentificationRequiredError`

#### Overrides

`Error.constructor`

## Properties

### candidates

> `readonly` **candidates**: readonly [`DeviceEntry`](../../../core/src/interfaces/DeviceEntry.md)[]

***

### continueWith

> `readonly` **continueWith**: (`deviceKey`) => `Promise`\<`Readonly`\<`Record`\<`string`, [`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md)\>\>\>

#### Parameters

##### deviceKey

`string`

#### Returns

`Promise`\<`Readonly`\<`Record`\<`string`, [`PrinterAdapter`](../../../core/src/interfaces/PrinterAdapter.md)\>\>\>
