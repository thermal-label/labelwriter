function findBulkEndpoints(device: USBDevice): { outNum: number; inNum: number } {
  const endpoints = device.configuration?.interfaces[0]?.alternate?.endpoints ?? [];
  const out = endpoints.find(e => e.direction === 'out');
  const inp = endpoints.find(e => e.direction === 'in');
  if (!out) throw new Error('No bulk OUT endpoint found on interface 0');
  if (!inp) throw new Error('No bulk IN endpoint found on interface 0');
  return { outNum: out.endpointNumber, inNum: inp.endpointNumber };
}

export class WebUsbTransport {
  private readonly outNum: number;
  private readonly inNum: number;

  constructor(private readonly device: USBDevice) {
    const { outNum, inNum } = findBulkEndpoints(device);
    this.outNum = outNum;
    this.inNum = inNum;
  }

  async write(data: Uint8Array): Promise<void> {
    await this.device.transferOut(this.outNum, data);
  }

  async read(byteCount: number): Promise<Uint8Array> {
    const result = await this.device.transferIn(this.inNum, byteCount);
    if (result.data) {
      const arr = new Uint8Array(result.data.buffer);
      return arr.slice(0, byteCount);
    }
    return new Uint8Array(byteCount);
  }

  async close(): Promise<void> {
    await this.device.releaseInterface(0);
    await this.device.close();
  }
}
