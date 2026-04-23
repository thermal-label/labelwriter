<template>
  <section class="live-demo">
    <!-- Preview -->
    <div class="preview-wrap">
      <div class="label-wrap" :class="{ inverted: invert }">
        <canvas ref="previewCanvas" class="preview-canvas" />
      </div>
      <p class="preview-hint">Live preview · updates as you type</p>
    </div>

    <!-- Controls -->
    <div class="controls">
      <label class="control control-text">
        <span class="control-label">Label text</span>
        <input v-model="text" placeholder="Type your label…" class="text-input" />
      </label>

      <div class="control-row">
        <label class="control">
          <span class="control-label">Density</span>
          <select v-model="density" class="select-input">
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>

        <label class="control control-checkbox">
          <input v-model="invert" type="checkbox" />
          <span class="control-label">Invert</span>
        </label>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <div class="printer-state">
        <span class="state-dot" :class="stateClass" />
        <span class="state-label">{{ stateLabel }}</span>
        <button v-if="printer" class="btn-disconnect" @click="disconnect">Disconnect</button>
      </div>

      <div class="action-buttons">
        <button v-if="!printer" class="btn btn-connect" :disabled="isConnecting" @click="connect">
          {{ isConnecting ? 'Waiting for browser…' : '🔌 Connect printer' }}
        </button>
        <button
          class="btn btn-print"
          :disabled="!printer || isConnecting || isPrinting || !text.trim()"
          @click="print"
        >
          {{ isPrinting ? 'Printing…' : '▶ Print label' }}
        </button>
      </div>

      <div v-if="nfcLock" class="nfc-notice">
        <strong>⚠ 550 series detected:</strong>
        This printer requires genuine Dymo-certified label rolls with an NFC chip.
        Non-certified labels will trigger a paper-out error at the hardware level.
      </div>

      <p v-if="statusMessage" class="status-msg" :class="statusClass">{{ statusMessage }}</p>
      <p v-if="!printer" class="webusb-note">
        Printing requires <strong>Chrome</strong> or <strong>Edge</strong> with WebUSB. The preview
        works in any browser.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { renderText, scaleBitmap } from '@thermal-label/labelwriter-core';
import type { LabelBitmap } from '@thermal-label/labelwriter-core';
import { computed, onMounted, ref, watch } from 'vue';
import type { WebLabelWriterPrinter, Density } from '@thermal-label/labelwriter-web';

const PREVIEW_SCALE = 4;

function getPixel(bitmap: LabelBitmap, x: number, y: number): boolean {
  const stride = Math.ceil(bitmap.widthPx / 8);
  return (((bitmap.data[y * stride + Math.floor(x / 8)] ?? 0) >> (7 - (x % 8))) & 1) === 1;
}

const text = ref('Hello, world!');
const density = ref<Density>('normal');
const invert = ref(false);

const printer = ref<WebLabelWriterPrinter | null>(null);
const printerName = ref('');
const previewCanvas = ref<HTMLCanvasElement | null>(null);
const isConnecting = ref(false);
const isPrinting = ref(false);
const statusMessage = ref('');
const statusType = ref<'idle' | 'ok' | 'error'>('idle');
const nfcLock = ref(false);

const stateClass = computed(() => {
  if (printer.value) return 'dot-connected';
  if (isConnecting.value) return 'dot-connecting';
  return 'dot-idle';
});

const stateLabel = computed(() => {
  if (isConnecting.value) return 'Connecting…';
  if (printer.value) return printerName.value || 'Connected';
  return 'No printer connected';
});

const statusClass = computed(() => ({
  'status-ok': statusType.value === 'ok',
  'status-error': statusType.value === 'error',
}));

