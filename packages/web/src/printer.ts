/* eslint-disable import-x/consistent-type-specifier-style */
import type { DeviceDescriptor, LabelBitmap, PrintOptions } from '@thermal-label/labelwriter-core';
import {
  DEVICES,
  buildErrorRecovery,
  buildStatusRequest,
  encodeLabel,
  findDevice,
  renderText,
} from '@thermal-label/labelwriter-core';
import { WebUsbTransport } from './transport.js';
import type { PrinterStatus, TextPrintOptions, ImagePrintOptions } from './types.js';

function parsePrinterStatus(bytes: Uint8Array): PrinterStatus {
  const byte0 = bytes[0] ?? 0;
  const paperOut = (byte0 & 0x01) !== 0;
  const errors: string[] = [];
  if (paperOut) errors.push('Paper out');
  if ((byte0 & 0x08) !== 0) errors.push('Cover open');
  return { ready: errors.length === 0, paperOut, errors, rawBytes: bytes };
}

export class WebLabelWriterPrinter {
  readonly device: USBDevice;
  readonly descriptor: DeviceDescriptor;
  private readonly transport: WebUsbTransport;

  constructor(device: USBDevice, descriptor: DeviceDescriptor) {
    this.device = device;
    this.descriptor = descriptor;
    this.transport = new WebUsbTransport(device);
  }

  async getStatus(): Promise<PrinterStatus> {
    await this.transport.write(buildStatusRequest());
    const byteCount = this.descriptor.protocol === '550' ? 32 : 1;
    const bytes = await this.transport.read(byteCount);
    return parsePrinterStatus(bytes);
  }

  async print(bitmap: LabelBitmap, options: PrintOptions = {}): Promise<void> {
    const data = encodeLabel(this.descriptor, bitmap, options);
    await this.transport.write(data);
  }

  async printText(text: string, options: TextPrintOptions = {}): Promise<void> {
    const { invert, scaleX, scaleY, ...printOptions } = options;
    const bitmap = renderText(text, {
      ...(invert !== undefined && { invert }),
      ...(scaleX !== undefined && { scaleX }),
      ...(scaleY !== undefined && { scaleY }),
    });
    await this.print(bitmap, printOptions);
  }

  async printImage(imageData: ImageData, options: ImagePrintOptions = {}): Promise<void> {
    const { threshold, dither, invert, rotate, ...printOptions } = options;
    const raw = {
      width: imageData.width,
      height: imageData.height,
      data: new Uint8Array(imageData.data.buffer),
    };
    const { renderImage } = await import('@thermal-label/labelwriter-core');
    const bitmap = renderImage(raw, {
      ...(threshold !== undefined && { threshold }),
      ...(dither !== undefined && { dither }),
      ...(invert !== undefined && { invert }),
      ...(rotate !== undefined && { rotate }),
    });
    await this.print(bitmap, printOptions);
  }

  async printImageURL(url: string, options: ImagePrintOptions = {}): Promise<void> {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
    await this.printImage(imageData, options);
  }

  async recover(): Promise<void> {
    await this.transport.write(buildErrorRecovery());
    const byteCount = this.descriptor.protocol === '550' ? 32 : 1;
    await this.transport.read(byteCount);
  }

  isConnected(): boolean {
    return this.device.opened;
  }

  async disconnect(): Promise<void> {
    await this.transport.close();
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
}

export async function requestPrinter(): Promise<WebLabelWriterPrinter> {
  const filters = Object.values(DEVICES).map(d => ({ vendorId: d.vid, productId: d.pid }));
  const usbDevice = await navigator.usb.requestDevice({ filters });
  return fromUSBDevice(usbDevice);
}

export function fromUSBDevice(usbDevice: USBDevice): WebLabelWriterPrinter {
  const descriptor = findDevice(usbDevice.vendorId, usbDevice.productId);
  if (!descriptor) {
    throw new Error(
      `Unknown device: VID=0x${usbDevice.vendorId.toString(16)} PID=0x${usbDevice.productId.toString(16)}`,
    );
  }
  return new WebLabelWriterPrinter(usbDevice, descriptor);
}
