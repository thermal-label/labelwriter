import {
  DEFAULT_MEDIA,
  DEVICES,
  ROTATE_DIRECTION,
  SKU_INFO_BYTE_COUNT,
  build550GetSku,
  build550Recovery,
  build550StatusRequest,
  PRINT_STATUS_LOCK_NOT_GRANTED,
  STATUS_BYTE_COUNT_550,
  buildErrorRecovery,
  buildStatusRequest,
  createPreviewOffline,
  encodeLabel,
  findDevice,
  isEngineDrivable,
  parseSkuInfo,
  parseStatus,
  pickRotation,
  renderImage,
  skuInfoToMedia,
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
  type SkuInfo,
  type Transport,
} from '@thermal-label/labelwriter-core';
import { MediaNotSpecifiedError, UnsupportedOperationError } from '@thermal-label/contracts';
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
    // 550 family: acquire the print lock and check printer health
    // before sending the job. See the node driver for the full
    // contract. Released by `ESC Q` in the job trailer.
    if (this.device.engines[0]?.protocol === 'lw-550') {
      await this.acquire550Lock();
    }

    let resolvedMedia = (media ?? this.lastStatus?.detectedMedia) as LabelWriterMedia | undefined;

    // 550 status doesn't carry media dimensions — those live in the
    // NFC SKU dump (ESC U). Best-effort fetch when no explicit media
    // was passed and no prior `getMedia()` populated the cache.
    if (!resolvedMedia && this.device.engines[0]?.protocol === 'lw-550') {
      try {
        const sku = await this.getMedia();
        if (sku) resolvedMedia = skuInfoToMedia(sku);
      } catch {
        // Best-effort — fall through to MediaNotSpecifiedError below.
      }
    }

    if (!resolvedMedia) {
      throw new MediaNotSpecifiedError();
    }
    const rotate = pickRotation(image, resolvedMedia, ROTATE_DIRECTION, options?.rotate);
    const bitmap = renderImage(image, { dither: true, rotate });
    const bytes = encodeLabel(this.device, bitmap, options);
    await this.transport.write(bytes);
  }

  private async acquire550Lock(): Promise<void> {
    await this.transport.write(build550StatusRequest(1));
    const bytes = await this.transport.read(STATUS_BYTE_COUNT_550);
    const status = parseStatus(this.device, bytes);
    if (bytes[0] === PRINT_STATUS_LOCK_NOT_GRANTED) {
      throw new Error(
        `Print lock on ${this.device.key} is held by another host. ` +
          `Wait for the active job to finish, then retry.`,
      );
    }
    if (this.lastStatus?.detectedMedia && !status.detectedMedia) {
      this.lastStatus = { ...status, detectedMedia: this.lastStatus.detectedMedia };
    } else {
      this.lastStatus = status;
    }
    const firstError = status.errors[0];
    if (firstError) {
      throw new Error(
        `Cannot print on ${this.device.key}: ${firstError.message} (${firstError.code})`,
      );
    }
  }

  /**
   * Fetch SKU info from the loaded consumable's NFC tag (550 only).
   * Mirror of the node driver's `getMedia()` — see that JSDoc for the
   * full contract.
   */
  async getMedia(): Promise<SkuInfo | undefined> {
    if (this.device.engines[0]?.protocol !== 'lw-550') {
      throw new UnsupportedOperationError(
        `getMedia on ${this.device.key}`,
        `ESC U (Get SKU Information) is only supported on lw-550 devices.`,
      );
    }
    await this.transport.write(build550GetSku());
    const bytes = await this.transport.read(SKU_INFO_BYTE_COUNT);
    if (bytes.length < SKU_INFO_BYTE_COUNT) return undefined;
    try {
      const sku = parseSkuInfo(bytes);
      if (sku.magic !== 0xcab6) return undefined;
      const detected = skuInfoToMedia(sku);
      this.lastStatus = {
        ...(this.lastStatus ?? {
          ready: true,
          mediaLoaded: true,
          errors: [],
          rawBytes: new Uint8Array(0),
        }),
        detectedMedia: detected,
      };
      return sku;
    } catch {
      return undefined;
    }
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
    await this.transport.write(buildStatusRequest(this.device));
    const bytes = await this.transport.read(statusByteCount(this.device));
    const status = parseStatus(this.device, bytes);
    if (this.lastStatus?.detectedMedia && !status.detectedMedia) {
      this.lastStatus = { ...status, detectedMedia: this.lastStatus.detectedMedia };
    } else {
      this.lastStatus = status;
    }
    return this.lastStatus;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  /**
   * Driver-specific recovery sequence — mirror of the node driver.
   *
   * 550 family sends `ESC Q` (release pending job + host lock); 450
   * family sends the legacy 85×ESC + ESC A sync-flush. Drains the
   * device-appropriate status response in either case.
   */
  async recover(): Promise<void> {
    if (this.device.engines[0]?.protocol === 'lw-550') {
      await this.transport.write(build550Recovery());
    } else {
      await this.transport.write(buildErrorRecovery());
    }
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
