import type {
  DeviceEntry,
  MediaDescriptor,
  PrintEngine,
  PrinterStatus,
  PrintOptions,
} from '@thermal-label/contracts';
import type { D1Media } from '@thermal-label/d1-core';
import type { RawImageData } from '@mbtech-nl/bitmap';

export type Density = 'light' | 'medium' | 'normal' | 'high';

/**
 * Dymo LabelWriter device descriptor.
 *
 * Alias of the cross-driver `DeviceEntry` shape; LabelWriter entries
 * declare `family: 'labelwriter'` and use protocol tags `'lw-450'`,
 * `'lw-550'`, or `'d1-tape'` (Duo tape engine) on each `engines[]`
 * element.
 */
export type LabelWriterDevice = DeviceEntry;

/**
 * Engine-level capability flags specific to the LabelWriter driver.
 *
 * Lives on `engine.capabilities` via the contracts open index signature.
 * Promote a key to `PrintEngineCapabilities` in the contracts package
 * once a second active driver implements compatible semantics.
 */
export interface LabelWriterEngineCapabilities {
  /**
   * NFC-locked roll authentication: device refuses non-genuine rolls
   * and silently overrides label-length on genuine rolls. Today only
   * the LabelWriter 5xx family. See `hardwareQuirks` for the
   * mismatch-behaviour caveat.
   */
  genuineMediaRequired?: boolean;
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

/** D1 tape widths the LabelWriter Duo supports (PDF Appendix B p.23). */
export type DuoTapeWidth = 6 | 9 | 12 | 19 | 24;

/**
 * Symbolic colour names for D1 cartridges. Drives docs / preview
 * rendering via `D1_TAPE_COLOR_HEX`. Wire-format colour selection
 * remains the numeric `tapeColour` (ESC C selector).
 */
export type D1TapeColor =
  | 'white'
  | 'clear'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'red'
  | 'black'
  | 'orange'
  | 'brown'
  | 'grey'
  | 'metallic'
  | 'purple';

/**
 * D1 cartridge material families. Mirrors d1-core's `D1Material`; the
 * `rhino-*` entries cover DYMO's industrial Rhino™ line, which uses
 * cartridges that are mechanically the same as D1 and physically fit
 * Duo / LabelManager chassis.
 */
export type D1Material =
  | 'standard'
  | 'permanent-polyester'
  | 'flexible-nylon'
  | 'durable'
  | 'rhino-vinyl'
  | 'rhino-permanent-polyester'
  | 'rhino-flexible-nylon'
  | 'rhino-heat-shrink'
  | 'rhino-non-adhesive-tag'
  | 'rhino-self-laminating';

/**
 * Duo tape-cassette media descriptor.
 *
 * Extends `D1Media` from `@thermal-label/d1-core` (the shared D1 tape
 * shape) with LabelWriter-specific narrowing: `type` fixed to `'tape'`,
 * `tapeWidthMm` narrowed to the supported widths, `text` / `background`
 * narrowed to `D1TapeColor`, plus the catalogue's pre-computed
 * `tapeColour` (ESC C selector) and `material` family for picker UX.
 *
 * Routed by the `encodeLabel` dispatcher to `@thermal-label/d1-core`'s
 * `buildPrinterStream` — same encoder the LabelManager driver uses.
 */
export interface LabelWriterTapeMedia extends D1Media {
  type: 'tape';
  tapeWidthMm: DuoTapeWidth;
  /** Pre-computed ESC C selector 0..12; mirrors `tapeTypeFor(media)`. */
  tapeColour?: number;
  /** Cartridge material family — drives docs grouping + UI. */
  material?: D1Material;
  /** Background colour of the tape — drives preview rendering. */
  background?: D1TapeColor;
  /** Print colour. */
  text?: D1TapeColor;
}

/**
 * Any LabelWriter-family media. The label engines accept
 * `LabelWriterMedia`; the Duo tape engine accepts `LabelWriterTapeMedia`.
 */
export type LabelWriterAnyMedia = LabelWriterMedia | LabelWriterTapeMedia;

/**
 * Protocol-internal print options.
 *
 * Extends the cross-driver `PrintOptions` with the LabelWriter-specific
 * `density` narrowed to the values the firmware recognises, the
 * text/graphics mode byte, RLE compression toggle, engine selector
 * (Twin Turbo / 450 Duo), and the optional 550-series job ID.
 *
 * `engine` selects which `PrintEngine` on a multi-engine device handles
 * the job. Dymo labels the Twin Turbo's two rolls "left" and "right"
 * on the chassis; pass `'left'` or `'right'` to route there explicitly.
 * Pass `'auto'` (or omit on a Twin Turbo) to let the firmware pick an
 * available roll — emitted as `ESC q 0x30` per LW 450 Series Tech Ref
 * p.16. Single-engine devices ignore this option.
 *
 * `rotate` overrides the orientation heuristic — `'auto'` (default)
 * defers to the media's `defaultOrientation`; an explicit angle
 * bypasses it.
 */
export interface LabelWriterPrintOptions extends PrintOptions {
  density?: Density;
  mode?: 'text' | 'graphics';
  compress?: boolean;
  /**
   * 550-only print speed. `'normal'` (the firmware default) prints
   * with the standard duty cycle; `'high'` engages the high-speed
   * path documented on LW 550 / 550 Turbo (not on 5XL — which simply
   * ignores the byte). Per spec, not all label rolls have the
   * high-speed feature; on rolls that don't, the printer falls back
   * to normal speed silently.
   *
   * Omitted → encoder doesn't emit `ESC T` and the firmware default
   * (Normal Speed) is used.
   */
  speed?: 'normal' | 'high';
  /**
   * Engine selector for multi-engine devices. `'auto'` is the special
   * routing mode (firmware-auto byte on Twin Turbo); any other string
   * is matched against `engines[].role`. Single-engine devices ignore
   * this. See `LabelWriterPrintOptions` JSDoc above for the full shape.
   */
  engine?: string;
  jobId?: number;
  rotate?: 'auto' | 0 | 90 | 180 | 270;
  /**
   * Override the label feed length used by `ESC L`. When the caller
   * pre-strips dead-zone rows from the bitmap (so `bitmap.heightPx`
   * is shorter than the actual label pitch), the printer still needs
   * the actual pitch for form-feed / cut sequencing — otherwise the
   * cut lands inside the printed region and the offset compounds
   * across consecutive prints. Pass the original authored bitmap
   * height (= `media.lengthDots`) here when stripping rows; omit when
   * the encoder is doing the strip itself.
   */
  labelLengthDots?: number;
}

/**
 * Adapter-side handle for a single `PrintEngine` on a multi-engine
 * device.
 *
 * `print()` pre-binds `options.engine` to this engine's role and
 * forwards to the parent adapter's `print()`. Use it to route a job
 * explicitly: `printer.engines.left.print(image, media)`.
 *
 * `getStatus()` queries the engine over its own transport — relevant
 * on the Duo, where the tape engine sits on its own USB interface and
 * speaks D1 (1-byte status reply via `@thermal-label/d1-core`) while
 * the label engine speaks lw-450 (1-byte) or lw-550 (32-byte).
 *
 * Adapters expose engines whose protocol the encoder dispatch handles
 * (`lw-450` / `lw-550` natively; `d1-tape` via d1-core). Tape engines
 * only appear when a tape transport is provided to the adapter —
 * without one, the engine is declared in the registry but unreachable.
 */
export interface LabelWriterEngineHandle {
  readonly role: string;
  readonly engine: PrintEngine;
  print(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: Omit<LabelWriterPrintOptions, 'engine'>,
  ): Promise<void>;
  /** Query just this engine's status — useful on multi-engine devices. */
  getStatus?(): Promise<PrinterStatus>;
}
