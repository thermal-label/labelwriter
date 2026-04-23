import chalk from 'chalk';
import ora from 'ora';
import { openPrinter, openPrinterTcp } from '@thermal-label/labelwriter-node';

export interface RecoverOptions {
  host?: string;
  serial?: string;
}

export async function runRecover(options: RecoverOptions): Promise<void> {
  const spinner = ora('Sending error recovery…').start();

  try {
    const printer = await (options.host !== undefined
      ? openPrinterTcp(options.host)
      : openPrinter({ ...(options.serial !== undefined && { serialNumber: options.serial }) }));

    try {
      await printer.recover();
      const status = await printer.getStatus();
      spinner.stop();

      if (status.ready) {
        console.log(chalk.green('✓ Printer recovered and ready'));
      } else {
        console.log(chalk.yellow('⚠ Recovery sent but printer not ready'));
      }
    } finally {
      await printer.close();
    }
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
