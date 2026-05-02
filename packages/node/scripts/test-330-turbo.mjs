/**
 * One-off smoke test for the LabelWriter 330 Turbo (USB PID 0x0008).
 *
 * Loaded media: SKU 99019 = "Large Lever Arch Files" (59 × 190 mm) =
 * MEDIA.LEVER_ARCH (US SKU 1933087, same physical product).
 *
 * Prereqs:
 *   - The kernel `usblp` driver must be detached so libusb can claim
 *     the interface. If you see a busy/EACCES error:
 *       sudo modprobe -r usblp
 *
 * Run from the repo root:
 *   node packages/node/scripts/test-330-turbo.mjs
 *
 * The label feeds long-axis-first (190 mm), so on the printed label
 * the LEFT/RIGHT in this script are the leading/trailing edges; the
 * TOP/BOTTOM are the chassis edges.
 */
import { discovery } from '../dist/index.js';
import { MEDIA, renderText } from '@thermal-label/labelwriter-core';

// Inline rather than import @mbtech-nl/bitmap (not a direct dep of
// the node package). LabelBitmap is packed 1bpp, MSB-first per row.
function bitmapPixel(bm, x, y) {
  const bytesPerRow = (bm.widthPx + 7) >> 3;
  const byte = bm.data[y * bytesPerRow + (x >> 3)];
  return (byte >> (7 - (x & 7))) & 1;
}

const HEAD_DOTS = 672; // 330 Turbo head width

