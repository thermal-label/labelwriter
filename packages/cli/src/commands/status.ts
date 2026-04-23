import chalk from 'chalk';
import ora from 'ora';
import { openPrinter, openPrinterTcp } from '@thermal-label/labelwriter-node';

export interface StatusOptions {
  host?: string;
  serial?: string;
}

export async function runStatus(options: StatusOptions): Promise<void> {
  const spinner = ora('Querying printer status…').start();

  try {
    const printer = await (options.host !== undefined
      ? openPrinterTcp(options.host)
      : openPrinter({ ...(options.serial !== undefined && { serialNumber: options.serial }) }));

    try {
      const status = await printer.getStatus();
      spinner.stop();

      if (status.ready) {
        console.log(chalk.green('✓ Printer is ready'));
      } else {
        console.log(chalk.red('✗ Printer not ready'));
      }

      if (status.paperOut) {
        console.log(chalk.yellow('  Paper out'));
      }

      for (const err of status.errors) {
        console.log(chalk.red(`  Error: ${err}`));
      }
    } finally {
      await printer.close();
    }
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
