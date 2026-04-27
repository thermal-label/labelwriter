import type { DeviceDescriptor, MediaDescriptor, PrintOptions } from '@thermal-label/contracts';

export type NetworkSupport = 'none' | 'wifi' | 'wired';
export type Density = 'light' | 'medium' | 'normal' | 'high';

/**
 * Dymo LabelWriter device descriptor.
 *
 * Extends the contracts base with LabelWriter-specific fields: head
 * geometry, protocol generation (`'450'` legacy ESC raster, `'550'`
 * job-header raster), network capability, and NFC roll authentication.
 */
export interface LabelWriterDevice extends DeviceDescriptor {
  family: 'labelwriter';
  vid: number;
  pid: number;
  headDots: number;
  bytesPerRow: number;
  protocol: '450' | '550';
  network: NetworkSupport;
  nfcLock: boolean;
}

/**
 * Dymo LabelWriter media descriptor.
 *
 * Extends `MediaDescriptor` with the length in printer dots. Die-cut
 * media carries a fixed `heightMm`; continuous media leaves it
 * undefined. All LabelWriter media is single-ink (the base `palette`
 * field stays undefined).
 */
export interface LabelWriterMedia extends MediaDescriptor {
  type: 'die-cut' | 'continuous';
  /** Length in 300-dpi dots — used by the 550 to match status responses. */
  lengthDots?: number;
}

/**
 * Protocol-internal print options.
 *
 * Extends the cross-driver `PrintOptions` with the LabelWriter-specific
 * `density` narrowed to the values the firmware recognises, the
 * text/graphics mode byte, RLE compression toggle, roll selector (Twin
 * Turbo / 450 Duo), and the optional 550-series job ID. `rotate`
 * overrides the orientation heuristic — `'auto'` (default) defers to
 * the media's `defaultOrientation`; an explicit angle bypasses it.
 */
export interface LabelWriterPrintOptions extends PrintOptions {
  density?: Density;
  mode?: 'text' | 'graphics';
  compress?: boolean;
  roll?: 0 | 1;
  jobId?: number;
  rotate?: 'auto' | 0 | 90 | 180 | 270;
}
