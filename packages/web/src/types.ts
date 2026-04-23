/* eslint-disable import-x/consistent-type-specifier-style */
import type { PrintOptions } from '@thermal-label/labelwriter-core';

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
