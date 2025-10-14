import { registerPlugin } from '@capacitor/core';

export interface BluetoothSerialPlugin {
  connect(opts: { mac: string; uuid?: string }): Promise<void>;
  write(opts: { data: string }): Promise<void>; // base64
  disconnect(): Promise<void>;
  addListener(event: 'data', cb: (ev: { data: string }) => void): Promise<void>; // <-- 'data'
}

export const BluetoothSerial = registerPlugin<BluetoothSerialPlugin>('BluetoothSerial');

export const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB';

// Base64 конвертеры (NO_WRAP)
export function toB64(u8: Uint8Array): string {
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

// Обёртка для удобства
export class NativeBluetoothWrapper {
  private onData?: (u8: Uint8Array) => void;

  async connect(mac: string): Promise<void> {
    // КРИТИЧНО: подписываемся ДО connect()
    await BluetoothSerial.addListener('data', ev => this.onData?.(fromB64(ev.data)));
    await BluetoothSerial.connect({ mac, uuid: SPP_UUID });
  }

  onBytes(cb: (u8: Uint8Array) => void): void {
    this.onData = cb;
  }

  async write(u8: Uint8Array): Promise<void> {
    await BluetoothSerial.write({ data: toB64(u8) });
  }

  async disconnect(): Promise<void> {
    try {
      await BluetoothSerial.disconnect();
    } catch {}
  }
}
