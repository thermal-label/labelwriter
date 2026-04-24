import {
  DEFAULT_MEDIA,
  DEVICES,
  STATUS_REQUEST,
  buildErrorRecovery,
  createPreviewOffline,
  encodeLabel,
  findDevice,
  parseStatus,
  renderImage,
  statusByteCount,
  type LabelWriterDevice,
  type LabelWriterMedia,
  type LabelWriterPrintOptions,
  type MediaDescriptor,
  type PreviewOptions,
  type PreviewResult,
  type PrinterAdapter,
  type PrinterStatus,
  type RawImageData,
  type Transport,
} from '@thermal-label/labelwriter-core';
import { MediaNotSpecifiedError } from '@thermal-label/contracts';
import { buildUsbFilters } from '@thermal-label/transport';
import { WebUsbTransport } from '@thermal-label/transport/web';

export interface RequestOptions {
  filters?: USBDeviceFilter[];
}

/**
 * WebUSB `PrinterAdapter` for Dymo LabelWriter printers.
 *
 * Thin wrapper around the shared `WebUsbTransport`. Callers obtain one
 * of these via `requestPrinter()` (new pairing) or `fromUSBDevice()`
 * (previously paired).
 */
export class WebLabelWriterPrinter implements PrinterAdapter {
  readonly family = 'labelwriter' as const;
  readonly device: LabelWriterDevice;

  private readonly transport: Transport;
  private lastStatus: PrinterStatus | undefined;

  constructor(device: LabelWriterDevice, transport: Transport) {
    this.device = device;
    this.transport = transport;
  }

  get model(): string {
    return this.device.name;
  }

  get connected(): boolean {
    return this.transport.connected;
  }

  async print(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: LabelWriterPrintOptions,
  ): Promise<void> {
    const resolvedMedia = (media ?? this.lastStatus?.detectedMedia) as
      | LabelWriterMedia
      | undefined;
    if (!resolvedMedia) {
      throw new MediaNotSpecifiedError();
    }
    const bitmap = renderImage(image, { dither: true });
    const bytes = encodeLabel(this.device, bitmap, options);
    await this.transport.write(bytes);
  }

  createPreview(image: RawImageData, options?: PreviewOptions): Promise<PreviewResult> {
    const override = options?.media as LabelWriterMedia | undefined;
    const detected = this.lastStatus?.detectedMedia as LabelWriterMedia | undefined;
    if (override) return Promise.resolve(createPreviewOffline(image, override));
    if (detected) return Promise.resolve(createPreviewOffline(image, detected));
    return Promise.resolve({
      ...createPreviewOffline(image, DEFAULT_MEDIA),
      assumed: true,
    });
  }

  async getStatus(): Promise<PrinterStatus> {
    await this.transport.write(STATUS_REQUEST);
    const bytes = await this.transport.read(statusByteCount(this.device));
    const status = parseStatus(this.device, bytes);
    this.lastStatus = status;
    return status;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  /** Driver-specific recovery sequence — mirror of the node driver. */
  async recover(): Promise<void> {
    await this.transport.write(buildErrorRecovery());
    await this.transport.read(statusByteCount(this.device));
  }
}

/** WebUSB filter set matching every supported LabelWriter VID/PID. */
export const DEFAULT_FILTERS = buildUsbFilters(Object.values(DEVICES));

/**
 * Show the browser's USB picker and wrap the selected device.
 *
 * Requires a user gesture. The selected `USBDevice` is handed to
 * `WebUsbTransport.fromDevice()`, which opens it and claims interface 0.
 */
export async function requestPrinter(options: RequestOptions = {}): Promise<WebLabelWriterPrinter> {
  const filters = options.filters ?? DEFAULT_FILTERS;
  const usbDevice = await navigator.usb.requestDevice({ filters });
  return fromUSBDevice(usbDevice);
}

/**
 * Wrap an already-selected `USBDevice` (e.g. from
 * `navigator.usb.getDevices()`).
 *
 * @throws when the VID/PID is not in the LabelWriter registry.
 */
export async function fromUSBDevice(usbDevice: USBDevice): Promise<WebLabelWriterPrinter> {
  const descriptor = findDevice(usbDevice.vendorId, usbDevice.productId);
  if (!descriptor) {
    throw new Error(
      `Unsupported USB device: VID=0x${usbDevice.vendorId.toString(16)} PID=0x${usbDevice.productId.toString(16)}`,
    );
  }
  const transport = await WebUsbTransport.fromDevice(usbDevice);
  return new WebLabelWriterPrinter(descriptor, transport);
}
