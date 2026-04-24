import { describe, expect, it } from 'vitest';
import { MEDIA } from '../media.js';
import { createPreviewOffline } from '../preview.js';

function rgba(
  width: number,
  height: number,
): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  return { width, height, data: new Uint8Array(width * height * 4).fill(0) };
}

describe('createPreviewOffline', () => {
  it('returns a single black plane for any LabelWriter media', () => {
    const preview = createPreviewOffline(rgba(8, 8), MEDIA.ADDRESS_STANDARD);
    expect(preview.planes).toHaveLength(1);
    expect(preview.planes[0]!.name).toBe('black');
    expect(preview.planes[0]!.displayColor).toBe('#000000');
    expect(preview.media).toBe(MEDIA.ADDRESS_STANDARD);
    expect(preview.assumed).toBe(false);
  });

  it('carries over the media argument unchanged', () => {
    const preview = createPreviewOffline(rgba(8, 8), MEDIA.SHIPPING_STANDARD);
    expect(preview.media).toBe(MEDIA.SHIPPING_STANDARD);
  });

  it('bitmap matches the source image dimensions', () => {
    const preview = createPreviewOffline(rgba(32, 16), MEDIA.ADDRESS_STANDARD);
    expect(preview.planes[0]!.bitmap.widthPx).toBe(32);
    expect(preview.planes[0]!.bitmap.heightPx).toBe(16);
  });
});
