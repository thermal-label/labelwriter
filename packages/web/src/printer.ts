import {
  DEFAULT_MEDIA,
  DEVICES,
  ROTATE_DIRECTION,
  STATUS_REQUEST,
  buildErrorRecovery,
  createPreviewOffline,
  encodeLabel,
  findDevice,
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
} from '@thermal-label/labelwriter-core';
import { MediaNotSpecifiedError } from '@thermal-label/contracts';
import { WebUsbTransport } from '@thermal-label/transport/web';

export interface RequestOptions {
  filters?: USBDeviceFilter[];
}

/**
 * WebUSB `PrinterAdapter` for Dymo LabelWriter printers.
 *
 * Thin wrapper around the shared `WebUsbTransport`. Mirrors the node
 * driver's `pickRotation` wiring: rectangular die-cut media auto-rotates
 * landscape input via the media's `defaultOrientation` hint.
 */
export class WebLabelWriterPrinter implements PrinterAdapter {
  readonly family = 'labelwriter' as const;
  readonly device: DeviceEntry;
  readonly engines: Readonly<Record<string, LabelWriterEngineHandle>>;

  private readonly transport: Transport;
  private lastStatus: PrinterStatus | undefined;

  constructor(device: DeviceEntry, transport: Transport) {
    this.device = device;
    this.transport = transport;
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

  /** Driver-specific recovery sequence — mirror of the node driver. */
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

function buildLabelWriterFilters(): USBDeviceFilter[] {
  const filters: USBDeviceFilter[] = [];
  for (const d of Object.values(DEVICES)) {
    const usb = d.transports.usb;
    if (!usb) continue;
    filters.push({
      vendorId: Number.parseInt(usb.vid, 16),
      productId: Number.parseInt(usb.pid, 16),
    });
  }
  return filters;
}

/** WebUSB filter set matching every supported LabelWriter VID/PID. */
export const DEFAULT_FILTERS: USBDeviceFilter[] = buildLabelWriterFilters();

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
