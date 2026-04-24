import { describe, it } from 'vitest';

const INTEGRATION = process.env.LABELWRITER_INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('integration: print', () => {
  it('prints a label via USB', async () => {
    const { discovery } = await import('../../index.js');
    const { MEDIA } = await import('@thermal-label/labelwriter-core');
    const printer = await discovery.openPrinter();
    try {
      const image = {
        width: 400,
        height: 200,
        data: new Uint8Array(400 * 200 * 4).fill(0),
      };
      await printer.print(image, MEDIA.ADDRESS_STANDARD);
      const status = await printer.getStatus();
      console.log('status:', status);
    } finally {
      await printer.close();
    }
  });

  it('connects via TCP', async () => {
    const host = process.env.LABELWRITER_HOST ?? '192.168.1.1';
    const { discovery } = await import('../../index.js');
    const { MEDIA } = await import('@thermal-label/labelwriter-core');
    const printer = await discovery.openPrinter({ host });
    try {
      const image = {
        width: 400,
        height: 200,
        data: new Uint8Array(400 * 200 * 4).fill(0),
      };
      await printer.print(image, MEDIA.ADDRESS_STANDARD);
    } finally {
      await printer.close();
    }
  });
});
