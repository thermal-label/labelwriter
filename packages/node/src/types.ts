/* eslint-disable import-x/consistent-type-specifier-style */
import type { DeviceDescriptor, PrintOptions } from '@thermal-label/labelwriter-core';

export interface OpenOptions {
  vid?: number;
  pid?: number;
  serialNumber?: string;
}

export interface PrinterInfo {
  device: DeviceDescriptor;
  serialNumber: string | undefined;
  path: string;
  transport: 'usb';
}

export interface PrinterStatus {
  ready: boolean;
  paperOut: boolean;
  errors: string[];
  rawBytes: Uint8Array;
}

export interface TextPrintOptions extends PrintOptions {
  invert?: boolean;
  scaleX?: number;
  scaleY?: number;
}

export interface ImagePrintOptions extends PrintOptions {
  threshold?: number;
  dither?: boolean;
  invert?: boolean;
  rotate?: 0 | 90 | 180 | 270;
}
