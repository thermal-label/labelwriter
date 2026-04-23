import { Command } from 'commander';
import { runList } from './commands/list.js';
import { runStatus } from './commands/status.js';
import { runPrintText } from './commands/print-text.js';
import { runPrintImage } from './commands/print-image.js';
import { runRecover } from './commands/recover.js';

export async function run(): Promise<void> {
  const program = new Command();

  program
    .name('labelwriter')
    .description('CLI for Dymo LabelWriter printers')
    .version('0.1.0');

  program
    .command('list')
    .description('List connected USB printers')
    .action(() => {
      runList();
    });

  program
    .command('status')
    .description('Query printer status')
    .option('--host <ip>', 'Use TCP transport')
    .option('--serial <sn>', 'Target printer by serial number')
    .action(async (opts: { host?: string; serial?: string }) => {
      await runStatus(opts);
    });

  const print = program.command('print').description('Print a label');

  print
    .command('text <text>')
    .description('Print a text label')
    .option('--invert', 'Invert black/white')
    .option('--scale-x <n>', 'Horizontal scale factor')
    .option('--scale-y <n>', 'Vertical scale factor')
    .option('--density <level>', 'Print density: light, medium, normal, high')
    .option('--mode <mode>', 'Print mode: text, graphics')
    .option('--roll <n>', 'Roll select 0 or 1 (Twin Turbo only)')
    .option('--copies <n>', 'Number of copies')
    .option('--host <ip>', 'Use TCP transport')
    .option('--serial <sn>', 'Target printer by serial number')
    .action(async (text: string, opts: Record<string, string | boolean | undefined>) => {
      await runPrintText(text, opts);
    });

  print
    .command('image <file>')
    .description('Print an image label')
    .option('--threshold <n>', 'Binarization threshold 0-255')
    .option('--dither', 'Apply dithering')
    .option('--invert', 'Invert black/white')
    .option('--rotate <deg>', 'Rotate image: 0, 90, 180, 270')
    .option('--density <level>', 'Print density: light, medium, normal, high')
    .option('--mode <mode>', 'Print mode: text, graphics')
    .option('--copies <n>', 'Number of copies')
    .option('--host <ip>', 'Use TCP transport')
    .option('--serial <sn>', 'Target printer by serial number')
    .action(async (file: string, opts: Record<string, string | boolean | undefined>) => {
      await runPrintImage(file, opts);
    });

  program
    .command('recover')
    .description('Send error recovery sequence to printer')
    .option('--host <ip>', 'Use TCP transport')
    .option('--serial <sn>', 'Target printer by serial number')
    .action(async (opts: { host?: string; serial?: string }) => {
      await runRecover(opts);
    });

  await program.parseAsync(process.argv);
}
