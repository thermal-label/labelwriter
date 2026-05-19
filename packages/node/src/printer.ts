import {
  DEFAULT_MEDIA,
  ENGINE_VERSION_BYTE_COUNT,
  ROTATE_DIRECTION,
  SKU_INFO_BYTE_COUNT,
  build550GetSku,
  build550GetVersion,
  build550Recovery,
  build550StatusRequest,
  PRINT_STATUS_LOCK_NOT_GRANTED,
  STATUS_BYTE_COUNT_550,
  buildErrorRecovery,
  buildStatusRequest,
  createPreviewOffline,
  duoTapeStatusRequest,
  encodeDuoTapeLabel,
  encodeLabel,
  isDuoTapeEngine,
  isEngineDrivable,
  parseDuoTapeStatus,
  parseEngineVersion,
  parseSkuInfo,
  parseStatus,
  pickRotation,
  renderImage,
  skuInfoToMedia,
  statusByteCount,
  type DeviceEntry,
  type EngineVersion,
  type LabelWriterEngineHandle,
  type LabelWriterMedia,
  type LabelWriterPrintOptions,
  type MediaDescriptor,
  type PreviewOptions,
  type PreviewResult,
  type PrintEngine,
  type PrinterAdapter,
  type PrinterStatus,
  type RawImageData,
  type SkuInfo,
  type Transport,
  type TransportType,
} from '@thermal-label/labelwriter-core';
import {
  MediaNotSpecifiedError,
  UnsupportedOperationError,
  WriteSerializer,
} from '@thermal-label/contracts';

/**
 * Print-flow debug tracing — ships ONLY on the `debug/print-flow`
 * branch / `0.6.3-debug.x` prerelease line (npm dist-tag `debug`).
 * Delete this helper and its call sites before merging to main.
 */
function dbg(msg: string): void {
  // eslint-disable-next-line no-console
  console.debug(`[lw-node] ${msg}`);
}

export interface LabelWriterPrinterOptions {
  /**
   * Per-engine transport overrides for multi-engine devices that need
   * one transport per engine (e.g. the LabelWriter 450 Duo, where the
   * label and tape engines live on different USB interfaces).
   *
   * Keys are engine roles (`'label'`, `'tape'`, …). Engines without an
   * entry here fall back to the primary `transport` constructor arg.
   * The Duo tape engine is unreachable until its role is mapped to a
   * transport claiming `bInterfaceNumber: 1`.
   */
  engineTransports?: Record<string, Transport>;
}

/**
 * Node.js driver for Dymo LabelWriter printers.
 *
 * Implements the shared `PrinterAdapter` interface. Takes any
 * `Transport` — `UsbTransport` from `@thermal-label/transport/node` for
 * USB-attached printers, `TcpTransport` for the networked 550 Turbo /
 * 5XL / Wireless.
 *
 * Multi-engine devices (Twin Turbo, Duo) expose per-engine handles via
 * `engines`. The Twin Turbo's two label engines share the primary
 * transport (firmware-level routing by `ESC q`); the Duo's tape engine
 * needs its own transport on `bInterfaceNumber: 1`, passed via
 * `options.engineTransports.tape`.
 *
 * Orientation for label engines is auto-decided via `pickRotation`;
 * tape engines emit head-aligned bitmaps without rotation logic for
 * now (the tape encoder does its own width-fit).
 */
export class LabelWriterPrinter implements PrinterAdapter {
  readonly family = 'labelwriter' as const;
  readonly device: DeviceEntry;
  readonly transportType: TransportType;
  readonly engines: Readonly<Record<string, LabelWriterEngineHandle>>;

  private readonly primaryTransport: Transport;
  private readonly transports: Record<string, Transport>;
  private lastStatus: PrinterStatus | undefined;
  /**
   * Serialises every transport-touching method (`print`, `getStatus`,
   * `getMedia`, `getEngineVersion`, `acquire550Lock`, `recover`, and
   * the per-engine handle's `getStatus`) so concurrent callers can't
   * interleave a status `write()` into an in-flight raster stream.
   * Node ships no `onStatus` poll today, but any consumer calling
   * `getStatus()` during `print()` hits the same hazard — wrapped for
   * uniformity with the web driver. `print()` calls the unwrapped
   * `do*` internals so the nested lock/SKU fetches don't re-enter the
   * lock and deadlock. On the Duo this one serializer conservatively
   * orders across both engine transports — a safe superset of the
   * per-transport guarantee. See `WriteSerializer` in
   * `@thermal-label/contracts`.
   */
  private readonly serializer = new WriteSerializer();

