const OUT_ENDPOINT = 1;
const IN_ENDPOINT = 2;

export class WebUsbTransport {
  constructor(private readonly device: USBDevice) {}

  async write(data: Uint8Array): Promise<void> {
    await this.device.transferOut(OUT_ENDPOINT, data);
  }

  async read(byteCount: number): Promise<Uint8Array> {
    const result = await this.device.transferIn(IN_ENDPOINT, byteCount);
    if (result.data) {
      const arr = new Uint8Array(result.data.buffer);
      return arr.slice(0, byteCount);
    }
    return new Uint8Array(byteCount);
  }

  async close(): Promise<void> {
    await this.device.close();
  }
}