function drawPreview(): void {
  const canvas = previewCanvas.value;
  if (!canvas) return;

  const trimmed = text.value.trim();

  if (!trimmed) {
    canvas.width = 300;
    canvas.height = 8 * PREVIEW_SCALE;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = invert.value ? '#111' : '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  let bitmap: LabelBitmap;
  try {
    bitmap = renderText(trimmed, { invert: invert.value });
  } catch {
    return;
  }

  // Scale the preview height to be visible but not overwhelming
  const fitted = scaleBitmap(bitmap, 16);
  canvas.width = fitted.widthPx * PREVIEW_SCALE;
  canvas.height = fitted.heightPx * PREVIEW_SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = invert.value ? '#111' : '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = invert.value ? '#fff' : '#111';

  for (let y = 0; y < fitted.heightPx; y++) {
    for (let x = 0; x < fitted.widthPx; x++) {
      if (getPixel(fitted, x, y)) {
        ctx.fillRect(x * PREVIEW_SCALE, y * PREVIEW_SCALE, PREVIEW_SCALE, PREVIEW_SCALE);
      }
    }
  }
}

async function connect(): Promise<void> {
  isConnecting.value = true;
  statusMessage.value = '';
  try {
    const { requestPrinter } = await import('@thermal-label/labelwriter-web');
    const p = await requestPrinter();
    printer.value = p;
    printerName.value = p.descriptor.name;
    nfcLock.value = p.descriptor.nfcLock;
    statusType.value = 'ok';
    statusMessage.value = 'Ready to print.';
  } catch (error) {
    statusType.value = 'error';
    statusMessage.value = error instanceof Error ? error.message : 'Connection failed.';
  } finally {
    isConnecting.value = false;
  }
}

async function disconnect(): Promise<void> {
  if (!printer.value) return;
  try {
    await printer.value.disconnect();
  } catch {
    // ignore
  }
  printer.value = null;
  printerName.value = '';
  nfcLock.value = false;
  statusMessage.value = '';
  statusType.value = 'idle';
}

async function print(): Promise<void> {
  if (!printer.value) return;
  const trimmed = text.value.trim();
  if (!trimmed) {
    statusType.value = 'error';
    statusMessage.value = 'Enter label text first.';
    return;
  }

  isPrinting.value = true;
  statusMessage.value = 'Sending to printer…';
  statusType.value = 'idle';
  try {
    await printer.value.printText(trimmed, { density: density.value, invert: invert.value });
    statusType.value = 'ok';
    statusMessage.value = 'Label sent ✓';
  } catch (error) {
    statusType.value = 'error';
    statusMessage.value = error instanceof Error ? error.message : 'Print failed.';
  } finally {
    isPrinting.value = false;
  }
}

onMounted(drawPreview);
watch([text, invert], drawPreview);
</script>

<style scoped>
.live-demo {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  margin: 1.5rem 0;
}

/* ── Preview ── */
.preview-wrap {
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 1.25rem 1.25rem 0.5rem;
}

.label-wrap {
  background: #fff;
  border: 1px solid #d0ccc0;
  border-radius: 6px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  padding: 10px 16px;
}

.label-wrap.inverted {
  background: #111;
  border-color: #444;
}

.preview-canvas {
  display: block;
  image-rendering: pixelated;
}

.preview-hint {
  color: var(--vp-c-text-3);
  font-size: 0.78rem;
  margin: 0.4rem 0 0;
  text-align: center;
}

/* ── Controls ── */
.controls {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.control-label {
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  font-weight: 500;
}

.control-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.control-checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  padding-bottom: 0.1rem;
}

.text-input,
.select-input {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
  padding: 0.45rem 0.6rem;
  transition: border-color 0.15s;
}

.text-input {
  width: 100%;
}

.text-input:focus,
.select-input:focus {
  border-color: var(--vp-c-brand-1);
  outline: none;
}

/* ── Actions ── */
.actions {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.printer-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.4rem;
}

.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.2s;
}

.dot-idle {
  background: var(--vp-c-text-3);
}

.dot-connecting {
  background: #f0a500;
  animation: pulse 1s infinite;
}

.dot-connected {
  background: #4caf50;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.state-label {
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
  flex: 1;
}

.btn-disconnect {
  background: none;
  border: none;
  color: var(--vp-c-text-3);
  cursor: pointer;
  font-size: 0.78rem;
  padding: 0;
  text-decoration: underline;
}

.btn-disconnect:hover {
  color: var(--vp-c-text-1);
}

.action-buttons {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn {
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.55rem 1.2rem;
  transition:
    opacity 0.15s,
    transform 0.1s;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none !important;
}

.btn:not(:disabled):active {
  transform: scale(0.97);
}

.btn-connect {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
  flex: 1;
}

.btn-connect:not(:disabled):hover {
  opacity: 0.88;
}

.btn-print {
  background: #4caf50;
  color: #fff;
  flex: 1;
}

.btn-print:not(:disabled):hover {
  opacity: 0.88;
}

.nfc-notice {
  background: var(--vp-c-warning-soft);
  border: 1px solid var(--vp-c-warning-2);
  border-radius: 8px;
  color: var(--vp-c-warning-1);
  font-size: 0.85rem;
  padding: 0.6rem 0.85rem;
}

.status-msg {
  font-size: 0.85rem;
  margin: 0;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
}

.status-ok {
  color: #4caf50;
}

.status-error {
  color: var(--vp-c-danger-1, #f44);
}

.webusb-note {
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
  margin: 0;
}
</style>
