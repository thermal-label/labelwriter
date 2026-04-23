/* eslint-disable import-x/consistent-type-specifier-style */
import {
  buildErrorRecovery,
  buildStatusRequest,
  encodeLabel,
  renderText,
  renderImage,
  type DeviceDescriptor,
  type LabelBitmap,
  type PrintOptions,
  type RawImageData,
} from '@thermal-label/labelwriter-core';
import { readFile } from 'node:fs/promises';
import type { Transport } from './transport.js';
import type { PrinterStatus, TextPrintOptions, ImagePrintOptions } from './types.js';

async function decodeImageBuffer(buffer: Buffer): Promise<RawImageData> {
  const maybeCanvas = await import('@napi-rs/canvas').catch(() => null);

  if (!maybeCanvas) {
    throw new Error(
      'Image decoding requires optional dependency @napi-rs/canvas. Pass pre-decoded RawImageData if unavailable.',
    );
  }

  const image = await maybeCanvas.loadImage(buffer);
  const canvas = maybeCanvas.createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);

  return {
    width: image.width,
    height: image.height,
    data: Uint8Array.from(imageData.data),
  };
}

function parseStatus450(bytes: Uint8Array): PrinterStatus {
  const b = bytes[0] ?? 0;
  const errors: string[] = [];
  if (b & 0x01) errors.push('paper-out');
  if (b & 0x02) errors.push('pause');
  if (b & 0x04) errors.push('label-too-long');
  return { ready: b === 0, paperOut: !!(b & 0x01), errors, rawBytes: bytes };
}

function parseStatus550(bytes: Uint8Array): PrinterStatus {
  const status = bytes[0] ?? 0;
  const err1 = bytes[1] ?? 0;
  const err2 = bytes[2] ?? 0;
  const errors: string[] = [];
  if (err1 || err2) errors.push(`error-flags: ${err1.toString(16)} ${err2.toString(16)}`);
  return {
    ready: status === 0 && !err1 && !err2,
    paperOut: !!(err1 & 0x01),
    errors,
    rawBytes: bytes,
  };
}

export class LabelWriterPrinter {
  readonly device: DeviceDescriptor;
  readonly transport: 'usb' | 'tcp';
  private readonly xport: Transport;

  constructor(device: DeviceDescriptor, xport: Transport, transport: 'usb' | 'tcp') {
    this.device = device;
    this.xport = xport;
    this.transport = transport;
  }

  async getStatus(): Promise<PrinterStatus> {
    await this.xport.write(buildStatusRequest());
    const byteCount = this.device.protocol === '550' ? 32 : 1;
    const bytes = await this.xport.read(byteCount);
    return this.device.protocol === '550' ? parseStatus550(bytes) : parseStatus450(bytes);
  }

  async print(bitmap: LabelBitmap, options?: PrintOptions): Promise<void> {
    const bytes = encodeLabel(this.device, bitmap, options);
    await this.xport.write(bytes);
  }

  async printText(text: string, options?: TextPrintOptions): Promise<void> {
    const textOpts = {
      ...(options?.invert !== undefined && { invert: options.invert }),
      ...(options?.scaleX !== undefined && { scaleX: options.scaleX }),
      ...(options?.scaleY !== undefined && { scaleY: options.scaleY }),
    };
    const bitmap = renderText(text, textOpts);
    await this.print(bitmap, options);
  }

  async printImage(image: Buffer | string, options?: ImagePrintOptions): Promise<void> {
    const buffer = typeof image === 'string' ? await readFile(image) : image;
    const raw = await decodeImageBuffer(buffer);
    const imgOpts = {
      ...(options?.threshold !== undefined && { threshold: options.threshold }),
      ...(options?.dither !== undefined && { dither: options.dither }),
      ...(options?.invert !== undefined && { invert: options.invert }),
      ...(options?.rotate !== undefined && { rotate: options.rotate }),
    };
    const bitmap = renderImage(raw, imgOpts);
    await this.print(bitmap, options);
  }

  async recover(): Promise<void> {
    await this.xport.write(buildErrorRecovery());
    const byteCount = this.device.protocol === '550' ? 32 : 1;
    await this.xport.read(byteCount);
  }

  async close(): Promise<void> {
    await this.xport.close();
  }
}
