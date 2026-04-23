export type NetworkSupport = 'none' | 'wifi' | 'wired';

export type Density = 'light' | 'medium' | 'normal' | 'high';

export interface DeviceDescriptor {
  name: string;
  vid: number;
  pid: number;
  headDots: number;
  bytesPerRow: number;
  protocol: '450' | '550';
  network: NetworkSupport;
  nfcLock: boolean;
}

export interface PrintOptions {
  density?: Density;
  mode?: 'text' | 'graphics';
  compress?: boolean;
  copies?: number;
  roll?: 0 | 1;
  jobId?: number;
}
