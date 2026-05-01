import {
  DEFAULT_MEDIA,
  ROTATE_DIRECTION,
  STATUS_REQUEST,
  buildErrorRecovery,
  createPreviewOffline,
  encodeLabel,
  isEngineDrivable,
  parseStatus,
  pickRotation,
  renderImage,
  statusByteCount,
  type DeviceEntry,
  type LabelWriterEngineHandle,
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
 *
 * Orientation is auto-decided via `pickRotation`: rectangular die-cut
 * media declares `defaultOrientation: 'horizontal'`, so the driver
 * rotates landscape input 90° CW. Pre-retrofit, landscape input was
 * silently cropped to head width — the auto-rotate path fixes that.
 * Override per-call with `options.rotate`.
 */
export class LabelWriterPrinter implements PrinterAdapter {
  readonly family = 'labelwriter' as const;
  readonly device: DeviceEntry;
  readonly transportType: TransportType;
  readonly engines: Readonly<Record<string, LabelWriterEngineHandle>>;

  private readonly transport: Transport;
  private lastStatus: PrinterStatus | undefined;

  constructor(device: DeviceEntry, transport: Transport, transportType: TransportType) {
    this.device = device;
    this.transport = transport;
    this.transportType = transportType;
    this.engines = buildEngineHandles(device, this);
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
    const resolvedMedia = (media ?? this.lastStatus?.detectedMedia) as LabelWriterMedia | undefined;
    if (!resolvedMedia) {
      throw new MediaNotSpecifiedError();
    }
    const rotate = pickRotation(image, resolvedMedia, ROTATE_DIRECTION, options?.rotate);
    const bitmap = renderImage(image, { dither: true, rotate });
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

interface LabelWriterPrintParent {
  print(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: LabelWriterPrintOptions,
  ): Promise<void>;
}

function buildEngineHandles(
  device: DeviceEntry,
  parent: LabelWriterPrintParent,
): Readonly<Record<string, LabelWriterEngineHandle>> {
  const handles: Record<string, LabelWriterEngineHandle> = {};
  for (const engine of device.engines) {
    if (!isEngineDrivable(engine)) continue;
    const role = engine.role;
    handles[role] = {
      role,
      engine,
      print(
        image: RawImageData,
        media?: MediaDescriptor,
        options?: Omit<LabelWriterPrintOptions, 'engine'>,
      ): Promise<void> {
        return parent.print(image, media, { ...options, engine: role });
      },
    };
  }
  return handles;
}
