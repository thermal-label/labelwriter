import { describe, expect, it, vi } from 'vitest';

let connectCallback: (() => void) | undefined;
const dataListeners: ((chunk: Buffer) => void)[] = [];

const mockSocket = {
  connect: vi.fn((port: number, host: string) => {
    setImmediate(() => {
      connectCallback?.();
    });
    return { port, host };
  }),
  write: vi.fn((data: Buffer, cb: (err?: Error) => void) => {
    cb();
    return data;
  }),
  end: vi.fn((cb: () => void) => {
    cb();
  }),
  on: vi.fn((event: string, cb: (arg: Buffer) => void) => {
    if (event === 'data') dataListeners.push(cb);
    return mockSocket;
  }),
  once: vi.fn((event: string, cb: (arg?: Error) => void) => {
    if (event === 'connect')
      connectCallback = () => {
        cb();
      };
    return mockSocket;
  }),
  removeListener: vi.fn(() => mockSocket),
};

vi.mock('node:net', () => ({
  default: {
    Socket: vi.fn(() => mockSocket),
  },
}));

import { TcpTransport } from '../transport.js';

describe('TcpTransport', () => {
  it('connects to host:port', async () => {
    const transport = await TcpTransport.connect('192.168.1.1', 9100);
    expect(mockSocket.connect).toHaveBeenCalledWith(9100, '192.168.1.1');
    await transport.close();
  });

  it('uses default port 9100', async () => {
    const transport = await TcpTransport.connect('192.168.1.1');
    expect(mockSocket.connect).toHaveBeenCalledWith(9100, '192.168.1.1');
    await transport.close();
  });

  it('write sends data via socket', async () => {
    const transport = await TcpTransport.connect('192.168.1.1');
    const data = new Uint8Array([0x1b, 0x40]);
    await transport.write(data);
    expect(mockSocket.write).toHaveBeenCalled();
    await transport.close();
  });

  it('read accumulates data chunks until byteCount received', async () => {
    const transport = await TcpTransport.connect('192.168.1.1');

    const readPromise = transport.read(3);

    const listener = dataListeners.at(-1);
    setImmediate(() => {
      listener?.(Buffer.from([0x01]));
      listener?.(Buffer.from([0x02, 0x03]));
    });

    const result = await readPromise;
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(3);
    expect(Array.from(result)).toEqual([0x01, 0x02, 0x03]);

    await transport.close();
  });
});
