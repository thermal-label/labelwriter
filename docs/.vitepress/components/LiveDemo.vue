<template>
  <div class="live-demo">
    <div v-if="!webUsbSupported" class="demo-notice">
      <strong>WebUSB is only supported in Chrome and Edge.</strong>
      This demo requires a Chromium-based browser over HTTPS or localhost.
    </div>

    <template v-else>
      <div class="demo-controls">
        <button :disabled="connected" @click="connect">Connect Printer</button>
        <button :disabled="!connected" @click="disconnect">Disconnect</button>
        <span v-if="connected" class="status-ok">● Connected</span>
        <span v-else class="status-off">○ Disconnected</span>
      </div>

      <div class="demo-input">
        <label>
          Text to print
          <input v-model="text" type="text" placeholder="Hello, world!" @input="updatePreview" />
        </label>

        <label>
          Density
          <select v-model="density" @change="updatePreview">
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="normal" selected>Normal</option>
            <option value="high">High</option>
          </select>
        </label>

        <label>
          Mode
          <select v-model="mode" @change="updatePreview">
            <option value="text" selected>Text</option>
            <option value="graphics">Graphics</option>
          </select>
        </label>
      </div>

      <div v-if="preview" class="demo-preview">
        <p class="preview-label">Label preview (1 bpp):</p>
        <canvas ref="previewCanvas" class="preview-canvas" />
      </div>

      <div class="demo-actions">
        <button :disabled="!connected || !text" @click="printLabel">Print</button>
      </div>

      <div v-if="nfcWarning" class="nfc-warning">
        <strong>⚠ NFC label lock (550 series):</strong>
        Your printer requires genuine Dymo-certified labels with an NFC chip.
        Non-certified labels will trigger a paper-out error. This is enforced at
        the hardware level and cannot be bypassed in software.
      </div>

      <p v-if="lastError" class="error-message">{{ lastError }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { WebLabelWriterPrinter, Density } from '@thermal-label/labelwriter-web';

const webUsbSupported = ref(false);
const connected = ref(false);
const text = ref('Hello, world!');
const density = ref<Density>('normal');
const mode = ref<'text' | 'graphics'>('text');
const preview = ref(false);
const nfcWarning = ref(false);
const lastError = ref('');
const previewCanvas = ref<HTMLCanvasElement | null>(null);

let printer: WebLabelWriterPrinter | null = null;

onMounted(() => {
  webUsbSupported.value = typeof navigator !== 'undefined' && 'usb' in navigator;
});

async function connect(): Promise<void> {
  lastError.value = '';
  try {
    const { requestPrinter } = await import('@thermal-label/labelwriter-web');
    printer = await requestPrinter();
    connected.value = true;
    nfcWarning.value = printer.descriptor.nfcLock;
    updatePreview();
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : String(err);
  }
}

async function disconnect(): Promise<void> {
  try {
    await printer?.disconnect();
  } finally {
    printer = null;
    connected.value = false;
    nfcWarning.value = false;
  }
}

function updatePreview(): void {
  if (!text.value) {
    preview.value = false;
    return;
  }

  import('@thermal-label/labelwriter-web').then(({ renderText }) => {
    const bitmap = renderText(text.value);
    preview.value = true;

    requestAnimationFrame(() => {
      const canvas = previewCanvas.value;
      if (!canvas) return;
      canvas.width = bitmap.widthPx;
      canvas.height = bitmap.heightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const imgData = ctx.createImageData(bitmap.widthPx, bitmap.heightPx);

      for (let y = 0; y < bitmap.heightPx; y++) {
        for (let x = 0; x < bitmap.widthPx; x++) {
          const byteIdx = y * Math.ceil(bitmap.widthPx / 8) + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          const bit = ((bitmap.data[byteIdx] ?? 0) >> bitIdx) & 1;
          const pxIdx = (y * bitmap.widthPx + x) * 4;
          const v = bit ? 0 : 255;
          imgData.data[pxIdx] = v;
          imgData.data[pxIdx + 1] = v;
          imgData.data[pxIdx + 2] = v;
          imgData.data[pxIdx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);
    });
  }).catch(() => { /**/ });
}

async function printLabel(): Promise<void> {
  if (!printer || !text.value) return;
  lastError.value = '';
  try {
    await printer.printText(text.value, { density: density.value, mode: mode.value });
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : String(err);
  }
}
</script>

<style scoped>
.live-demo { max-width: 640px; margin: 0 auto; }
.demo-controls, .demo-input, .demo-actions { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
.demo-input label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; }
.demo-input input, .demo-input select { padding: 0.375rem 0.5rem; border: 1px solid var(--vp-c-divider); border-radius: 4px; }
.demo-notice, .nfc-warning { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; }
.demo-notice { background: var(--vp-c-warning-soft); }
.nfc-warning { background: var(--vp-c-tip-soft); }
.status-ok { color: var(--vp-c-green-1); font-size: 0.875rem; }
.status-off { color: var(--vp-c-text-3); font-size: 0.875rem; }
.preview-canvas { display: block; border: 1px solid var(--vp-c-divider); max-width: 100%; image-rendering: pixelated; }
.preview-label { font-size: 0.875rem; color: var(--vp-c-text-2); margin-bottom: 0.25rem; }
.error-message { color: var(--vp-c-red-1); font-size: 0.875rem; }
</style>
