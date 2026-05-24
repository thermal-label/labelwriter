import {
  DEFAULT_MEDIA,
  DEVICES,
  ENGINE_VERSION_BYTE_COUNT,
  ROTATE_DIRECTION,
  SKU_INFO_BYTE_COUNT,
  build550GetSku,
  build550GetVersion,
  build550Recovery,
  build550StatusRequest,
  compose550Job,
  write550Job,
  PRINT_STATUS_LOCK_NOT_GRANTED,
  STATUS_BYTE_COUNT_550,
  buildErrorRecovery,
  buildStatusRequest,
  createPreviewOffline,
  duoTapeStatusRequest,
  encodeDuoTapeLabel,
  encodeLabel,
  findDevice,
  isDuoTapeEngine,
  isEngineDrivable,
  parseDuoTapeStatus,
  parseEngineVersion,
  parseSkuInfo,
  parseStatus,
  pickRotation,
  renderImage,
  skuInfoDetails,
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
  type StatusDetail,
  type RawImageData,
  type SkuInfo,
  type Transport,
} from '@thermal-label/labelwriter-core';
import {
  MediaNotSpecifiedError,
  UnsupportedOperationError,
  WriteSerializer,
  pollingOnStatus,
} from '@thermal-label/contracts';
import { WebUsbTransport } from '@thermal-label/transport/web';

/**
 * Print-flow debug tracing — ships ONLY on the `debug/print-flow`
 * branch / `0.6.3-debug.x` prerelease line (npm dist-tag `debug`).
 * Delete this helper and its call sites before merging to main.
 */
function dbg(msg: string): void {
  // eslint-disable-next-line no-console
  console.debug(`[lw-web] ${msg}`);
}

const D1_STATUS_BYTE_COUNT = 1;

/**
 * Read deadline for the driver's pre-print and status transport reads
 * (`getStatus()`, `acquire550Lock()`, `getMedia()`). Matches the
 * harness's pre-v2 `STATUS_POLL_TIMEOUT_MS` so observable timing on
 * healthy devices is unchanged; the deadline only fires when the device
 * fails to respond at all (e.g. the LW Duo's label engine on a stale
 * claim, which is `unverified` in the registry).
 *
 * Without this, `transport.read()` would hang forever on a
 * non-responsive device, and the harness's poll loop guards
 * `inFlight`-style — one hung read silently freezes every subsequent
 * tick. A timeout converts the hang into a transport failure that
 * the poll loop's catch path absorbs (keeping the LAST snapshot).
 *
 * Node's `getStatus()` is currently untimed (see
 * `packages/node/src/printer.ts:294-311`); CLI consumers there
 * surface hangs differently and the maintainer is aware of the
 * discrepancy. Out of scope for this fix.
 */
const STATUS_READ_TIMEOUT_MS = 2000;

/**
 * Read deadline for the 550 print-footer status handshake — the
 * `ESC A` reply the firmware expects the host to drain after every
 * `ESC G` (see `write550Job`). Longer than `STATUS_READ_TIMEOUT_MS`
 * because the firmware may answer only once the label has physically
 * fed; a 300 dpi diagnostic label is a couple of seconds. The deadline
 * still converts a wedged firmware into a thrown `TransportTimeoutError`
 * the harness can surface, instead of an unbounded hang.
 */
const PRINT_HANDSHAKE_TIMEOUT_MS = 15000;

export interface RequestOptions {
  filters?: USBDeviceFilter[];
}

export interface WebLabelWriterPrinterOptions {
  /**
   * The engine this instance is scoped to. Defaults to `device.engines[0]`
   * — back-compat for single-engine LWs (3xx/4xx/5xx) and the Twin Turbo
   * (single shared transport, in-band ESC q routing on the primary).
   *
   * For multi-interface composite devices (Duo family — `label` on IF 0,
   * `tape` on IF 1) callers must construct ONE instance per engine,
   * each with its own `Transport` claimed against the engine's
   * `bind.usb.bInterfaceNumber`. The encoder dispatches by
   * `engine.protocol`, so per-engine `print()` writes the correct
   * protocol bytes (lw-raster vs d1-tape) to the correct endpoint.
   */
  engine?: PrintEngine;
}

