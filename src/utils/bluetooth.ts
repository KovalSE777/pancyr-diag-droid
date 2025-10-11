/// <reference path="../types/web-bluetooth.d.ts" />
import { DiagnosticData, BluetoothPacket } from '@/types/bluetooth';

export class PantsirBluetoothService {
  private device: any = null;
  private characteristic: any = null;
  private server: any = null;
  
  // UART Service UUID (Nordic UART Service)
  private readonly UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  
  async connect(): Promise<boolean> {
    try {
      // Check if Bluetooth is available
      if (!('bluetooth' in navigator)) {
        throw new Error('Web Bluetooth API not supported');
      }

      // Request Bluetooth device
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: 'Pantsir' },
          { namePrefix: 'BSKU' }
        ],
        optionalServices: [this.UART_SERVICE_UUID]
      });
      
      if (!this.device.gatt) {
        throw new Error('GATT not supported');
      }
      
      // Connect to GATT server
      this.server = await this.device.gatt.connect();
      
      // Get UART service
      const service = await this.server.getPrimaryService(this.UART_SERVICE_UUID);
      
      // Get TX and RX characteristics
      this.characteristic = await service.getCharacteristic(this.UART_RX_CHAR_UUID);
      
      // Start notifications
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', 
        this.handleDataReceived.bind(this));
      
      return true;
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      return false;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.characteristic) {
      await this.characteristic.stopNotifications();
      this.characteristic.removeEventListener('characteristicvaluechanged', 
        this.handleDataReceived.bind(this));
    }
    
    if (this.server) {
      this.server.disconnect();
    }
    
    this.device = null;
    this.characteristic = null;
    this.server = null;
  }
  
  isConnected(): boolean {
    return this.device !== null && this.device.gatt !== undefined && this.device.gatt.connected;
  }
  
  private handleDataReceived(event: Event): void {
    const target = event.target as any;
    const value = target.value;
    
    if (!value) return;
    
    const data = new Uint8Array(value.buffer);
    this.parsePacket(data);
  }
  
  private parsePacket(data: Uint8Array): BluetoothPacket | null {
    // Check header
    if (data[0] !== 0x88) {
      console.warn('Invalid packet header');
      return null;
    }
    
    const screen = data[1];
    const length = data[2];
    
    // Extract data
    const packetData = data.slice(3, 3 + length);
    
    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 3 + length; i++) {
      checksum += data[i];
    }
    checksum = checksum & 0xFF;
    
    const receivedChecksum = data[3 + length];
    
    if (checksum !== receivedChecksum) {
      console.warn('Checksum mismatch');
      return null;
    }
    
    return {
      header: data[0],
      screen,
      length,
      data: packetData,
      checksum: receivedChecksum
    };
  }
  
  async sendCommand(screen: number, commandData: Uint8Array): Promise<void> {
    if (!this.server || !this.characteristic) {
      throw new Error('Not connected');
    }
    
    const service = await this.server.getPrimaryService(this.UART_SERVICE_UUID);
    const txCharacteristic = await service.getCharacteristic(this.UART_TX_CHAR_UUID);
    
    // Build packet
    const packet = new Uint8Array(4 + commandData.length);
    packet[0] = 0x88;
    packet[1] = screen;
    packet[2] = commandData.length;
    packet.set(commandData, 3);
    
    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 3 + commandData.length; i++) {
      checksum += packet[i];
    }
    packet[3 + commandData.length] = checksum & 0xFF;
    
    await txCharacteristic.writeValue(packet);
  }
  
  // Mock data for testing when Bluetooth is not available
  getMockData(): DiagnosticData {
    return {
      UP_M1: 27.5,
      UP_M2: 26.8,
      UP_M3: 27.1,
      UP_M4: 27.3,
      UP_M5: 27.0,
      dUP_M1: 1.2,
      dUP_M2: 0.8,
      dUP_M3: 1.5,
      kUM1_cnd: 2,
      kUM2_isp: 1,
      kUM3_cmp: 1,
      
      // Detailed fan status
      condenserFans: [
        { id: 1, status: 'ok' },
        { id: 2, status: 'error', errorMessage: 'Вентилятор конденсатора #2 не работает', repairHint: 'Проверьте питание и контакты вентилятора. Замените вентилятор при необходимости.' }
      ],
      evaporatorFans: [
        { id: 1, status: 'ok' }
      ],
      compressorFans: [
        { id: 1, status: 'ok' }
      ],
      
      // Component status
      compressorStatus: 'ok',
      condenserStatus: 'ok',
      evaporatorStatus: 'ok',
      pressureSensorStatus: 'ok',
      softStartStatus: 'ok',
      
      fuseEtalon: true,
      fuseCondenser: true,
      fuseEvaporator: false, // One fuse failed for demo
      fuseCompressor: true,
      systemType: 'SKE',
      mode: 'cooling',
      errors: [
        {
          code: 'F03',
          severity: 'warning',
          component: 'Предохранитель испарителя (Pr3)',
          description: 'Предохранитель испарителя перегорел',
          suggestedFix: 'Замените предохранитель Pr3. Проверьте нагрузку испарителя перед включением.'
        }
      ]
    };
  }
}

export const bluetoothService = new PantsirBluetoothService();
