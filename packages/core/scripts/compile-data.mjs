#!/usr/bin/env node
// Compiles packages/core/data/devices/*.json5 + packages/core/data/media.json5
// into the runtime artifacts:
//
//   - data/devices.json — flat aggregated DeviceRegistry artifact for
//     non-TS consumers (validators, external doc generators).
//   - data/media.json   — flat aggregated media list, same role.
//   - src/devices.generated.ts — typed re-export of the device data,
//     consumed by src/devices.ts.
//   - src/media.generated.ts   — typed re-export of the media data,
//     keyed-by-`key` for `MEDIA.ADDRESS_STANDARD`-style access.
//
// All four outputs are gitignored — the script regenerates them on
// every prebuild / pretest / pretypecheck step. Naming + commit
// policy mirror @thermal-label/labelmanager-core and
// @thermal-label/brother-ql.
//
// Validates each entry against a structural subset of the contracts
// shapes. Run via `pnpm run compile-data`. Wired as a prebuild step.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { expandVerifications, mapLegacyStatus } from '@thermal-label/contracts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const DEVICES_DIR = resolve(PACKAGE_ROOT, 'data/devices');
const MEDIA_FILE = resolve(PACKAGE_ROOT, 'data/media.json5');
const DEVICES_JSON = resolve(PACKAGE_ROOT, 'data/devices.json');
const MEDIA_JSON = resolve(PACKAGE_ROOT, 'data/media.json');
const DEVICES_TS = resolve(PACKAGE_ROOT, 'src/devices.generated.ts');
const MEDIA_TS = resolve(PACKAGE_ROOT, 'src/media.generated.ts');

const DRIVER = 'labelwriter';
const HEX_RE = /^0x[0-9a-fA-F]+$/;
const KEY_RE = /^[A-Z][A-Z0-9_]*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_SUPPORT_STATUS = new Set(['verified', 'partial', 'broken', 'untested']);
const VERIFICATION_RUNGS = new Set(['verified', 'partial', 'unsupported']);
const MAX_ISSUES_PER_CELL = 2;
const TRANSPORT_KEYS = new Set(['usb', 'tcp', 'serial', 'bluetooth-spp', 'bluetooth-gatt']);
const MEDIA_TYPE = new Set(['die-cut', 'continuous', 'tape']);
const KNOWN_TARGET_MODELS = new Set(['lw', 'lw-wide', 'd1', 'd1-wide']);
const D1_MATERIALS = new Set(['standard', 'permanent-polyester', 'flexible-nylon', 'durable']);
const D1_TAPE_COLORS = new Set([
  'white',
  'clear',
  'yellow',
  'blue',
  'green',
  'red',
  'black',
  'orange',
]);
const D1_TAPE_WIDTHS = new Set([6, 9, 12, 19, 24]);

// Mirror of `tapeTypeFor` in @thermal-label/d1-core — keep in sync
// with d1-core/src/tape-type.ts. Source-of-truth + JSDoc + spec
// citation live there; this duplicate lets the generator bake the
// wire byte into each D1 descriptor at compile time so runtime
// callers don't recompute. Per LW 400 Series Tech Ref p.24.
function tapeColourFor(background, text) {
  if (text === 'black') {
    if (background === 'white' || background === 'clear') return 0;
    if (background === 'blue') return 1;
    if (background === 'red') return 2;
    if (background === 'yellow') return 4;
    if (background === 'green') return 6;
    return 0;
  }
  if (text === 'white') {
    if (background === 'clear') return 9;
    if (background === 'black') return 10;
    return 0;
  }
  if (background === 'white' || background === 'clear') {
    if (text === 'blue') return 11;
    if (text === 'red') return 12;
  }
  return 0;
}

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

