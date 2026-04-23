import chalk from 'chalk';
import { listPrinters } from '@thermal-label/labelwriter-node';

export function runList(): void {
  const printers = listPrinters();

  if (printers.length === 0) {
    console.log(chalk.yellow('No LabelWriter printers found.'));
    return;
  }

  console.log(chalk.bold(`Found ${String(printers.length)} printer(s):\n`));

  for (const p of printers) {
    console.log(
      `  ${chalk.cyan(p.device.name)}  ${chalk.gray(`[${p.path}]`)}${p.serialNumber !== undefined ? `  SN: ${p.serialNumber}` : ''}`,
    );
  }
}
