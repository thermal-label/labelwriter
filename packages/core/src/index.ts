export type { LabelBitmap, PaletteEntry, RawImageData } from '@mbtech-nl/bitmap';
export { renderText, renderImage, rotateBitmap, padBitmap, scaleBitmap } from '@mbtech-nl/bitmap';

export type {
  DeviceEntry,
  DeviceRegistry,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- retained for consumers during alias transition; remove with DeviceSupport cleanup PR
  DeviceSupport,
  MediaDescriptor,
  PreviewOptions,
  PreviewPlane,
  PreviewResult,
  PrintEngine,
  PrintOptions,
  PrinterAdapter,
  PrinterError,
  PrinterStatus,
  StatusDetail,
  RotateDirection,
  Transport,
  TransportType,
} from '@thermal-label/contracts';

export {
  MediaNotSpecifiedError,
  UnsupportedOperationError,
  pickRotation,
} from '@thermal-label/contracts';

export { DEVICES, REGISTRY_LW, findDevice } from './devices.js';

/**
 * Protocols this core's encoder produces correct wire bytes for.
 * Pair with `REGISTRY_LW` and pass to `resolveSupportedDevices` from
 * `@thermal-label/contracts` to filter a device list down to what
 * this runtime can actually drive.
 *
 * `d1-tape` (Duo tape side) is dispatched through
 * `@thermal-label/d1-core`'s `buildPrinterStream`; the entry here
 * keeps device-list filters simple — a Duo is fully drivable from
 * this driver alone.
 */
export const PROTOCOLS: ReadonlySet<string> = new Set(['lw-raster', 'lw5-raster', 'd1-tape']);
export { DEFAULT_MEDIA, MEDIA, findMediaByDimensions } from './media.js';
export { ROTATE_DIRECTION } from './orientation.js';
export {
  buildReset,
  buildSetBytesPerLine,
  buildSetLabelLength,
  buildDensity,
  buildMode,
  buildFormFeed,
  buildShortFormFeed,
  buildSelectRoll,
  buildJobHeader,
  buildErrorRecovery,
  buildRasterRow,
  encodeDuoTapeLabel,
  encodeLabel,
  ROLL_BYTE_AUTO,
} from './protocol.js';
export { STATUS_REQUEST, buildStatusRequest, parseStatus, statusByteCount } from './status.js';
// Duo tape-side helpers are reached through the lazy bridge — see
// `duo-tape-bridge.ts`. `@thermal-label/d1-core` is an OPTIONAL peer
// dependency of this package; consumers that only drive the LW raster
// engines don't need it installed. The Duo tape code path imports
// d1-core dynamically through `loadD1Core()` and throws
// `DuoTapeUnavailableError` when it's missing.
export {
  DuoTapeUnavailableError,
  buildDuoTapeStream,
  duoTapeStatusRequest,
  loadD1Core,
  parseDuoTapeStatus,
} from './duo-tape-bridge.js';
export {
  build550JobHeader,
  build550Mode,
  build550Density,
  build550ResetDensity,
  build550ContentType,
  build550LabelIndex,
  build550LabelHeader,
  build550ShortFormFeed,
  build550FormFeed,
  build550EndJob,
  build550StatusRequest,
  build550GetSku,
  build550GetVersion,
  build550Restart,
  build550Recovery,
  build550FactoryReset,
  build550SetLabelCount,
  PRINT_STATUS_LOCK_NOT_GRANTED,
  density550Percent,
  encode550Label,
  parseEngineVersion,
  parseSkuInfo,
  skuInfoToMedia,
  skuInfoDetails,
  withDetectedMedia,
  ENGINE_VERSION_BYTE_COUNT,
  SKU_INFO_BYTE_COUNT,
  STATUS_BYTE_COUNT_550,
} from './protocol-550.js';
export type { EngineVersion, SkuInfo } from './protocol-550.js';
export { createPreviewOffline } from './preview.js';
export type {
  D1Material,
  D1TapeColor,
  Density,
  DuoTapeWidth,
  LabelWriterAnyMedia,
  LabelWriterDevice,
  LabelWriterEngineCapabilities,
  LabelWriterEngineHandle,
  LabelWriterMedia,
  LabelWriterPrintOptions,
  LabelWriterTapeMedia,
} from './types.js';

export { isEngineDrivable, isDuoTapeEngine } from './protocol.js';

export {
  D1_TAPE_COLOR_HEX,
  allTapeMedia,
  findTapeMediaByWidth,
  findTapeMediaByWidthAll,
} from './duo-tape-media.js';