function validateDeviceEntry(entry, file) {
  const where = `${file}`;

  if (typeof entry?.key !== 'string') fail(where, 'key must be a string');
  if (typeof entry?.name !== 'string') fail(where, 'name must be a string');
  if (entry?.family !== DRIVER) fail(where, `family must be "${DRIVER}"`);

  if (!entry?.transports || typeof entry.transports !== 'object') {
    fail(where, 'transports must be an object');
  } else {
    for (const k of Object.keys(entry.transports)) {
      if (!TRANSPORT_KEYS.has(k)) fail(where, `transports.${k} is not a known transport key`);
    }
    const usb = entry.transports.usb;
    if (usb !== undefined) {
      if (!HEX_RE.test(usb.vid ?? ''))
        fail(where, 'transports.usb.vid must be a hex string like "0x0922"');
      if (!HEX_RE.test(usb.pid ?? ''))
        fail(where, 'transports.usb.pid must be a hex string like "0x0020"');
    }
    const tcp = entry.transports.tcp;
    if (tcp !== undefined && typeof tcp.port !== 'number') {
      fail(where, 'transports.tcp.port must be a number');
    }
    const serial = entry.transports.serial;
    if (serial !== undefined && typeof serial.defaultBaud !== 'number') {
      fail(where, 'transports.serial.defaultBaud must be a number');
    }
  }

  if (!Array.isArray(entry?.engines) || entry.engines.length === 0) {
    fail(where, 'engines must be a non-empty array');
  } else {
    const seenRoles = new Set();
    for (const [i, eng] of entry.engines.entries()) {
      const ewhere = `${where} engines[${i}]`;
      if (typeof eng?.role !== 'string') fail(ewhere, 'role must be a string');
      else if (seenRoles.has(eng.role)) fail(ewhere, `duplicate role "${eng.role}"`);
      else seenRoles.add(eng.role);
      if (typeof eng?.protocol !== 'string') fail(ewhere, 'protocol must be a string');
      if (typeof eng?.dpi !== 'number') fail(ewhere, 'dpi must be a number');
      if (typeof eng?.headDots !== 'number') fail(ewhere, 'headDots must be a number');
    }
  }

  if (!entry?.support || typeof entry.support !== 'object') {
    fail(where, 'support must be an object');
  } else if (!LEGACY_SUPPORT_STATUS.has(entry.support.status)) {
    fail(where, `support.status must be one of ${[...LEGACY_SUPPORT_STATUS].join('|')}`);
  }

  // Optional `verifications` block — new shape, runs alongside legacy
  // `support` during the alias transition (see plan #0).
  if (entry?.verifications !== undefined) {
    if (typeof entry.verifications !== 'object' || Array.isArray(entry.verifications)) {
      fail(where, 'verifications must be a keyed object');
    } else {
      const declared = new Set(Object.keys(entry.transports ?? {}));
      for (const [k, cell] of Object.entries(entry.verifications)) {
        const cwhere = `${where} verifications.${k}`;
        if (!TRANSPORT_KEYS.has(k)) {
          fail(cwhere, 'unknown transport key');
          continue;
        }
        if (!declared.has(k)) {
          fail(cwhere, 'transport not declared on this device');
        }
        if (!cell || typeof cell !== 'object') {
          fail(cwhere, 'cell must be an object');
          continue;
        }
        if (!VERIFICATION_RUNGS.has(cell.status)) {
          fail(cwhere, `status must be one of ${[...VERIFICATION_RUNGS].join('|')}`);
        }
        if (cell.issues !== undefined) {
          if (!Array.isArray(cell.issues)) {
            fail(cwhere, 'issues must be an array');
          } else {
            if (cell.issues.length > MAX_ISSUES_PER_CELL) {
              fail(cwhere, `issues may have at most ${MAX_ISSUES_PER_CELL} entries`);
            }
            for (const n of cell.issues) {
              if (!Number.isInteger(n) || n <= 0) {
                fail(cwhere, 'issues entries must be positive integers');
              }
            }
          }
        }
        if (cell.reason !== undefined && typeof cell.reason !== 'string') {
          fail(cwhere, 'reason must be a string');
        }
        if (cell.lastReported !== undefined && !ISO_DATE_RE.test(cell.lastReported ?? '')) {
          fail(cwhere, 'lastReported must be ISO date YYYY-MM-DD');
        }
      }
    }
  }
}