/**
 * WebUSB `PrinterAdapter` for Dymo LabelWriter printers.
 *
 * Each instance is scoped to **one** `PrintEngine`. Single-engine
 * devices (most of the LW family) get one instance; multi-interface
 * composite devices (Duo: `label` on IF 0, `tape` on IF 1) get one
 * instance per engine, each holding its own transport. `requestPrinters()`
 * returns a `Record<role, PrinterAdapter>` covering every drivable
 * engine on the picked device.
 *
 * Mirrors the node driver's `pickRotation` wiring: rectangular die-cut
 * media auto-rotates landscape input via the media's
 * `defaultOrientation` hint.
 */
export class WebLabelWriterPrinter implements PrinterAdapter {
  readonly family = 'labelwriter' as const;
  readonly device: DeviceEntry;
  readonly engine: PrintEngine;
  readonly engines: Readonly<Record<string, LabelWriterEngineHandle>>;

  private readonly transport: Transport;
  private lastStatus: PrinterStatus | undefined;
  /**
   * Serialises every transport-touching method (`print`, `getStatus`,
   * `getMedia`, `getEngineVersion`, `acquire550Lock`, `recover`) so a
   * 4 s status poll can't interleave its `write()` into an in-flight
   * `print()`'s raster stream and corrupt the job. `print()` calls the
   * unwrapped `do*` internals so the nested `acquire550Lock` /
   * `getMedia` don't re-enter the lock and deadlock. See
   * `WriteSerializer` in `@thermal-label/contracts`.
   */
  private readonly serializer = new WriteSerializer();
  /**
   * Roll-instance `details[]` rows from the last `ESC U` SKU dump.
   * Replayed onto every subsequent `getStatus()` so the harness
   * diagnostics panel keeps showing the loaded roll's forensics even
   * though the 32-byte `ESC A` frame doesn't carry them. Cleared only
   * by a fresh `getMedia()`.
   */
  private rollDetails: readonly StatusDetail[] = [];

  constructor(
    device: DeviceEntry,
    transport: Transport,
    options: WebLabelWriterPrinterOptions = {},
  ) {
    this.device = device;
    this.transport = transport;
    const engine = options.engine ?? device.engines[0];
    if (!engine) {
      throw new Error(`Device ${device.key} has no engines.`);
    }
    this.engine = engine;
    this.engines = buildEngineHandles(device, engine, this);
  }

  get model(): string {
    return this.device.name;
  }

  get connected(): boolean {
    return this.transport.connected;
  }

  print(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: LabelWriterPrintOptions,
  ): Promise<void> {
    // Whole-method wrap (plan 15 A3). `doPrint` calls the unwrapped
    // `do550Lock` / `doGetMedia` internals so the nested transport
    // operations don't re-acquire this same serializer and deadlock.
    return this.serializer.run(() => this.doPrint(image, media, options));
  }