// Convert a 1bpp LabelBitmap (from renderText) into RGBA pixels stamped
// into a target RGBA image at (dstX, dstY). Black bitmap pixels become
// black; transparent (off) pixels leave the destination untouched.
function stamp(target, bitmap, dstX, dstY) {
  for (let y = 0; y < bitmap.heightPx; y++) {
    for (let x = 0; x < bitmap.widthPx; x++) {
      if (!bitmapPixel(bitmap, x, y)) continue;
      const tx = dstX + x;
      const ty = dstY + y;
      if (tx < 0 || tx >= target.width || ty < 0 || ty >= target.height) continue;
      const i = (ty * target.width + tx) * 4;
      target.data[i] = 0;
      target.data[i + 1] = 0;
      target.data[i + 2] = 0;
    }
  }
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

function strokeRect(img, x, y, w, h, t = 4) {
  for (let i = 0; i < t; i++) {
    fillRect(img, x, y + i, w, 1);
    fillRect(img, x, y + h - 1 - i, w, 1);
    fillRect(img, x + i, y, 1, h);
    fillRect(img, x + w - 1 - i, y, 1, h);
  }
}

function arrow(img, baseX, baseY, length, dir) {
  // Solid arrow shaft, then a triangular head, in the +y direction
  // (dir='down') or +x direction (dir='right').
  const t = 12; // shaft thickness
  if (dir === 'down') {
    fillRect(img, baseX - t / 2, baseY, t, length - 30);
    // triangle head
    for (let i = 0; i < 30; i++) {
      const w = (i * 30) / 30; // widens
      fillRect(img, baseX - 30 + i, baseY + length - 30 + i, 60 - 2 * i, 1);
    }
  } else if (dir === 'right') {
    fillRect(img, baseX, baseY - t / 2, length - 30, t);
    for (let i = 0; i < 30; i++) {
      fillRect(img, baseX + length - 30 + i, baseY - 30 + i, 1, 60 - 2 * i);
    }
  }
}

function makeTestImage(width, height, labelHeight) {
  const data = new Uint8Array(width * height * 4).fill(0xff);
  const img = { width, height, data };

  // Safe printable area inside the label.
  //  - Side margins: 99019 lever-arch is 59 mm but the head only fires
  //    56.9 mm (672 dots), so the rightmost ~25 dots of the label
  //    aren't reachable; left edge has a similar chassis offset.
  //    Keep visible content >= MARGIN dots in from each side.
  //  - Top margin: small leader before the printable area.
  //  - Bottom margin: keep visible content well above `labelHeight`
  //    (the actual label end). Anything past that prints onto the
  //    next label (the +slack region used for gap detection).
  const MARGIN = 40;
  const safeLeft = MARGIN;
  const safeRight = width - MARGIN;
  const safeTop = 30;
  const safeBottom = labelHeight - 60; // stay clear of the gap

  // Outer frame inside the safe area.
  strokeRect(img, safeLeft, safeTop, safeRight - safeLeft, safeBottom - safeTop, 3);

  // ── Leading edge ──
  fillRect(img, safeLeft + 10, safeTop + 20, safeRight - safeLeft - 20, 50);
  const top = renderText('LEADING EDGE -- FRONT', { scaleX: 4, scaleY: 4 });
  stamp(img, top, Math.floor((width - top.widthPx) / 2), safeTop + 100);
  arrow(img, Math.floor(width / 2), safeTop + 190, 200, 'down');

  // ── Ruler ticks every 100 dots along the LEFT edge inside safe area ──
  for (let y = 500; y < safeBottom - 200; y += 100) {
    fillRect(img, safeLeft + 10, y - 2, 60, 5);
    if (y % 500 === 0) {
      const lbl = renderText(`${y}`, { scaleX: 3, scaleY: 3 });
      stamp(img, lbl, safeLeft + 90, y - Math.floor(lbl.heightPx / 2));
    }
  }

  // ── Centre text strip ──
  const mid = renderText('LW 330 TURBO  /  99019  /  672 dots', { scaleX: 5, scaleY: 5 });
  // Clamp the centre text within the safe region in case it would
  // exceed the printable width.
  const midX = Math.max(safeLeft + 10, Math.floor((width - mid.widthPx) / 2));
  stamp(img, mid, midX, Math.floor(labelHeight / 2 - mid.heightPx / 2));

  // ── Side rails inside safe area ──
  fillRect(img, safeRight - 25, 500, 15, safeBottom - 1000);
  const right = renderText('RIGHT', { scaleX: 3, scaleY: 3 });
  stamp(img, right, safeRight - 220, Math.floor(labelHeight / 2 + 100));
  const left = renderText('LEFT', { scaleX: 3, scaleY: 3 });
  stamp(img, left, safeLeft + 100, Math.floor(labelHeight / 2 + 100));

  // ── Trailing edge — stay 100+ dots above the gap ──
  const bot = renderText('TRAILING EDGE -- BACK', { scaleX: 4, scaleY: 4 });
  stamp(img, bot, Math.floor((width - bot.widthPx) / 2), safeBottom - 150);
  fillRect(img, safeLeft + 10, safeBottom - 70, safeRight - safeLeft - 20, 50);

  return img;
}

async function main() {
  console.log('Discovering printers...');
  const printers = await discovery.listPrinters();
  console.log(
    'Found:',
    printers.map(p => `${p.device.key} @ ${p.connectionId}`).join(', ') || '(none)',
  );

  const printer = await discovery.openPrinter({ vid: 0x0922, pid: 0x0008 });
  try {
    console.log('Opened. Status:', await printer.getStatus());

    // Buffer pitch = label height + gap slack. Per LW 450 Tech Ref §6.1
    // ESC L sets leading-edge to leading-edge distance (label + gap).
    // Lever-arch gap is ~3 mm (~36 dots); add 100 dots slack so the
    // gap detector finds the mark before the buffer ends.
    const labelHeight = MEDIA.LEVER_ARCH.lengthDots; // 2244 dots ≈ 190 mm
    const bufferHeight = labelHeight + 100; // gap-detection slack
    const image = makeTestImage(HEAD_DOTS, bufferHeight, labelHeight);
    console.log(
      `Printing ${image.width}×${image.height} test pattern on ${MEDIA.LEVER_ARCH.name}...`,
    );
    await printer.print(image, MEDIA.LEVER_ARCH);
    console.log('Sent. Final status:', await printer.getStatus());
  } finally {
    await printer.close();
    console.log('Closed.');
  }
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
