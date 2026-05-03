export type { LabelBitmap, PaletteEntry, RawImageData } from '@mbtech-nl/bitmap';
export { renderText, renderImage, rotateBitmap, padBitmap, scaleBitmap } from '@mbtech-nl/bitmap';

export type {
  DeviceEntry,
  DeviceRegistry,
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
 * Note: the LabelWriter Duo's tape engine uses `d1-tape`, which is
 * encoded by `@thermal-label/labelmanager-core`, not here.
 */
export const PROTOCOLS: ReadonlySet<string> = new Set(['lw-450', 'lw-550']);
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
  encodeLabel,
  ROLL_BYTE_AUTO,
} from './protocol.js';
export { STATUS_REQUEST, buildStatusRequest, parseStatus, statusByteCount } from './status.js';
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

export { isEngineDrivable } from './protocol.js';

export {
  buildDuoReset,
  buildDuoSetTapeType,
  buildDuoBytesPerLine,
  buildDuoCutTape,
  buildDuoStatusRequest,
  buildDuoRasterRow,
  encodeDuoTapeLabel,
  isDuoTapeEngine,
} from './duo-tape.js';
export type { DuoTapePrintOptions } from './duo-tape.js';
export { DUO_TAPE_STATUS_BYTE_COUNT, parseDuoTapeStatus } from './duo-tape-status.js';
export {
  D1_TAPE_COLOR_HEX,
  allTapeMedia,
  findTapeMediaByWidth,
  findTapeMediaByWidthAll,
  tapeColourFor,
} from './duo-tape-media.js';
