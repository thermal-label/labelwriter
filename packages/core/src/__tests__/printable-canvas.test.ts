import { describe, expect, it } from 'vitest';
import type { PrintEngine } from '@thermal-label/contracts';
import { getPrintableCanvasDots } from '../printable-canvas.js';
import { DEVICES } from '../devices.js';

describe('getPrintableCanvasDots', () => {
  it('absent printableArea reports headDots width and zero deductions', () => {
    // Strip `printableArea` from a real engine — `getPrintableArea`
    // falls back to ZERO_PRINTABLE_AREA when the field is missing.
    const base = DEVICES.LW_450.engines[0]!;
    const engine: PrintEngine = { ...base };
    delete (engine as { printableArea?: unknown }).printableArea;
    const dots = getPrintableCanvasDots(engine);
    expect(dots).toEqual({
      widthDots: engine.headDots,
      leadingDots: 0,
      trailingDots: 0,
      leftDots: 0,
      rightDots: 0,
    });
  });

  it('rounds mm→dots once and matches the encoder-era mmToDots formula', () => {
    // Every LW 3xx/4xx/5xx ships `printableArea.leading = 6 mm`.
    // 300 dpi → Math.round(6 * 300 / 25.4) = 71 dots.
    const engine = DEVICES.LW_450.engines[0]!;
    const dots = getPrintableCanvasDots(engine);
    expect(dots.leadingDots).toBe(71);
    expect(dots.widthDots).toBe(engine.headDots);
    expect(dots.trailingDots).toBe(0);
  });

  it('synthesised non-zero edges round independently', () => {
    // Build a synthetic engine with every edge populated to confirm
    // the helper threads each value through mmToDots independently.
    const base = DEVICES.LW_330_TURBO.engines[0]!;
    const dpi = base.dpi; // 300
    // Choose mm values that back-solve to whole dot counts.
    const synth: PrintEngine = {
      ...base,
      printableArea: {
        leading: (70 * 25.4) / dpi,
        trailing: (18 * 25.4) / dpi,
        left: (18 * 25.4) / dpi,
        right: (4 * 25.4) / dpi,
      },
    };
    const dots = getPrintableCanvasDots(synth);
    expect(dots).toEqual({
      widthDots: base.headDots - 18 - 4,
      leadingDots: 70,
      trailingDots: 18,
      leftDots: 18,
      rightDots: 4,
    });
  });
});
