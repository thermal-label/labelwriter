import ora from 'ora';
/* eslint-disable import-x/consistent-type-specifier-style */
import type { Density, ImagePrintOptions } from '@thermal-label/labelwriter-node';
import { openPrinter, openPrinterTcp } from '@thermal-label/labelwriter-node';

export interface PrintImageCliOptions {
  threshold?: string;
  dither?: boolean;
  invert?: boolean;
  rotate?: string;
  density?: string;
  mode?: string;
  copies?: string;
  host?: string;
  serial?: string;
}

export async function runPrintImage(file: string, opts: PrintImageCliOptions): Promise<void> {
  const spinner = ora('Printing…').start();

  try {
    const printer = await (opts.host !== undefined
      ? openPrinterTcp(opts.host)
      : openPrinter({ ...(opts.serial !== undefined && { serialNumber: opts.serial }) }));

    try {
      const printOptions: ImagePrintOptions = {
        ...(opts.threshold !== undefined && { threshold: parseInt(opts.threshold, 10) }),
        ...(opts.dither === true && { dither: true }),
        ...(opts.invert === true && { invert: true }),
        ...(opts.rotate !== undefined && {
          rotate: parseInt(opts.rotate, 10) as 0 | 90 | 180 | 270,
        }),
        ...(opts.density !== undefined && { density: opts.density as Density }),
        ...(opts.mode !== undefined && { mode: opts.mode as 'text' | 'graphics' }),
        ...(opts.copies !== undefined && { copies: parseInt(opts.copies, 10) }),
      };

      await printer.printImage(file, printOptions);
      spinner.succeed('Done');
    } finally {
      await printer.close();
    }
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
