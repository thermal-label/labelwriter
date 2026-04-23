# Getting started

## Node.js

### Install

```bash
npm install @thermal-label/labelwriter-node
```

### Print text over USB

```ts
import { openPrinter } from '@thermal-label/labelwriter-node';

const printer = await openPrinter();
try {
  await printer.printText('Hello, world!');
} finally {
  await printer.close();
}
```

### Print over TCP (wireless models)

```ts
import { openPrinterTcp } from '@thermal-label/labelwriter-node';

const printer = await openPrinterTcp('192.168.1.100');
try {
  await printer.printText('Shipped!', { density: 'high' });
} finally {
  await printer.close();
}
```

### Linux udev rule

On Linux, USB access requires a udev rule. Create `/etc/udev/rules.d/99-labelwriter.rules`:

```
SUBSYSTEM=="usb", ATTR{idVendor}=="0922", GROUP="plugdev", MODE="0664"
```

Then reload rules and add your user to the `plugdev` group:

```bash
sudo udevadm control --reload-rules
sudo usermod -aG plugdev $USER
```

Log out and back in for the group change to take effect.

## CLI

### Install globally

```bash
npm install -g @thermal-label/labelwriter-cli
```

### Quick examples

```bash
# List connected printers
labelwriter list

# Print a text label
labelwriter print text "Hello, world!"

# Print with options
labelwriter print text "Fragile" --density high --copies 3

# Check printer status
labelwriter status

# Print image
labelwriter print image ./label.png --threshold 128
```

See the [CLI reference](/cli) for all commands and flags.

## Web (browser)

### Install

```bash
npm install @thermal-label/labelwriter-web
```

Requires Chrome or Edge (WebUSB is not supported in Firefox or Safari).
Must be served over HTTPS or localhost (secure context requirement).

### Quick start

```ts
import { requestPrinter } from '@thermal-label/labelwriter-web';

// Triggers browser's USB device picker
const printer = await requestPrinter();
await printer.printText('Hello from the browser!');
await printer.disconnect();
```

## NFC label lock

### What is it?

The Dymo LabelWriter 550 series (550, 550 Turbo, 5XL, and related models) includes hardware-level NFC validation. Before printing, the printer reads an NFC chip embedded in the label roll. If the chip is absent or not recognised as a genuine Dymo label, the printer reports a paper-out error and refuses to print.

### Which models are affected?

All `protocol: '550'` devices — see [Hardware](/hardware) for the full list. The 450 series and older models do not have this restriction.

### Can it be bypassed?

**No.** The NFC check is performed entirely within the printer's own firmware, independent of the host software. There is no command or sequence that disables it. Using genuine Dymo-certified label rolls is the only solution.

### What does the error look like?

`getStatus()` will return `{ ready: false, paperOut: true, errors: ['Paper out'] }`. The printer will also show a blinking orange LED.