  private async doPrint(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: LabelWriterPrintOptions,
  ): Promise<void> {
    // Each instance is scoped to a single engine; default the encoder
    // dispatch to that engine when the caller didn't specify one. The
    // shell calls `print(rgba, media, { engine: role })` explicitly,
    // but ad-hoc consumers using the bare adapter shouldn't have to
    // know the role.
    const requestedEngine = options?.engine ?? this.engine.role;
    const effectiveEngine =
      requestedEngine === this.engine.role
        ? this.engine
        : resolveRequestedEngine(this.device, requestedEngine);

    if (effectiveEngine.role !== this.engine.role) {
      throw new Error(
        `WebLabelWriterPrinter for engine "${this.engine.role}" cannot print on engine ` +
          `"${effectiveEngine.role}". Construct a separate instance via requestPrinters() ` +
          `for the other engine.`,
      );
    }

    dbg(
      `print start: device=${this.device.key} engine=${effectiveEngine.role} ` +
        `protocol=${effectiveEngine.protocol} ` +
        `image=${String(image.width)}x${String(image.height)} ` +
        `media=${media ? 'explicit' : this.lastStatus?.detectedMedia ? 'cached' : 'unset'} ` +
        `copies=${String(options?.copies ?? 1)}`,
    );

    // 550 family: acquire the print lock and check printer health
    // before sending the job. See the node driver for the full
    // contract. Released by `ESC Q` in the job trailer.
    if (this.engine.protocol === 'lw5-raster') {
      await this.doAcquire550Lock();
      dbg(
        `550 lock acquired: ready=${String(this.lastStatus?.ready)} ` +
          `errors=${String(this.lastStatus?.errors.length ?? 0)}`,
      );
    }

    let resolvedMedia = (media ?? this.lastStatus?.detectedMedia) as LabelWriterMedia | undefined;

    // 550 status doesn't carry media dimensions — those live in the
    // NFC SKU dump (ESC U). Best-effort fetch when no explicit media
    // was passed and no prior `getMedia()` populated the cache.
    if (!resolvedMedia && this.engine.protocol === 'lw5-raster') {
      try {
        const sku = await this.doGetMedia();
        if (sku) resolvedMedia = skuInfoToMedia(sku);
      } catch {
        // Best-effort — fall through to MediaNotSpecifiedError below.
      }
    }

    if (!resolvedMedia) {
      throw new MediaNotSpecifiedError();
    }
    dbg(`media resolved: ${JSON.stringify(resolvedMedia)}`);
    const rotate = pickRotation(image, resolvedMedia, ROTATE_DIRECTION, options?.rotate);
    const bitmap = renderImage(image, { dither: true, rotate });
    dbg(`rotate=${String(rotate)} bitmap=${String(bitmap.widthPx)}x${String(bitmap.heightPx)}`);
    // Force `engine` to this instance's role so the encoder dispatches
    // on the right protocol (lw-raster / lw5-raster / d1-tape). When
    // the caller authored a short bitmap (printable-canvas-sized — see
    // `getPrintableCanvasDots` in labelwriter-core), auto-supply
    // `labelLengthDots = media.lengthDots` so ESC L still describes the
    // full label feed pitch. Explicit `options.labelLengthDots` always
    // wins; tape media has no fixed lengthDots and falls back to
    // bitmap.heightPx inside the encoder.
    const mediaLengthDots = (resolvedMedia as { lengthDots?: number }).lengthDots;
    const encodeOptions: LabelWriterPrintOptions = { ...options, engine: this.engine.role };
    if (encodeOptions.labelLengthDots === undefined) {
      if (typeof mediaLengthDots === 'number' && mediaLengthDots > bitmap.heightPx) {
        encodeOptions.labelLengthDots = mediaLengthDots;
      }
    }

    // 550 dispatch — see `write550Job`. Web supplies a finite read
    // deadline; WebUSB has no implicit timeout.
    if (this.engine.protocol === 'lw5-raster') {
      const job = compose550Job(this.device, bitmap, encodeOptions, resolvedMedia);
      dbg(
        `composed 550 job: preamble=${String(job.preamble.length)}B ` +
          `labels=${String(job.labels.length)} finalize=${String(job.finalize.length)}B`,
      );
      await write550Job(this.transport, job, {
        handshakeReadTimeoutMs: PRINT_HANDSHAKE_TIMEOUT_MS,
      });
      return;
    }

    // Duo tape engine: dispatch through the async encoder that
    // lazy-loads d1-core. lw-raster (450 family) stays on the sync path.
    const bytes = isDuoTapeEngine(this.engine)
      ? await encodeDuoTapeLabel(this.device, bitmap, encodeOptions, resolvedMedia)
      : encodeLabel(this.device, bitmap, encodeOptions, resolvedMedia);
    dbg(`encoded ${String(bytes.length)} bytes — writing to transport`);
    await this.transport.write(bytes);
    dbg(`print complete: ${String(bytes.length)} bytes written`);
  }