// Synthesise a `verifications` block from the legacy `support` field
// when no explicit `verifications` is authored. Prefers per-transport
// `support.transports.<t>` when authored; otherwise falls back to the
// device-level `support.status`. Returns an empty object when the
// effective status is `'untested'` (no claim).
//
// `mapLegacyStatus` is imported from `@thermal-label/contracts`.
function legacyToVerifications(entry) {
  const declared = Object.keys(entry?.transports ?? {});
  const supportTransports = entry?.support?.transports;
  const out = {};
  if (supportTransports && typeof supportTransports === 'object') {
    for (const t of declared) {
      const mapped = mapLegacyStatus(supportTransports[t]);
      if (mapped) out[t] = { status: mapped };
    }
    // If author specified per-transport entries, trust the granularity
    // — do not fall back to device-level status for unmentioned transports.
    if (Object.keys(supportTransports).length > 0) return out;
  }
  const deviceStatus = mapLegacyStatus(entry?.support?.status);
  if (!deviceStatus) return {};
  for (const t of declared) {
    if (out[t] === undefined) out[t] = { status: deviceStatus };
  }
  return out;
}

// `expandVerifications` is imported from `@thermal-label/contracts`.

// Apply tape-entry defaults in place (category, tapeWidthMm,
// tapeColour). No-op for paper entries. Called before validation so
// rules see the fully-defaulted shape.
//
// `targetModels` is intentionally NOT defaulted — D1 cartridges are
// a cross-driver substrate (LabelWriter Duo today, potentially a
// LabelManager driver tomorrow), so each entry declares its own
// substrate tags. A default would silently encode "this registry
// belongs to the Duo" and force any future shared consumer to
// duplicate or override the rule.
function applyTapeDefaults(entry) {
  if (entry?.type !== 'tape') return;
  if (entry.category === undefined) entry.category = 'cartridge';
  if (entry.tapeWidthMm === undefined && typeof entry.widthMm === 'number') {
    entry.tapeWidthMm = entry.widthMm;
  }
  if (
    entry.tapeColour === undefined &&
    typeof entry.background === 'string' &&
    typeof entry.text === 'string'
  ) {
    entry.tapeColour = tapeColourFor(entry.background, entry.text);
  }
}

function validateMediaEntry(entry, idx) {
  const where = `media[${idx}]${entry?.key ? ` (${entry.key})` : ''}`;

  if (typeof entry?.key !== 'string' || !KEY_RE.test(entry.key)) {
    fail(where, 'key must match /^[A-Z][A-Z0-9_]*$/');
  }
  if (typeof entry?.id !== 'string') fail(where, 'id must be a string');
  if (typeof entry?.name !== 'string') fail(where, 'name must be a string');
  if (typeof entry?.category !== 'string') fail(where, 'category must be a string');
  if (typeof entry?.widthMm !== 'number') fail(where, 'widthMm must be a number');
  if (!MEDIA_TYPE.has(entry?.type)) fail(where, `type must be one of ${[...MEDIA_TYPE].join('|')}`);

  if (entry?.type === 'die-cut') {
    if (typeof entry.heightMm !== 'number') fail(where, 'die-cut media must declare heightMm');
    if (typeof entry.lengthDots !== 'number') fail(where, 'die-cut media must declare lengthDots');
  } else if (entry?.type === 'continuous') {
    if (entry.heightMm !== undefined) fail(where, 'continuous media must omit heightMm');
    if (entry.lengthDots !== undefined) fail(where, 'continuous media must omit lengthDots');
  } else if (entry?.type === 'tape') {
    if (entry.heightMm !== undefined) fail(where, 'tape media must omit heightMm');
    if (entry.lengthDots !== undefined) fail(where, 'tape media must omit lengthDots');
    if (!D1_TAPE_WIDTHS.has(entry.widthMm)) {
      fail(where, `tape widthMm must be one of ${[...D1_TAPE_WIDTHS].join('|')}`);
    }
    if (entry.tapeWidthMm !== entry.widthMm) {
      fail(where, 'tape tapeWidthMm must equal widthMm');
    }
    if (!D1_MATERIALS.has(entry.material)) {
      fail(where, `tape material must be one of ${[...D1_MATERIALS].join('|')}`);
    }
    if (!D1_TAPE_COLORS.has(entry.background)) {
      fail(where, `tape background must be a D1TapeColor (${[...D1_TAPE_COLORS].join('|')})`);
    }
    if (!D1_TAPE_COLORS.has(entry.text)) {
      fail(where, `tape text must be a D1TapeColor (${[...D1_TAPE_COLORS].join('|')})`);
    }
    if (typeof entry.tapeColour !== 'number') {
      fail(where, 'tape tapeColour must be numeric (defaulted from background+text)');
    }
  }

  if (!Array.isArray(entry?.targetModels) || entry.targetModels.length === 0) {
    fail(where, 'targetModels must be a non-empty array');
  } else {
    for (const t of entry.targetModels) {
      if (!KNOWN_TARGET_MODELS.has(t))
        fail(where, `targetModels entry "${t}" is not a known substrate tag`);
    }
  }

  if (entry?.skus !== undefined && !Array.isArray(entry.skus)) {
    fail(where, 'skus must be an array if present');
  }
}

