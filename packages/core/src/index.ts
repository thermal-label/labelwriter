export type { LabelBitmap, PaletteEntry, RawImageData } from '@mbtech-nl/bitmap';
export { renderText, renderImage, rotateBitmap, padBitmap, scaleBitmap } from '@mbtech-nl/bitmap';

export type {
  DeviceDescriptor,
  MediaDescriptor,
  PreviewOptions,
  PreviewPlane,
  PreviewResult,
  PrintOptions,
  PrinterAdapter,
  PrinterError,
  PrinterStatus,
  RotateDirection,
  Transport,
  TransportType,
} from '@thermal-label/contracts';

export { MediaNotSpecifiedError, pickRotation } from '@thermal-label/contracts';

export { DEVICES, findDevice } from './devices.js';
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
  buildStatusRequest,
  buildErrorRecovery,
  buildRasterRow,
  encodeLabel,
} from './protocol.js';
export { STATUS_REQUEST, parseStatus, statusByteCount } from './status.js';
export { createPreviewOffline } from './preview.js';
export type {
  Density,
  LabelWriterDevice,
  LabelWriterMedia,
  LabelWriterPrintOptions,
  NetworkSupport,
} from './types.js';
