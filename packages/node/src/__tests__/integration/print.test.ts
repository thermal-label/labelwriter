import { describe, it } from 'vitest';

const INTEGRATION = process.env.LABELWRITER_INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('integration: print', () => {
  it('prints a text label via USB', async () => {
    const { openPrinter } = await import('../../index.js');
    const printer = await openPrinter();
    try {
      await printer.printText('Integration Test');
      const status = await printer.getStatus();
      console.log('status:', status);
    } finally {
      await printer.close();
    }
  });

  it('prints an image label via USB', async () => {
    const { openPrinter } = await import('../../index.js');
    const printer = await openPrinter();
    try {
      await printer.printText('Image Test');
    } finally {
      await printer.close();
    }
  });

  it('connects via TCP', async () => {
    const host = process.env.LABELWRITER_HOST ?? '192.168.1.1';
    const { openPrinterTcp } = await import('../../index.js');
    const printer = await openPrinterTcp(host);
    try {
      await printer.printText('TCP Test');
    } finally {
      await printer.close();
    }
  });
});