// ─── devices ──────────────────────────────────────────────────────────

const deviceFiles = readdirSync(DEVICES_DIR)
  .filter(f => f.endsWith('.json5'))
  .sort();
const devices = [];
const seenDeviceKeys = new Set();

for (const file of deviceFiles) {
  let entry;
  try {
    entry = JSON5.parse(readFileSync(resolve(DEVICES_DIR, file), 'utf8'));
  } catch (err) {
    fail(file, `parse error: ${err.message}`);
    continue;
  }
  validateDeviceEntry(entry, file);
  if (entry?.key && seenDeviceKeys.has(entry.key)) fail(file, `duplicate key "${entry.key}"`);
  if (entry?.key && file !== `${entry.key}.json5`) {
    fail(file, `filename must match key (expected ${entry.key}.json5)`);
  }
  if (entry?.key) seenDeviceKeys.add(entry.key);
  devices.push(entry);
}

// ─── media ────────────────────────────────────────────────────────────

let mediaList = [];
try {
  mediaList = JSON5.parse(readFileSync(MEDIA_FILE, 'utf8'));
  if (!Array.isArray(mediaList)) {
    fail('media.json5', 'top-level value must be an array');
    mediaList = [];
  }
} catch (err) {
  fail('media.json5', `parse error: ${err.message}`);
}

const seenMediaKeys = new Set();
const seenMediaIds = new Set();
mediaList.forEach((entry, i) => {
  applyTapeDefaults(entry);
  validateMediaEntry(entry, i);
  if (entry?.key) {
    if (seenMediaKeys.has(entry.key)) fail(`media[${i}]`, `duplicate key "${entry.key}"`);
    seenMediaKeys.add(entry.key);
  }
  if (entry?.id) {
    if (seenMediaIds.has(entry.id)) fail(`media[${i}]`, `duplicate id "${entry.id}"`);
    seenMediaIds.add(entry.id);
  }
});

// ─── emit ─────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`[compile-data] ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

// Build a registry shadow where each device has a populated
// `verifications` field — explicit when authored, synthesised from
// legacy `support` otherwise — so the contracts `expandVerifications`
// sees one consistent shape.
const synthesizedDevices = devices.map(d => {
  const v =
    d.verifications && Object.keys(d.verifications).length > 0
      ? d.verifications
      : legacyToVerifications(d);
  return { ...d, verifications: v };
});

const expanded = expandVerifications({
  schemaVersion: 1,
  driver: DRIVER,
  devices: synthesizedDevices,
});

