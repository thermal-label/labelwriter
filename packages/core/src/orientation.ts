import type { RotateDirection } from '@thermal-label/contracts';

/**
 * Direction the LabelWriter print head rotates landscape input.
 *
 * `90` = clockwise. Tentative — confirm on hardware with a die-cut "F"
 * landscape print on an 89×28 mm address label (see plan §6 step 1).
 * If the printed "F" reads upside-down or mirrored, change to `270`.
 */
export const ROTATE_DIRECTION: RotateDirection = 90;
