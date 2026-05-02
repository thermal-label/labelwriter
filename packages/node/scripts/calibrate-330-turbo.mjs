/**
 * Calibration print for the LW 330 Turbo — measures the chassis-physical
 * offsets the registry doesn't yet model.
 *
 * Prints a nested-rectangle / labelled-tick pattern along each edge of
 * the buffer. By eyeballing which label is the first one to print
 * fully (vs. clipped or missing), you read the offset directly:
 *
 *   - Top edge        → leadingEdgeOffsetDots
 *   - Bottom edge     → trailingEdgeOffsetDots (relative to the gap)
 *   - Left edge       → leftEdgeOffsetDots (chassis-x offset)
 *   - Right edge      → rightEdgeOffsetDots (= 672 - last visible tick)
 *
 * Buffer is 672×labelHeight (lever-arch 99019 = 2244 dots ≈ 190 mm).
 * Tick spacing is 10 dots for the first 150 dots from each edge,
 * which covers the expected 6 mm (~71 dots) leading offset.
 *
 * Run from the repo root:
 *   node packages/node/scripts/calibrate-330-turbo.mjs
 */
import { discovery } from '../dist/index.js';
import { MEDIA, renderText } from '@thermal-label/labelwriter-core';

const HEAD_DOTS = 672;

function bitmapPixel(bm, x, y) {
  const bytesPerRow = (bm.widthPx + 7) >> 3;
  const byte = bm.data[y * bytesPerRow + (x >> 3)];
  return (byte >> (7 - (x & 7))) & 1;
}

function setBlack(img, x, y) {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = 0;
  img.data[i + 1] = 0;
  img.data[i + 2] = 0;
}

function fillRect(img, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setBlack(img, xx, yy);
}

function stamp(img, bm, dx, dy) {
  for (let y = 0; y < bm.heightPx; y++) {
    for (let x = 0; x < bm.widthPx; x++) {
      if (!bitmapPixel(bm, x, y)) continue;
      setBlack(img, dx + x, dy + y);
    }
  }
}

function makeCalibrationImage(width, height, labelHeight) {
  const data = new Uint8Array(width * height * 4).fill(0xff);
  const img = { width, height, data };

  // ─── TOP edge calibration (measures leadingEdgeOffsetDots) ────────
  // Horizontal bars at y = 0, 10, 20, ..., 150. First bar to appear
  // intact = the offset value (in dots). 11.81 dots/mm at 300 dpi.
  for (let off = 0; off <= 150; off += 10) {
    fillRect(img, 200, off, 250, 3); // 3-dot tall bar centred horizontally
    const lbl = renderText(`y=${off}`, { scaleX: 2, scaleY: 2 });
    stamp(img, lbl, 470, off - Math.floor(lbl.heightPx / 2));
  }

  // ─── BOTTOM edge calibration (measures trailing offset before gap) ─
  // Bars at y = labelHeight - 1, -10, -20, ..., -150. First bar to
  // appear intact (working up from the gap) = trailingEdgeOffsetDots.
  for (let off = 0; off <= 150; off += 10) {
    const y = labelHeight - 1 - off;
    fillRect(img, 200, y, 250, 3);
    const lbl = renderText(`y=-${off}`, { scaleX: 2, scaleY: 2 });
    stamp(img, lbl, 470, y - Math.floor(lbl.heightPx / 2));
  }

  // ─── LEFT edge calibration ────────────────────────────────────────
  // Vertical bars at x = 0, 10, 20, ..., 80. Drawn in the middle of
  // the label so they don't collide with the top/bottom calibration.
  const sideY1 = Math.floor(labelHeight / 2 - 600);
  const sideY2 = Math.floor(labelHeight / 2 - 100);
  for (let off = 0; off <= 80; off += 10) {
    fillRect(img, off, sideY1, 3, sideY2 - sideY1);
    const lbl = renderText(`x=${off}`, { scaleX: 2, scaleY: 2 });
    stamp(img, lbl, off + 8, sideY1 - 30 + (off / 10) * 22);
  }

  // ─── RIGHT edge calibration ───────────────────────────────────────
  // Vertical bars at x = 671, 661, 651, ..., 591 (HEAD_DOTS-1 - off).
  const rsideY1 = Math.floor(labelHeight / 2 + 100);
  const rsideY2 = Math.floor(labelHeight / 2 + 600);
  for (let off = 0; off <= 80; off += 10) {
    const x = width - 1 - off;
    fillRect(img, x - 2, rsideY1, 3, rsideY2 - rsideY1);
    const lbl = renderText(`x=-${off}`, { scaleX: 2, scaleY: 2 });
    stamp(img, lbl, x - 75, rsideY1 - 30 + (off / 10) * 22);
  }

  // ─── Centre legend ────────────────────────────────────────────────
  const title = renderText('CALIBRATION', { scaleX: 5, scaleY: 5 });
  stamp(img, title, Math.floor((width - title.widthPx) / 2), Math.floor(labelHeight / 2 - 30));
  const sub = renderText('99019  /  LW 330 TURBO', { scaleX: 3, scaleY: 3 });
  stamp(img, sub, Math.floor((width - sub.widthPx) / 2), Math.floor(labelHeight / 2 + 50));

  return img;
}

async function main() {
  const printer = await discovery.openPrinter({ vid: 0x0922, pid: 0x0008 });
  try {
    console.log('Pre status:', await printer.getStatus());
    const labelHeight = MEDIA.LEVER_ARCH.lengthDots; // 2244 dots
    const buffer = labelHeight + 100; // gap-detection slack
    const image = makeCalibrationImage(HEAD_DOTS, buffer, labelHeight);
    console.log(
      `Printing ${image.width}×${image.height} calibration on ${MEDIA.LEVER_ARCH.name}...`,
    );
    await printer.print(image, MEDIA.LEVER_ARCH);
    console.log('Post status:', await printer.getStatus());
  } finally {
    await printer.close();
  }
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