// Lean device entries for the bundled TS: drop authoring-only blocks
// (`verifications`) and stamp the rolled-up `supportStatus`.
const leanDevices = devices.map((d, i) => {
  const { verifications: _v, ...rest } = d;
  return { ...rest, supportStatus: expanded.devices[i].supportStatus };
});

// Rich device entries for the JSON projection: keep `verifications`
// + stamp the expanded `verificationGrid` and rolled-up `supportStatus`.
const richDevices = devices.map((d, i) => ({
  ...d,
  verificationGrid: expanded.devices[i].verificationGrid,
  supportStatus: expanded.devices[i].supportStatus,
}));

const richRegistry = { schemaVersion: 1, driver: DRIVER, devices: richDevices };
writeFileSync(DEVICES_JSON, JSON.stringify(richRegistry, null, 2) + '\n');

writeFileSync(
  MEDIA_JSON,
  JSON.stringify({ schemaVersion: 1, driver: DRIVER, media: mediaList }, null, 2) + '\n',
);

const leanRegistry = { schemaVersion: 1, driver: DRIVER, devices: leanDevices };
const deviceEntries = leanDevices.map((d, i) => `  ${d.key}: REGISTRY.devices[${i}],`).join('\n');
const deviceKeyUnion = leanDevices.map(d => `'${d.key}'`).join(' | ');
const devicesBody = `// AUTO-GENERATED by scripts/compile-data.mjs from data/devices/*.json5.
// Edit those files, not this one. Run \`pnpm run compile-data\`.

import type { DeviceEntry, DeviceRegistry } from '@thermal-label/contracts';

/**
 * Render-time effective status — superset of the contracts' stored
 * verification rungs that includes \`'expected'\` (propagated lift)
 * and \`'unverified'\` (no claim). Mirrors \`EffectiveStatus\` in
 * @thermal-label/contracts ≥ 0.6; literal here so codegen does not
 * require the matching contracts version on consumers' machines.
 */
export type EffectiveStatus = 'verified' | 'partial' | 'unsupported' | 'expected' | 'unverified';

/** Each entry carries a rolled-up \`supportStatus\` from the verification grid. */
export type RegistryDeviceEntry = DeviceEntry & { supportStatus: EffectiveStatus };

/** Registry shape with \`supportStatus\` stamped on each device. */
export type RegistryWithStatus = Omit<DeviceRegistry, 'devices'> & {
  devices: readonly RegistryDeviceEntry[];
};

export const REGISTRY = ${JSON.stringify(leanRegistry, null, 2)} as const satisfies RegistryWithStatus;

export type DeviceKey = ${deviceKeyUnion};

export const DEVICES: Record<DeviceKey, RegistryDeviceEntry> = {
${deviceEntries}
};
`;
writeFileSync(DEVICES_TS, devicesBody);

// Strip `key` (map key, not part of the descriptor) and emit each entry
// re-indented to fit one indent level inside the MEDIA object literal.
function emitMediaEntry(entry) {
  const { key: _key, ...rest } = entry;
  const inner = JSON.stringify(rest, null, 2).replace(/\n/g, '\n  ');
  return `  ${entry.key}: ${inner},`;
}
const mediaEntriesObj = mediaList.map(emitMediaEntry).join('\n');
const mediaKeyUnion = mediaList.map(m => `'${m.key}'`).join(' | ');
const mediaBody = `// AUTO-GENERATED by scripts/compile-data.mjs from data/media.json5.
// Edit that file, not this one. Run \`pnpm run compile-data\`.

import type { LabelWriterAnyMedia } from './types.js';

export type MediaKey = ${mediaKeyUnion};

export const MEDIA = {
${mediaEntriesObj}
} as const satisfies Record<MediaKey, LabelWriterAnyMedia>;
`;
writeFileSync(MEDIA_TS, mediaBody);

console.log(
  `[compile-data] OK — ${devices.length} devices + ${mediaList.length} media → ` +
    `${DEVICES_JSON}, ${MEDIA_JSON}, ${DEVICES_TS}, ${MEDIA_TS}`,
);
