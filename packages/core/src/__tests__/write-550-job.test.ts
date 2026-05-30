import { describe, expect, it } from 'vitest';
import type { Transport } from '@thermal-label/contracts';
import {
  build550StatusRequest,
  compose550Job,
  STATUS_BYTE_COUNT_550,
  write550Job,
  type Composed550Job,
} from '../protocol-550.js';
import { DEVICES } from '../devices.js';
import { createBitmap } from '@mbtech-nl/bitmap';

interface RecordedOp {
  kind: 'write' | 'read';
  /** For writes: bytes sent. For reads: requested byte count. */
  data: Uint8Array | number;
  /** For reads: the timeout argument the loop passed, if any. */
  timeout?: number;
}

/**
 * Minimal `Transport` double for orchestration assertions — records
 * every call in order, satisfies reads with a canned 32-byte status
 * frame, and never throws.
 */
function recordingTransport(): { transport: Transport; ops: RecordedOp[] } {
  const ops: RecordedOp[] = [];
  const transport: Transport = {
    connected: true,
    write(data) {
      ops.push({ kind: 'write', data: Uint8Array.from(data) });
      return Promise.resolve();
    },
    read(length, timeout) {
      const op: RecordedOp = { kind: 'read', data: length };
      if (timeout !== undefined) op.timeout = timeout;
      ops.push(op);
      // Canned 32-byte status: byte 0 = 0 (idle), rest zero.
      return Promise.resolve(new Uint8Array(STATUS_BYTE_COUNT_550));
    },
    close() {
      return Promise.resolve();
    },
  };
  return { transport, ops };
}

function lw550Job(copies: number): Composed550Job {
  const dev = DEVICES.LW_550;
  const headDots = dev.engines[0]!.headDots;
  // Tiny bitmap — sized to the head so the encoder fast-paths without
  // any pad/crop work. Content irrelevant for orchestration tests.
  const bitmap = createBitmap(headDots, 4);
  return compose550Job(dev, bitmap, { copies });
}

describe('write550Job', () => {
  it('writes preamble first, then per-label segment + ESC A, then finalize', async () => {
    const job = lw550Job(1);
    const { transport, ops } = recordingTransport();
    await write550Job(transport, job);

    // 1 copy → preamble, segment, ESC A 0, read, finalize = 5 ops.
    expect(ops).toHaveLength(5);
    expect(ops[0]).toMatchObject({ kind: 'write', data: job.preamble });
    expect(ops[1]).toMatchObject({ kind: 'write', data: job.labels[0]! });
    expect(ops[2]).toMatchObject({ kind: 'write', data: build550StatusRequest(0) });
    expect(ops[3]).toMatchObject({ kind: 'read', data: STATUS_BYTE_COUNT_550 });
    expect(ops[4]).toMatchObject({ kind: 'write', data: job.finalize });
  });

  it('multi-label: ESC A lock byte is 2 between labels and 0 on the last', async () => {
    const job = lw550Job(3);
    const { transport, ops } = recordingTransport();
    await write550Job(transport, job);

    const escAs = ops.filter(
      (op): op is RecordedOp & { data: Uint8Array } =>
        op.kind === 'write' &&
        op.data instanceof Uint8Array &&
        op.data.length === 3 &&
        op.data[0] === 0x1b &&
        op.data[1] === 0x41,
    );
    expect(escAs).toHaveLength(3);
    expect(escAs[0]!.data[2]).toBe(2); // between
    expect(escAs[1]!.data[2]).toBe(2); // between
    expect(escAs[2]!.data[2]).toBe(0); // final
  });

  it('multi-label: between-label status reads are deferred to the next iteration', async () => {
    // The loop writes ESC A 2 after each non-final label but DOES NOT
    // block on its reply — the read happens once, just before the
    // next label's segment ships. The final label's ESC A 0 is read
    // synchronously after that segment's handshake write.
    const job = lw550Job(3);
    const { transport, ops } = recordingTransport();
    await write550Job(transport, job);

    // Pull the order of read operations relative to writes.
    const order = ops.map(op => op.kind);
    // Expected shape for 3 copies:
    //   write preamble
    //   write segment[0]
    //   write ESC A 2
    //   read (deferred reply for label 0, drained before label 1)
    //   write segment[1]
    //   write ESC A 2
    //   read (deferred reply for label 1, drained before label 2)
    //   write segment[2]
    //   write ESC A 0
    //   read (final reply)
    //   write finalize
    expect(order).toEqual([
      'write', // preamble
      'write', // segment[0]
      'write', // ESC A 2
      'read', // deferred drain for label 0
      'write', // segment[1]
      'write', // ESC A 2
      'read', // deferred drain for label 1
      'write', // segment[2]
      'write', // ESC A 0
      'read', // final
      'write', // finalize
    ]);
  });

  it('passes handshakeReadTimeoutMs through to every transport.read', async () => {
    const job = lw550Job(2);
    const { transport, ops } = recordingTransport();
    await write550Job(transport, job, { handshakeReadTimeoutMs: 12345 });
    const reads = ops.filter(op => op.kind === 'read');
    expect(reads).toHaveLength(2);
    expect(reads.every(op => op.timeout === 12345)).toBe(true);
  });

  it('omits the timeout when no option is supplied (transport-default deadline)', async () => {
    const job = lw550Job(1);
    const { transport, ops } = recordingTransport();
    await write550Job(transport, job);
    const reads = ops.filter(op => op.kind === 'read');
    expect(reads).toHaveLength(1);
    expect(reads[0]!.timeout).toBeUndefined();
  });
});