  /**
   * Acquire the 550 print lock + health check. Private — only called
   * from within `doPrint()`, which already holds the serializer, so
   * this stays unwrapped to avoid a self-deadlock on the lock.
   */
  private async doAcquire550Lock(): Promise<void> {
    await this.transport.write(build550StatusRequest(1));
    const bytes = await this.transport.read(STATUS_BYTE_COUNT_550, STATUS_READ_TIMEOUT_MS);
    const status = withRollDetails(parseStatus(this.device, bytes), this.rollDetails);
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
  getMedia(): Promise<SkuInfo | undefined> {
    // Serialised — `getMedia()` writes ESC U and reads. `doPrint()`
    // calls the unwrapped `doGetMedia` so it doesn't re-enter the lock.
    return this.serializer.run(() => this.doGetMedia());
  }

  private async doGetMedia(): Promise<SkuInfo | undefined> {
    if (this.engine.protocol !== 'lw5-raster') {
      throw new UnsupportedOperationError(
        `getMedia on ${this.device.key}`,
        `ESC U (Get SKU Information) is only supported on lw5-raster devices.`,
      );
    }
    await this.transport.write(build550GetSku());
    const bytes = await this.transport.read(SKU_INFO_BYTE_COUNT, STATUS_READ_TIMEOUT_MS);
    if (bytes.length < SKU_INFO_BYTE_COUNT) return undefined;
    try {
      const sku = parseSkuInfo(bytes);
      if (sku.magic !== 0xcab6) return undefined;
      const detected = skuInfoToMedia(sku);
      const base = this.lastStatus ?? {
        ready: true,
        mediaLoaded: true,
        errors: [],
        rawBytes: new Uint8Array(0),
      };
      // Merge the roll-instance ESC U detail rows ahead of the cached
      // ESC A status rows, dropping any stale roll rows from a prior
      // fetch so a re-`getMedia()` doesn't double them up. Subsequent
      // `getStatus()` polls overwrite `details` from the fresh ESC A
      // frame; `getStatus()` re-merges these via `rollDetails`.
      const rollDetails = skuInfoDetails(sku);
      this.rollDetails = rollDetails;
      this.lastStatus = {
        ...base,
        detectedMedia: detected,
        details: [...rollDetails, ...stripRollDetails(base.details)],
      };
      return sku;
    } catch {
      return undefined;
    }
  }

  /**
   * Fetch the print engine's HW/FW/PID identity block (`ESC V`,
   * 550 only). Mirror of the node driver's `getEngineVersion()`.
   *
   * Named `getEngineVersion` for parity with the node driver
   * (`@thermal-label/labelwriter-node`); the harness adapter reads it
   * under that name. 550-only — throws `UnsupportedOperationError` on
   * every other engine, same shape as `getMedia()`.
   */
  getEngineVersion(): Promise<EngineVersion | undefined> {
    // Serialised — `getEngineVersion()` writes ESC V and reads.
    return this.serializer.run(() => this.doGetEngineVersion());
  }

  private async doGetEngineVersion(): Promise<EngineVersion | undefined> {
    if (this.engine.protocol !== 'lw5-raster') {
      throw new UnsupportedOperationError(
        `getEngineVersion on ${this.device.key}`,
        `ESC V (Get Print Engine Version) is only supported on lw5-raster devices.`,
      );
    }
    await this.transport.write(build550GetVersion());
    const bytes = await this.transport.read(ENGINE_VERSION_BYTE_COUNT, STATUS_READ_TIMEOUT_MS);
    if (bytes.length < ENGINE_VERSION_BYTE_COUNT) return undefined;
    try {
      return parseEngineVersion(bytes);
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

  /**
   * Status read for this instance's scoped engine. Dispatches by
   * `engine.protocol`:
   *
   * - `d1-tape` (Duo tape side) — `SYN` request, 1-byte reply parsed
   *   via `@thermal-label/d1-core`.
   * - `lw-raster` / `lw5-raster` — `ESC A`-shaped request, multi-byte reply
   *   parsed via labelwriter-core.
   *
   * Pre-refactor this was hardcoded to `device.engines[0].protocol`,
   * which on the Duo always meant `lw-raster` and silently corrupted the
   * tape engine's status byte stream. The per-engine instance now
   * routes by its own engine.
   */
  getStatus(): Promise<PrinterStatus> {
    // Serialised against `print()` — `getStatus()` writes a status
    // request and reads, and must not land mid-raster-stream.
    return this.serializer.run(() => this.doGetStatus());
  }

  private async doGetStatus(): Promise<PrinterStatus> {
    if (isDuoTapeEngine(this.engine)) {
      // Lazy-load d1-core: only consumers actually driving the Duo
      // tape engine pull it into their bundle. Throws
      // DuoTapeUnavailableError when the optional peer is missing.
      const request = await duoTapeStatusRequest();
      await this.transport.write(request);
      const bytes = await this.transport.read(D1_STATUS_BYTE_COUNT, STATUS_READ_TIMEOUT_MS);
      const status = await parseDuoTapeStatus(bytes);
      this.lastStatus = status;
      return status;
    }
    await this.transport.write(buildStatusRequest(this.device));
    // The Chromium bulk-IN sub-packet stall is handled in
    // `WebUsbTransport.read()`, which rounds the transfer up to the
    // endpoint's `wMaxPacketSize`; the driver just asks for the bytes it
    // needs. The timeout converts a non-responsive device into a thrown
    // failure the poll loop can absorb.
    const bytes = await this.transport.read(statusByteCount(this.device), STATUS_READ_TIMEOUT_MS);
    // eslint-disable-next-line no-console
    console.debug(
      `[lw-web] getStatus read role=${this.engine.role} len=${bytes.length.toString()}`,
    );
    const status = withRollDetails(parseStatus(this.device, bytes), this.rollDetails);
    if (this.lastStatus?.detectedMedia && !status.detectedMedia) {
      this.lastStatus = { ...status, detectedMedia: this.lastStatus.detectedMedia };
    } else {
      this.lastStatus = status;
    }
    return this.lastStatus;
  }

  /**
   * Subscribe to status updates. LabelWriter firmware (across the
   * 3xx/4xx/5xx and Duo families) doesn't push unsolicited status
   * frames; this is a polling shim built on `pollingOnStatus` from
   * contracts, which calls `getStatus()` on first subscribe and then
   * every 4 s.
   *
   * Per plan 11 §`onStatus` parity — every driver-web printer
   * implements `onStatus` so the harness shell can collapse its
   * push-vs-pull branch in `createStatusPolling.ts` into a single
   * subscription path. On the LW Duo each engine instance gets its
   * own poll loop (the harness creates one subscription per role).
   */
  onStatus(cb: (status: PrinterStatus) => void): () => void {
    return pollingOnStatus(this, cb);
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
   *
   * D1 tape engines have no protocol-level recovery sequence — calling
   * recover on a tape-scoped instance is a no-op.
   */
  recover(): Promise<void> {
    // Serialised — `recover()` writes a recovery sequence and reads.
    return this.serializer.run(() => this.doRecover());
  }

  private async doRecover(): Promise<void> {
    if (isDuoTapeEngine(this.engine)) {
      // No documented recovery sequence for d1-tape; the Duo's tape
      // side resets via mechanical cassette removal/reinsert.
      return;
    }
    if (this.engine.protocol === 'lw5-raster') {
      await this.transport.write(build550Recovery());
    } else {
      await this.transport.write(buildErrorRecovery());
    }
    await this.transport.read(statusByteCount(this.device));
  }
}

/**
 * Drop any roll-instance `details[]` rows (those emitted by
 * `skuInfoDetails` — labelled `"Roll …"`) from a status detail list.
 * Used to avoid doubling roll rows when re-merging an `ESC U` dump
 * onto a status that may already carry stale ones.
 */
function stripRollDetails(details: readonly StatusDetail[] | undefined): readonly StatusDetail[] {
  if (!details) return [];
  return details.filter(d => !d.label.startsWith('Roll '));
}

/**
 * Merge the cached roll-instance `details[]` (from the last `ESC U`)
 * ahead of a freshly-parsed `ESC A` status's own `details[]`. The
 * 32-byte status frame never carries roll forensics; this replays them
 * so each poll keeps showing the loaded roll.
 */
function withRollDetails(
  status: PrinterStatus,
  rollDetails: readonly StatusDetail[],
): PrinterStatus {
  if (rollDetails.length === 0) return status;
  return {
    ...status,
    details: [...rollDetails, ...stripRollDetails(status.details)],
  };
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
  scopedEngine: PrintEngine,
  parent: LabelWriterPrintParent,
): Readonly<Record<string, LabelWriterEngineHandle>> {
  // Per-engine instance: expose ONLY the scoped engine in the handles
  // map. Pre-refactor this enumerated every drivable engine on the
  // device, but a per-engine instance can only reach its own — the
  // others live behind sibling instances returned by `requestPrinters()`.
  const handles: Record<string, LabelWriterEngineHandle> = {};
  if (!isEngineDrivable(scopedEngine)) return handles;
  const role = scopedEngine.role;
  handles[role] = {
    role,
    engine: scopedEngine,
    print(
      image: RawImageData,
      media?: MediaDescriptor,
      options?: Omit<LabelWriterPrintOptions, 'engine'>,
    ): Promise<void> {
      return parent.print(image, media, { ...options, engine: role });
    },
  };
  // Reference `device` to silence unused-arg lints; kept in the
  // signature so future per-handle context (e.g. cross-engine callbacks)
  // doesn't need a refactor.
  void device;
  return handles;
}

function resolveRequestedEngine(device: DeviceEntry, requested: string): PrintEngine {
  const found = device.engines.find(e => e.role === requested);
  if (!found) {
    const roles = device.engines.map(e => e.role).join(', ');
    throw new Error(
      `Device ${device.key} has no engine with role "${requested}". Available: ${roles}.`,
    );
  }
  return found;
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
 * Requires a user gesture. Returns the **primary** engine adapter — for
 * single-engine devices that's the only adapter; for the Duo it's the
 * label engine (the `lw-*` one).
 *
 * @deprecated Use `requestPrinters({ transport: 'usb' })` from
 *   `./request-printers.ts` — the generic factory returns the full
 *   per-engine `PrinterAdapterMap`. Removed once consumers migrate
 *   (plan 11).
 */
export async function requestPrinter(options: RequestOptions = {}): Promise<WebLabelWriterPrinter> {
  const filters = options.filters ?? DEFAULT_FILTERS;
  const usbDevice = await navigator.usb.requestDevice({ filters });
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy alias chain
  return fromUSBDevice(usbDevice);
}

/**
 * Show the browser's USB picker and return one `PrinterAdapter` per
 * drivable engine on the selected device, keyed by engine role.
 *
 * - Single-engine devices (3xx/4xx/5xx, Twin Turbo) → 1-key record.
 * - Multi-interface composites (Duo family — `label` on IF 0, `tape`
 *   on IF 1) → N-key record, one transport per engine, one adapter
 *   per transport.
 *
 * Each adapter is fully scoped to its engine: `print()` defaults
 * `options.engine` to that role; `getStatus()` uses that engine's
 * protocol; `close()` closes that engine's transport. The harness shell
 * stores the whole record and rebinds the active adapter when the
 * operator flips engine tabs.
 *
 * Engines that fail to claim (browser refused the interface, IF
 * already held by another driver) are omitted from the returned
 * record. Callers should check `Object.keys(printers)` against the
 * device's engine list to surface partial-claim warnings —
 * "rails not walls": the operator can still drive whichever engines
 * did open.
 */
/**
 * @deprecated Use the generic `requestPrinters({ transport: 'usb' })`
 *   from `./request-printers.ts`; the legacy USB-only `requestPrinters`
 *   is preserved as `requestPrintersUsbLegacy` for back-compat. Removed
 *   once consumers migrate (plan 11).
 */
export async function requestPrintersUsbLegacy(
  options: RequestOptions = {},
): Promise<Record<string, WebLabelWriterPrinter>> {
  const filters = options.filters ?? DEFAULT_FILTERS;
  const usbDevice = await navigator.usb.requestDevice({ filters });
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy alias chain
  return fromUSBDeviceAll(usbDevice);
}

/**
 * Wrap an already-selected `USBDevice` (e.g. from
 * `navigator.usb.getDevices()`) and return the **primary** engine's
 * adapter. The primary is the first `lw-*` engine on the device, or
 * the first drivable engine if none speak `lw-*`.
 *
 * @throws when the VID/PID is not in the LabelWriter registry.
 *
 * @deprecated Use `requestPrinters({ transport: 'usb' })` from
 *   `./request-printers.ts`. Removed once consumers migrate (plan 11).
 */
export async function fromUSBDevice(usbDevice: USBDevice): Promise<WebLabelWriterPrinter> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy alias chain
  const all = await fromUSBDeviceAll(usbDevice);
  // Prefer the lw-* primary so existing single-printer callers (tests,
  // ad-hoc consumers) keep getting a label-class adapter on the Duo.
  const entries = Object.entries(all);
  const labelClassEntry = entries.find(([, p]) => p.engine.protocol !== 'd1-tape');
  const pickedEntry = labelClassEntry ?? entries[0];
  if (!pickedEntry) {
    throw new Error(
      `Device ${usbDevice.vendorId.toString(16)}:${usbDevice.productId.toString(16)} ` +
        `had no drivable engines.`,
    );
  }
  const [pickedRole, picked] = pickedEntry;
  // Close the unselected engines so we don't leak transports — the
  // back-compat caller asked for one adapter, not the whole record.
  for (const [role, printer] of entries) {
    if (role === pickedRole) continue;
    try {
      await printer.close();
    } catch {
      // Best-effort.
    }
  }
  return picked;
}

/**
 * Wrap an already-selected `USBDevice` and return one adapter per
 * drivable engine. Public surface for `requestPrinters()`; exported so
 * harnesses that already hold a `USBDevice` (e.g. picked-up via
 * `navigator.usb.getDevices()` on a returning visit) can skip the
 * picker.
 *
 * @deprecated Use `requestPrinters({ transport: 'usb' })` from
 *   `./request-printers.ts`. Removed once consumers migrate (plan 11).
 */
export async function fromUSBDeviceAll(
  usbDevice: USBDevice,
): Promise<Record<string, WebLabelWriterPrinter>> {
  const descriptor = findDevice(usbDevice.vendorId, usbDevice.productId);
  if (!descriptor) {
    throw new Error(
      `Unsupported USB device: VID=0x${usbDevice.vendorId.toString(16)} PID=0x${usbDevice.productId.toString(16)}`,
    );
  }

  const out: Record<string, WebLabelWriterPrinter> = {};

  // Determine which interface(s) to open. Multi-interface composites
  // (Duo family) declare distinct `bind.usb.bInterfaceNumber` per
  // engine — open one transport per engine. Single-interface devices
  // (everything else) open IF 0 once and share it across every drivable
  // engine on the device (Twin Turbo: `left` + `right` both ride the
  // single `lw-raster` endpoint, in-band ESC q routes the firmware).
  const interfaces = collectEngineInterfaces(descriptor);
  if (interfaces.size > 1) {
    // Per-engine transports. Each WebLabelWriterPrinter holds its own.
    const failures: string[] = [];
    for (const engine of descriptor.engines) {
      if (!isEngineDrivable(engine)) continue;
      const ifn = engine.bind?.usb?.bInterfaceNumber;
      if (ifn === undefined) continue;
      try {
        const transport = await WebUsbTransport.fromDevice(usbDevice, { interfaceNumber: ifn });
        out[engine.role] = new WebLabelWriterPrinter(descriptor, transport, { engine });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        failures.push(`engine "${engine.role}" (IF ${String(ifn)}): ${detail}`);
      }
    }
    if (Object.keys(out).length === 0) {
      throw new Error(
        `${descriptor.name}: could not open any USB interfaces (${failures.join('; ')}).`,
      );
    }
    if (failures.length > 0) {
      // Partial claim — at least one engine opened but others failed.
      // Surface so the harness / smoke-tester sees which engine is
      // missing instead of silently degrading to a one-engine map.
      // eslint-disable-next-line no-console
      console.warn(
        `[labelwriter-web] ${descriptor.name}: partial-claim — opened [${Object.keys(out).join(', ')}], ` +
          `failed ${failures.join('; ')}.`,
      );
    }
    return out;
  }

  // Single-interface — open IF 0 (or the first engine's bind) and
  // share across every drivable engine. Each engine still gets its own
  // adapter instance so the encoder dispatch + status routing is
  // engine-scoped, but the transport object itself is shared.
  const firstBind = descriptor.engines.find(e => e.bind?.usb?.bInterfaceNumber !== undefined)?.bind
    ?.usb?.bInterfaceNumber;
  const transport =
    firstBind !== undefined
      ? await WebUsbTransport.fromDevice(usbDevice, { interfaceNumber: firstBind })
      : await WebUsbTransport.fromDevice(usbDevice);

  for (const engine of descriptor.engines) {
    if (!isEngineDrivable(engine)) continue;
    out[engine.role] = new WebLabelWriterPrinter(descriptor, transport, { engine });
  }
  return out;
}

/**
 * Build the set of distinct USB interface numbers declared across a
 * device's engines. >1 means we need per-engine transports.
 */
function collectEngineInterfaces(device: DeviceEntry): Set<number> {
  const set = new Set<number>();
  for (const engine of device.engines) {
    const ifn = engine.bind?.usb?.bInterfaceNumber;
    if (ifn !== undefined) set.add(ifn);
  }
  return set;
}
