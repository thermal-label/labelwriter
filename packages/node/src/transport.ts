/* eslint-disable import-x/consistent-type-specifier-style */
import net from 'node:net';
import * as usb from 'usb';
import type { InEndpoint, Interface, OutEndpoint } from 'usb';

export interface Transport {
  write(data: Uint8Array): Promise<void>;
  read(byteCount: number): Promise<Uint8Array>;
  close(): Promise<void>;
}

const PRINTER_INTERFACE = 0;

function findBulkOut(iface: Interface): OutEndpoint {
  const ep = iface.endpoints.find(e => e.direction === 'out');
  if (!ep) throw new Error('No bulk OUT endpoint found on interface');
  return ep as OutEndpoint;
}

function findBulkIn(iface: Interface): InEndpoint {
  const ep = iface.endpoints.find(e => e.direction === 'in');
  if (!ep) throw new Error('No bulk IN endpoint found on interface');
  return ep as InEndpoint;
}

export class UsbTransport implements Transport {
  private constructor(
    private readonly device: usb.Device,
    private readonly iface: Interface,
    private readonly out: OutEndpoint,
    private readonly inp: InEndpoint,
  ) {}

  static open(vid: number, pid: number): UsbTransport {
    const device = usb.findByIds(vid, pid);
    if (!device) throw new Error(`USB device ${vid.toString(16)}:${pid.toString(16)} not found`);

    device.open();
    const iface = device.interface(PRINTER_INTERFACE);

    if (process.platform === 'linux' && iface.isKernelDriverActive()) {
      iface.detachKernelDriver();
    }

    iface.claim();
    const out = findBulkOut(iface);
    const inp = findBulkIn(iface);

    return new UsbTransport(device, iface, out, inp);
  }

  async write(data: Uint8Array): Promise<void> {
    await this.out.transferAsync(Buffer.from(data));
  }

  async read(byteCount: number): Promise<Uint8Array> {
    const buf = await this.inp.transferAsync(byteCount);
    return new Uint8Array(buf ?? Buffer.alloc(0));
  }

  async close(): Promise<void> {
    await this.iface.releaseAsync();
    this.device.close();
  }
}

export class TcpTransport implements Transport {
  private constructor(private readonly socket: net.Socket) {}

  static async connect(host: string, port = 9100): Promise<TcpTransport> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.once('connect', () => {
        resolve(new TcpTransport(socket));
      });
      socket.once('error', reject);
      socket.connect(port, host);
    });
  }

  async write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(Buffer.from(data), err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async read(byteCount: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let received = 0;

      const onData = (chunk: Buffer): void => {
        chunks.push(chunk);
        received += chunk.length;
        if (received >= byteCount) {
          this.socket.removeListener('data', onData);
          this.socket.removeListener('error', onError);
          resolve(new Uint8Array(Buffer.concat(chunks).subarray(0, byteCount)));
        }
      };

      const onError = (err: Error): void => {
        this.socket.removeListener('data', onData);
        reject(err);
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
    });
  }

  async close(): Promise<void> {
    return new Promise(resolve => {
      this.socket.end(() => {
        resolve();
      });
    });
  }
}
