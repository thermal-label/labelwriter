#!/usr/bin/env node
// Generates a simple supported-hardware table from the JSON5 device
// entries and injects it between marker comments in:
//   - README.md            (so npm/GitHub readers see it on first contact)
//   - docs/hardware.md     (so the driver's own docs page stays in sync)
//
// The fancy interactive cross-driver table lives at
// https://thermal-label.github.io/hardware/. This script gives each
// driver repo its own simple, GitHub-rendered version sourced from the
// same JSON5 files.
//
// Markers (must exist in any file that should be patched):
//   <!-- HARDWARE_TABLE:START -->
//   <!-- HARDWARE_TABLE:END -->
// The script fails loudly if a target file is missing them.
//
// This script is duplicated across the three driver repos with only the
// DRIVER constant differing — extract to a shared package once edits
// here start getting copy-pasted three times in a row.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEVICES_DIR = resolve(REPO_ROOT, 'packages/core/data/devices');
const README_PATH = resolve(REPO_ROOT, 'README.md');
const HW_DOC_PATH = resolve(REPO_ROOT, 'docs/hardware.md');
const PKG_README_PATHS = [
  resolve(REPO_ROOT, 'packages/core/README.md'),
  resolve(REPO_ROOT, 'packages/node/README.md'),
  resolve(REPO_ROOT, 'packages/web/README.md'),
];

// Per-driver constants. Change the DRIVER value to retarget this
// script at a different driver repo without touching anything else.
const DRIVER = 'labelwriter';
const SITE_BASE = 'https://thermal-label.github.io';

const STATUS_BADGE = {
  verified: '✅ verified',
  partial:  '⚠️ partial',
  broken:   '❌ broken',
  untested: '⏳ untested',
};

const TRANSPORT_LABEL = {
  usb: 'USB',
  tcp: 'TCP',
  serial: 'Serial',
  'bluetooth-spp': 'BT SPP',
  'bluetooth-gatt': 'BT LE',
};

const MARKER_START = '<!-- HARDWARE_TABLE:START -->';
const MARKER_END   = '<!-- HARDWARE_TABLE:END -->';

function log(msg) { process.stdout.write(`[build-hardware-table] ${msg}\n`); }
function die(msg) { process.stderr.write(`[build-hardware-table] error: ${msg}\n`); process.exit(1); }

function loadDevices() {
  if (!existsSync(DEVICES_DIR)) die(`devices dir not found at ${DEVICES_DIR}`);
  const files = readdirSync(DEVICES_DIR).filter(f => f.endsWith('.json5'));
  return files
    .map(f => JSON5.parse(readFileSync(join(DEVICES_DIR, f), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
}

function devSlug(key) {
  return key.toLowerCase().replace(/_/g, '-');
}

function transportList(dev) {
  const ts = Object.keys(dev.transports ?? {});
  if (ts.length === 0) return '—';
  return ts.map(t => TRANSPORT_LABEL[t] ?? t).join(', ');
}

function statusBadge(dev) {
  const s = dev.support?.status ?? 'untested';
  return STATUS_BADGE[s] ?? s;
}

function detailUrl(dev) {
  return `${SITE_BASE}/hardware/${DRIVER}/${devSlug(dev.key)}`;
}

function renderCounts(devices) {
  const c = { total: devices.length, verified: 0, partial: 0, broken: 0, untested: 0 };
  for (const d of devices) c[d.support?.status ?? 'untested']++;
  return `**${c.total} devices** — ${c.verified} verified · ${c.partial} partial · ${c.broken} broken · ${c.untested} untested`;
}

function renderTable(devices) {
  const rows = devices.map(d => {
    const name = `[${d.name}](${detailUrl(d)})`;
    const usbPid = d.transports?.usb?.pid ?? '—';
    return `| ${name} | \`${d.key}\` | ${usbPid} | ${transportList(d)} | ${statusBadge(d)} |`;
  });
  return [
    '| Model | Key | USB PID | Transports | Status |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function renderSection(devices) {
  return [
    renderCounts(devices),
    '',
    renderTable(devices),
    '',
    'Click any model to open its detail page on the docs site, where engines, supported media, and verification reports live. The same data backs the [interactive cross-driver table](' + SITE_BASE + '/hardware/).',
  ].join('\n');
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function patchFile(path, section, { required, autoInject }) {
  if (!existsSync(path)) {
    if (required) die(`${path}: not found`);
    log(`${path}: not found, skipping`);
    return { written: false, injected: false };
  }
  let original = readFileSync(path, 'utf8');
  let injected = false;
  if (!original.includes(MARKER_START) || !original.includes(MARKER_END)) {
    if (!autoInject) {
      die(`${path} is missing ${MARKER_START} / ${MARKER_END} markers — add them where the table should appear`);
    }
    const block = `\n## Supported hardware\n\n${MARKER_START}\n${MARKER_END}\n`;
    const trailingRe = /\n(## (?:License|References)\b[\s\S]*)$/;
    if (trailingRe.test(original)) {
      original = original.replace(trailingRe, `${block}\n$1`);
    } else {
      original = original.replace(/\s*$/, '') + '\n' + block;
    }
    injected = true;
  }
  const re = new RegExp(`${escapeRe(MARKER_START)}[\\s\\S]*?${escapeRe(MARKER_END)}`);
  const replaced = original.replace(re, `${MARKER_START}\n${section}\n${MARKER_END}`);
  if (!injected && replaced === readFileSync(path, 'utf8')) {
    log(`${path}: no change`);
    return { written: false, injected: false };
  }
  writeFileSync(path, replaced);
  log(`${path}: ${injected ? 'injected + ' : ''}updated`);
  return { written: true, injected };
}

function main() {
  const devices = loadDevices();
  log(`${DRIVER}: loaded ${devices.length} devices`);
  const section = renderSection(devices);
  let written = 0;
  let injected = 0;
  for (const [path, opts] of [
    [README_PATH, { required: true, autoInject: false }],
    [HW_DOC_PATH, { required: false, autoInject: false }],
    ...PKG_README_PATHS.map(p => [p, { required: false, autoInject: true }]),
  ]) {
    const r = patchFile(path, section, opts);
    if (r.written) written++;
    if (r.injected) injected++;
  }
  log(`${DRIVER}: wrote ${written} hardware tables (${injected} marker blocks injected)`);
}

main();