  constructor(
    device: DeviceEntry,
    transport: Transport,
    transportType: TransportType,
    options: LabelWriterPrinterOptions = {},
  ) {
    this.device = device;
    this.primaryTransport = transport;
    this.transportType = transportType;

    this.transports = {};
    for (const engine of device.engines) {
      const override = options.engineTransports?.[engine.role];
      if (override) {
        this.transports[engine.role] = override;
      } else if (isEngineDrivable(engine) && !isDuoTapeEngine(engine)) {
        this.transports[engine.role] = transport;
      }
      // Tape engines (d1-tape) without an explicit override are
      // intentionally not mapped — they live on a separate USB
      // interface than the primary label transport, so auto-mapping
      // would point them at the wrong endpoint. The engine handle is
      // omitted from `this.engines` below until the caller provides
      // `engineTransports: { tape: <transport> }`.
    }

    this.engines = buildEngineHandles(device, this.transports, this);
  }

  get model(): string {
    return this.device.name;
  }

  get connected(): boolean {
    return this.primaryTransport.connected;
  }

  print(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: LabelWriterPrintOptions,
  ): Promise<void> {
    // Whole-method wrap (plan 15 A3). `doPrint` calls the unwrapped
    // `acquire550Lock` / `tryFetchSkuMedia` internals so the nested
    // transport operations don't re-acquire the serializer and
    // self-deadlock.
    return this.serializer.run(() => this.doPrint(image, media, options));
  }

