import {
  DEFAULT_MEDIA,
  STATUS_REQUEST,
  buildErrorRecovery,
  createPreviewOffline,
  encodeLabel,
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
  type TransportType,
} from '@thermal-label/labelwriter-core';
import { MediaNotSpecifiedError } from '@thermal-label/contracts';

/**
 * Node.js driver for Dymo LabelWriter printers.
 *
 * Implements the shared `PrinterAdapter` interface. Takes any
 * `Transport` — `UsbTransport` from `@thermal-label/transport/node` for
 * USB-attached printers, `TcpTransport` for the networked 550 Turbo /
 * 5XL / Wireless.
 */
export class LabelWriterPrinter implements PrinterAdapter {
  readonly family = 'labelwriter' as const;
  readonly device: LabelWriterDevice;
  readonly transportType: TransportType;

  private readonly transport: Transport;
  private lastStatus: PrinterStatus | undefined;

  constructor(device: LabelWriterDevice, transport: Transport, transportType: TransportType) {
    this.device = device;
    this.transport = transport;
    this.transportType = transportType;
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

  /**
   * Send the error-recovery byte sequence and drain the response.
   *
   * Driver-specific escape hatch — not on `PrinterAdapter`. Useful after
   * a paper jam / label-too-long condition to resume normal operation.
   */
  async recover(): Promise<void> {
    await this.transport.write(buildErrorRecovery());
    await this.transport.read(statusByteCount(this.device));
  }
}
