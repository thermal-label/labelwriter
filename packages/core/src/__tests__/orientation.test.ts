import { describe, expect, it } from 'vitest';
import { ROTATE_DIRECTION } from '../orientation.js';

describe('ROTATE_DIRECTION', () => {
  it('rotates landscape input clockwise (90°) for the LabelWriter print head', () => {
    // `90` = clockwise. Tentative bench value — confirm with a die-cut
    // "F" landscape print on an 89×28 mm address label; flip to 270 if
    // it reads upside-down or mirrored. Either way the constant must be
    // a valid RotateDirection (90 | 270) the encoder can act on.
    expect([90, 270]).toContain(ROTATE_DIRECTION);
    expect(ROTATE_DIRECTION).toBe(90);
  });
});