  /**
   * Run `fn` under this printer's write serializer. Package-internal —
   * the per-engine handles in `buildEngineHandles` route their own
   * transport-touching `getStatus()` through here so they share the
   * same serialization guarantee as the class methods.
   */
  runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    return this.serializer.run(fn);
  }

  private async doPrint(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: LabelWriterPrintOptions,
  ): Promise<void> {
    const engine = resolveRequestedEngine(this.device, options?.engine);
    dbg(
      `print start: device=${this.device.key} engine=${engine.role} ` +
        `protocol=${engine.protocol} image=${String(image.width)}x${String(image.height)} ` +
        `media=${media ? 'explicit' : this.lastStatus?.detectedMedia ? 'cached' : 'unset'} ` +
        `copies=${String(options?.copies ?? 1)}`,
    );
    const transport = this.transports[engine.role];
    if (!transport) {
      throw new Error(
        `Engine "${engine.role}" on ${this.device.key} has no transport. ` +
          `For Duo tape, pass { engineTransports: { tape: <transport> } } to the constructor.`,
      );
    }

    // D1 tape (Duo's tape side) — let the unified flow below run.
    // `encodeLabel` dispatches on `engine.protocol` and routes
    // `d1-tape` through `@thermal-label/d1-core`'s `buildPrinterStream`;
    // tape engines skip the 550-only lock + SKU-fallback paths via
    // the `engine.protocol === 'lw5-raster'` guards.

    // 550 family: acquire the print lock and check printer health
    // before sending the job. The lock is what prevents concurrent
    // network hosts from interleaving jobs on port 9100; on USB the
    // call is effectively a free status check (no other host can
    // race anyway, but the response surfaces no-media / jam / cover-
    // open conditions before we waste cycles encoding the bitmap).
    if (engine.protocol === 'lw5-raster') {
      await this.acquire550Lock(transport);
      dbg(
        `550 lock acquired: ready=${String(this.lastStatus?.ready)} ` +
          `errors=${String(this.lastStatus?.errors.length ?? 0)}`,
      );
    }

    let resolvedMedia = media ?? this.lastStatus?.detectedMedia;

    // 550 status doesn't carry media dimensions — those live in the
    // NFC SKU dump (ESC U). Best-effort fetch when no explicit media
    // was passed and no prior `getMedia()` populated the cache.
    if (!resolvedMedia && engine.protocol === 'lw5-raster') {
      const sku = await this.tryFetchSkuMedia();
      if (sku) resolvedMedia = sku;
    }

    if (!resolvedMedia) {
      throw new MediaNotSpecifiedError();
    }
    dbg(`media resolved: ${JSON.stringify(resolvedMedia)}`);
    const rotate = pickRotation(image, resolvedMedia, ROTATE_DIRECTION, options?.rotate);
    const bitmap = renderImage(image, { dither: true, rotate });
    dbg(`rotate=${String(rotate)} bitmap=${String(bitmap.widthPx)}x${String(bitmap.heightPx)}`);
    // Duo tape engine: dispatch through the async encoder that
    // lazy-loads d1-core. Raster engines stay on the sync path.
    const bytes = isDuoTapeEngine(engine)
      ? await encodeDuoTapeLabel(this.device, bitmap, options, resolvedMedia)
      : encodeLabel(this.device, bitmap, options, resolvedMedia);
    dbg(`encoded ${String(bytes.length)} bytes — writing to transport`);
    await transport.write(bytes);
    dbg(`print complete: ${String(bytes.length)} bytes written`);
  }

  /**
   * 550-only: send `ESC A 1` to acquire the print lock, parse the
   * 32-byte response, and refuse to proceed if (a) the lock is held
   * by another host or (b) the printer reports an error condition
   * (no media / jam / cover open / counterfeit / overheated /
   * low-voltage). The job trailer's `ESC Q` releases the lock.
   *
   * Cached `lastStatus.detectedMedia` from a prior `getMedia()` is
   * preserved across the refresh.
   */
  private async acquire550Lock(transport: Transport): Promise<void> {
    await transport.write(build550StatusRequest(1));
    const bytes = await transport.read(STATUS_BYTE_COUNT_550);
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
   * Fetch the SKU info from the loaded consumable's NFC tag (550 only).
   *
   * Returns the parsed 63-byte structure on success. Throws
   * `UnsupportedOperationError` on non-550 devices. Returns `undefined`
   * if the response is shorter than expected or the magic-number check
   * fails (no media present, counterfeit, or comm failure).
   */
  getMedia(): Promise<SkuInfo | undefined> {
    // Serialised — `getMedia()` writes ESC U and reads. `doPrint()`
    // reaches the SKU fetch via `tryFetchSkuMedia` → `doGetMedia`,
    // the unwrapped internal, so it doesn't re-enter the lock.
    return this.serializer.run(() => this.doGetMedia());
  }

  private async doGetMedia(): Promise<SkuInfo | undefined> {
    if (this.device.engines[0]?.protocol !== 'lw5-raster') {
      throw new UnsupportedOperationError(
        `getMedia on ${this.device.key}`,
        `ESC U (Get SKU Information) is only supported on lw5-raster devices.`,
      );
    }
    await this.primaryTransport.write(build550GetSku());
    const bytes = await this.primaryTransport.read(SKU_INFO_BYTE_COUNT);
    if (bytes.length < SKU_INFO_BYTE_COUNT) return undefined;
    try {
      const sku = parseSkuInfo(bytes);
      if (sku.magic !== 0xcab6) return undefined;
      // Cache derived media on lastStatus so subsequent print() calls
      // can fall back to it without another USB roundtrip.
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

  /**
   * Fetch the print engine identity (HW / FW / PID) via `ESC V` (550 only).
   *
   * Returns the parsed 34-byte structure on success. Throws
   * `UnsupportedOperationError` on non-550 devices. Useful as a sanity
   * check after USB enumeration ("did we open the right device?") or
   * for surfacing FW version in diagnostics.
   */
  getEngineVersion(): Promise<EngineVersion | undefined> {
    // Serialised — `getEngineVersion()` writes ESC V and reads.
    return this.serializer.run(() => this.doGetEngineVersion());
  }

  private async doGetEngineVersion(): Promise<EngineVersion | undefined> {
    if (this.device.engines[0]?.protocol !== 'lw5-raster') {
      throw new UnsupportedOperationError(
        `getEngineVersion on ${this.device.key}`,
        `ESC V (Get Print Engine Version) is only supported on lw5-raster devices.`,
      );
    }
    await this.primaryTransport.write(build550GetVersion());
    const bytes = await this.primaryTransport.read(ENGINE_VERSION_BYTE_COUNT);
    if (bytes.length < ENGINE_VERSION_BYTE_COUNT) return undefined;
    try {
      return parseEngineVersion(bytes);
    } catch {
      return undefined;
    }
  }

  private async tryFetchSkuMedia(): Promise<LabelWriterMedia | undefined> {
    try {
      // Unwrapped internal — this runs inside `doPrint()`, which
      // already holds the serializer; calling the wrapped `getMedia()`
      // here would self-deadlock on the lock.
      const sku = await this.doGetMedia();
      if (!sku) return undefined;
      return skuInfoToMedia(sku);
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

  getStatus(): Promise<PrinterStatus> {
    // Serialised against `print()` — see the `serializer` field doc.
    return this.serializer.run(() => this.doGetStatus());
  }

  private async doGetStatus(): Promise<PrinterStatus> {
    // 450 family: ESC A (2 bytes). 550 family: ESC A <lock=0> (3 bytes
    // request, 32-byte response). `buildStatusRequest` picks the right
    // shape from `device.engines[0].protocol`.
    await this.primaryTransport.write(buildStatusRequest(this.device));
    const bytes = await this.primaryTransport.read(statusByteCount(this.device));
    const status = parseStatus(this.device, bytes);
    // Preserve a previously-cached detectedMedia (from getMedia) when
    // refreshing status — the 550 status response itself never carries
    // media identity, so wiping it on every getStatus would be a
    // regression in detection.
    if (this.lastStatus?.detectedMedia && !status.detectedMedia) {
      this.lastStatus = { ...status, detectedMedia: this.lastStatus.detectedMedia };
    } else {
      this.lastStatus = status;
    }
    return this.lastStatus;
  }

  async close(): Promise<void> {
    const seen = new Set<Transport>();
    seen.add(this.primaryTransport);
    await this.primaryTransport.close();
    for (const t of Object.values(this.transports)) {
      if (seen.has(t)) continue;
      seen.add(t);
      await t.close();
    }
  }

  /**
   * Send the error-recovery byte sequence and drain the response.
   * Driver-specific escape hatch — not on `PrinterAdapter`.
   *
   * Protocol-aware:
   * - **450 family** (`lw-raster`): the documented 85×ESC +
   *   ESC A sequence to flush a wedged sync state. Reads back the
   *   1-byte status response.
   * - **550 family**: `ESC Q` to release any pending job state and
   *   the host print lock (per `LW 550 Technical Reference.pdf`
   *   p.13). Reads back the 32-byte status response.
   *
   * The 550 path is the soft recovery; for a destructive reboot
   * use `build550Restart()` directly with `transport.write()`.
   */
  recover(): Promise<void> {
    // Serialised — `recover()` writes a recovery sequence and reads.
    return this.serializer.run(() => this.doRecover());
  }

  private async doRecover(): Promise<void> {
    if (this.device.engines[0]?.protocol === 'lw5-raster') {
      await this.primaryTransport.write(build550Recovery());
    } else {
      await this.primaryTransport.write(buildErrorRecovery());
    }
    await this.primaryTransport.read(statusByteCount(this.device));
  }
}

function resolveRequestedEngine(device: DeviceEntry, requested: string | undefined): PrintEngine {
  if (requested === undefined || requested === 'auto') {
    const first = device.engines[0];
    if (!first) throw new Error(`Device ${device.key} has no engines.`);
    return first;
  }
  const found = device.engines.find(e => e.role === requested);
  if (!found) {
    const roles = device.engines.map(e => e.role).join(', ');
    throw new Error(
      `Device ${device.key} has no engine with role "${requested}". Available: ${roles}.`,
    );
  }
  return found;
}

function buildEngineHandles(
  device: DeviceEntry,
  transports: Record<string, Transport>,
  parent: LabelWriterPrinter,
): Readonly<Record<string, LabelWriterEngineHandle>> {
  const handles: Record<string, LabelWriterEngineHandle> = {};
  for (const engine of device.engines) {
    const transport = transports[engine.role];
    if (!transport) continue;
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
      getStatus(): Promise<PrinterStatus> {
        // Route through the parent's serializer so the per-engine
        // handle's transport I/O is ordered against `print()` and the
        // class-level `getStatus()` — same guarantee, shared lock.
        return parent.runSerialized(async () => {
          if (isDuoTapeEngine(engine)) {
            // Lazy-load d1-core: only consumers actually driving the
            // Duo tape engine pay the dep cost. Throws
            // DuoTapeUnavailableError if d1-core isn't installed —
            // caught by class downstream.
            const request = await duoTapeStatusRequest();
            await transport.write(request);
            const bytes = await transport.read(1);
            return parseDuoTapeStatus(bytes);
          }
          await transport.write(buildStatusRequest(device));
          const bytes = await transport.read(statusByteCount(device));
          return parseStatus(device, bytes);
        });
      },
    };
  }
  return handles;
}
