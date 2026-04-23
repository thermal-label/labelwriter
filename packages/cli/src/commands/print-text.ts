import ora from 'ora';
/* eslint-disable import-x/consistent-type-specifier-style */
import type { Density, TextPrintOptions } from '@thermal-label/labelwriter-node';
import { openPrinter, openPrinterTcp } from '@thermal-label/labelwriter-node';

export interface PrintTextCliOptions {
  invert?: boolean;
  scaleX?: string;
  scaleY?: string;
  density?: string;
  mode?: string;
  roll?: string;
  copies?: string;
  host?: string;
  serial?: string;
}

export async function runPrintText(text: string, opts: PrintTextCliOptions): Promise<void> {
  const spinner = ora('Printing…').start();

  try {
    const printer = await (opts.host !== undefined
      ? openPrinterTcp(opts.host)
      : openPrinter({ ...(opts.serial !== undefined && { serialNumber: opts.serial }) }));

    try {
      const printOptions: TextPrintOptions = {
        ...(opts.invert === true && { invert: true }),
        ...(opts.scaleX !== undefined && { scaleX: parseFloat(opts.scaleX) }),
        ...(opts.scaleY !== undefined && { scaleY: parseFloat(opts.scaleY) }),
        ...(opts.density !== undefined && { density: opts.density as Density }),
        ...(opts.mode !== undefined && { mode: opts.mode as 'text' | 'graphics' }),
        ...(opts.roll !== undefined && { roll: parseInt(opts.roll, 10) as 0 | 1 }),
        ...(opts.copies !== undefined && { copies: parseInt(opts.copies, 10) }),
      };

      await printer.printText(text, printOptions);
      spinner.succeed('Done');
    } finally {
      await printer.close();
    }
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
