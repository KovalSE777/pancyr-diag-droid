import { registerPlugin } from '@capacitor/core';

export interface BluetoothSerialPlugin {
  connect(opts: { mac: string; uuid?: string }): Promise<void>;
  write(opts: { data: string }): Promise<void>; // base64
  disconnect(): Promise<void>;
  scan(): Promise<{ devices: Array<{ address: string; name: string }> }>;
  addListener(event: 'data' | 'connectionLost', cb: (ev?: any) => void): Promise<void>;
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
  private onLost?: () => void;
  private listenerAdded = false;

  async connect(mac: string): Promise<void> {
    // Проверяем формат MAC-адреса
    if (!/^[0-9A-Fa-f:]{17}$/.test(mac)) {
      throw new Error(`MAC not set or invalid: "${mac}"`);
    }
    
    // КРИТИЧНО: подписываемся ДО connect() только один раз
    if (!this.listenerAdded) {
      await BluetoothSerial.addListener('data', ev => this.onData?.(fromB64(ev.data)));
      await BluetoothSerial.addListener('connectionLost', () => this.onLost?.());
      this.listenerAdded = true;
    }
    
    await BluetoothSerial.connect({ mac, uuid: SPP_UUID });
  }

  onBytes(cb: (u8: Uint8Array) => void): void {
    this.onData = cb;
  }

  onConnectionLost(cb: () => void): void {
    this.onLost = cb;
  }

  async write(u8: Uint8Array): Promise<void> {
    await BluetoothSerial.write({ data: toB64(u8) });
  }

  async disconnect(): Promise<void> {
    try {
      await BluetoothSerial.disconnect();
      this.listenerAdded = false;
    } catch {}
  }
}
