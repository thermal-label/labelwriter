export { listPrinters, openPrinter, openPrinterTcp } from './discovery.js';
export { LabelWriterPrinter } from './printer.js';
export { UsbTransport, TcpTransport } from './transport.js';
export type { Transport } from './transport.js';
export type {
  OpenOptions,
  PrinterInfo,
  PrinterStatus,
  TextPrintOptions,
  ImagePrintOptions,
} from './types.js';
export type {
  DeviceDescriptor,
  LabelBitmap,
  PrintOptions,
  NetworkSupport,
  Density,
} from '@thermal-label/labelwriter-core';
