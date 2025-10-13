/// <reference path="../types/web-bluetooth.d.ts" />
import { DiagnosticData, BluetoothPacket } from '@/types/bluetooth';
import { BluetoothDataParser } from './bluetooth-parser';
import { logService } from './log-service';

export class PantsirBluetoothService {
  private device: any = null;
  private characteristic: any = null;
  private server: any = null;
  private latestData: DiagnosticData | null = null;
  private systemType: 'SKA' | 'SKE' = 'SKA';
  private keepAliveInterval: any = null;
  private pollInterval: any = null;
  private lastRxAt: number = 0;
  private rxBuffer: number[] = [];
  
  // UART Service UUID (Nordic UART Service)
  private readonly UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  
  // UDS protocol addresses (from firmware pprpzu_45k22_Blt_Pancir-7.c)
  private readonly BSKU_ADDRESS = 0x28;  // ECU address (DST in request)
  private readonly TESTER_ADDRESS = 0xF0; // Tester address (SRC in request)
  
  async connect(systemType: 'SKA' | 'SKE' = 'SKA'): Promise<boolean> {
    try {
      this.systemType = systemType;
      logService.info('BLE', `Starting connection for system type: ${systemType}`);
      console.log('🔵 [BLE] Starting connection for system type:', systemType);
      
      // Check if Bluetooth is available
      if (!('bluetooth' in navigator)) {
        throw new Error('Web Bluetooth API not supported');
      }

      logService.info('BLE', `Requesting device with UART service UUID: ${this.UART_SERVICE_UUID}`);
      console.log('🔵 [BLE] Requesting device with UART service UUID:', this.UART_SERVICE_UUID);
      
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [this.UART_SERVICE_UUID] }],
        optionalServices: [this.UART_SERVICE_UUID]
      });
      
      logService.success('BLE', `Device selected: ${this.device.name}`);
      console.log('🔵 [BLE] Device selected:', this.device.name);
      
      if (!this.device.gatt) {
        throw new Error('GATT not supported');
      }
      
      // Connect to GATT server
      console.log('🔵 [BLE] Connecting to GATT server...');
      this.server = await this.device.gatt.connect();
      console.log('🔵 [BLE] GATT server connected');
      
      // Get UART service
      console.log('🔵 [BLE] Getting UART service...');
      const service = await this.server.getPrimaryService(this.UART_SERVICE_UUID);
      console.log('🔵 [BLE] UART service obtained');
      
      // Get TX and RX characteristics
      console.log('🔵 [BLE] Getting RX characteristic (UUID:', this.UART_RX_CHAR_UUID + ')');
      this.characteristic = await service.getCharacteristic(this.UART_RX_CHAR_UUID);
      console.log('🔵 [BLE] RX characteristic obtained');
      
      // Start notifications
      console.log('🔵 [BLE] Starting notifications...');
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', 
        this.handleDataReceived.bind(this));
      
      logService.success('BLE', 'Bluetooth connected successfully');
      logService.info('BLE', `TX UUID: ${this.UART_TX_CHAR_UUID}`);
      logService.info('BLE', `RX UUID: ${this.UART_RX_CHAR_UUID}`);
      console.log('✅ [BLE] Bluetooth connected successfully');
      console.log('🔵 [BLE] TX UUID:', this.UART_TX_CHAR_UUID);
      console.log('🔵 [BLE] RX UUID:', this.UART_RX_CHAR_UUID);
      
      // Send StartCommunication command
      await this.sendStartCommunication();
      
      // Start keep-alive TesterPresent
      this.startKeepAlive();
      
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE', `Connection failed: ${errorMsg}`);
      console.error('Bluetooth connection failed:', error);
      return false;
    }
  }
  
  async disconnect(): Promise<void> {
    // Stop keep-alive
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
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
  
  private toHex(bytes: ArrayLike<number>): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }
  
  private handleDataReceived(event: Event): void {
    const target = event.target as any;
    const value = target.value;
    
    if (!value) return;
    
    const chunk = new Uint8Array(value.buffer);
    logService.info('BLE-RX', `chunk ${chunk.length}b: ${this.toHex(chunk)}`);

    // Append chunk to buffer and try to assemble full UDS packets
    this.rxBuffer.push(...Array.from(chunk));

    while (this.rxBuffer.length >= 4) {
      // UDS packet: [LEN] [DST] [SRC] [service+data...] [checksum]
      const lenByte = this.rxBuffer[0];
      
      // Check if valid UDS length byte (bit 7 must be set)
      if ((lenByte & 0x80) === 0) {
        const dropped = this.rxBuffer.shift()!;
        logService.warn('BLE-RX', `desync: drop 0x${dropped.toString(16).toUpperCase()} (not UDS len)`);
        continue;
      }

      const dataLen = (lenByte & 0x3F) + 2;
      const totalLen = dataLen + 2;

      if (this.rxBuffer.length < totalLen) {
        break;
      }

      const packet = this.rxBuffer.slice(0, totalLen);
      this.rxBuffer = this.rxBuffer.slice(totalLen);

      const calc = packet.slice(0, totalLen - 1).reduce((sum, b) => (sum + b) & 0xff, 0);
      const recv = packet[totalLen - 1];

      logService.info('BLE-RX', `UDS packet ${totalLen}b: ${this.toHex(packet)} | sum(calc)=0x${calc.toString(16).toUpperCase()} sum(recv)=0x${recv.toString(16).toUpperCase()}`);

      if (calc !== recv) {
        logService.error('BLE-RX', 'checksum mismatch, packet discarded');
        continue;
      }

      const dst = packet[1];
      const src = packet[2];
      const service = packet[3];

      logService.info('BLE-RX', `UDS: DST=0x${dst.toString(16).toUpperCase()} SRC=0x${src.toString(16).toUpperCase()} service=0x${service.toString(16).toUpperCase()}`);

      // Firmware sends response with DST=0xF1, SRC=0x28
      // Verify this is a response meant for us
      if (dst !== 0xF1 || src !== 0x28) {
        logService.warn('BLE-RX', `Unexpected addresses DST=0x${dst.toString(16).toUpperCase()} SRC=0x${src.toString(16).toUpperCase()}, expected DST=0xF1 SRC=0x28`);
      }

      // Parse ReadDataByLocalIdentifier response (0x61 = positive response to 0x21)
      // Firmware responds with 0x61 for successful readDataByLocalIdentifier (see line 715 in firmware)
      if (service === 0x61 && packet.length >= 6) {
        // Data starts at index 4 (after LEN, DST, SRC, SERVICE)
        const body = new Uint8Array(packet.slice(4, totalLen - 1));
        const diagnosticData = BluetoothDataParser.parseData(body, this.systemType);
        if (diagnosticData) {
          this.latestData = diagnosticData;
          logService.success('BLE-RX', `diagnostic parsed from UDS (${body.length} bytes)`);
        } else {
          logService.warn('BLE-RX', 'diagnostic parse failed');
        }
      } else {
        logService.info('BLE-RX', `UDS response service=0x${service.toString(16).toUpperCase()}`);
      }
    }
  }
  
  /**
   * Send UDS-format command
   */
  private async sendUDSCommand(serviceData: number[]): Promise<void> {
    if (!this.server || !this.characteristic) {
      throw new Error('Not connected');
    }
    
    const service = await this.server.getPrimaryService(this.UART_SERVICE_UUID);
    const txCharacteristic = await service.getCharacteristic(this.UART_TX_CHAR_UUID);
    
    const N = serviceData.length + 2;
    const lenByte = 0x80 | ((N - 2) & 0x3F);
    
    const packet = [lenByte, this.BSKU_ADDRESS, this.TESTER_ADDRESS, ...serviceData];
    const checksum = packet.reduce((sum, b) => (sum + b) & 0xff, 0);
    packet.push(checksum);
    
    const data = new Uint8Array(packet);
    logService.info('BLE-TX', `UDS packet ${data.length}b: ${this.toHex(data)}`);
    
    await txCharacteristic.writeValue(data);
    logService.success('BLE-TX', 'sent');
  }

  /**
   * Send StartCommunication (0x81)
   */
  private async sendStartCommunication(): Promise<void> {
    logService.info('BLE-TX', 'Sending StartCommunication (0x81)');
    await this.sendUDSCommand([0x81]);
  }

  /**
   * Start keep-alive timer (TesterPresent every 1.5 seconds)
   */
  private startKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    this.keepAliveInterval = setInterval(async () => {
      try {
        logService.info('BLE-TX', 'Sending TesterPresent (keep-alive)');
        await this.sendUDSCommand([0x3E, 0x01]);
      } catch (e) {
        logService.error('BLE-TX', 'TesterPresent failed');
      }
    }, 1500);
  }

  async sendCommand(screen: number, commandData: Uint8Array): Promise<void> {
    // Legacy method - now unused
    throw new Error('sendCommand is deprecated, use UDS protocol methods');
  }
  
  /**
   * Получает последние полученные диагностические данные
   */
  getLatestData(): DiagnosticData | null {
    return this.latestData;
  }
  
  /**
   * Request diagnostic data (ReadDataByLocalIdentifier 0x21 0x01)
   */
  async requestDiagnosticData(): Promise<void> {
    logService.info('BLE-TX', 'Requesting diagnostic data (0x21 0x01)');
    await this.sendUDSCommand([0x21, 0x01]);
  }

  /**
   * Set test mode (legacy - needs UDS implementation)
   */
  async setTestMode(enabled: boolean): Promise<void> {
    logService.warn('BLE-TX', 'setTestMode not yet implemented for UDS protocol');
  }

  /**
   * Control relays in test mode (legacy - needs UDS implementation)
   */
  async controlRelays(relays: {
    M1?: boolean;
    M2?: boolean;
    M3?: boolean;
    M4?: boolean;
    M5?: boolean;
    CMP?: boolean;
  }): Promise<void> {
    logService.warn('BLE-TX', 'controlRelays not yet implemented for UDS protocol');
  }
  
  // Mock data for testing when Bluetooth is not available
  getMockData(systemType: string = 'SKA'): DiagnosticData {
    const isSKE = systemType.toUpperCase() === 'SKE';
    
    return {
      // Current measurements
      UP_M1: 27.5,
      UP_M2: 26.8,
      UP_M3: 27.1,
      UP_M4: 27.3,
      UP_M5: 27.0,
      
      // Voltage drops
      dUP_M1: 1.2,
      dUP_M2: 0.8,
      dUP_M3: 1.5,
      
      // Temperatures
      T_air: 22.5,    // Air temperature
      T_isp: -5.2,    // Evaporator temperature
      T_kmp: 45.8,    // Compressor temperature
      
      // System voltages and pressure
      U_nap: 27.4,    // Power supply voltage
      U_davl: 156,    // Pressure sensor (0-255)
      
      // Fan counts - Updated mapping: SKE (Экипаж) has 3 condenser fans, SKA (Аппарат) has 2
      // From C code variant: bBL_2 mapping refined per latest files
      kUM1_cnd: isSKE ? 3 : 2,
      kUM2_isp: 1,
      kUM3_cmp: 1,
      
      // Active fans (mock)
      n_V_cnd: isSKE ? 2 : 1,     // SKE: 2 of 3, SKA: 1 of 2 condenser fans working
      n_V_isp: 1,
      n_V_cmp: 1,
      
      // PWM Speed
      PWM_spd: 2,     // Fast speed
      
      // Detailed fan status - SKE has 3 fans, SKA has 2
      condenserFans: isSKE ? [
        { id: 1, status: 'ok' },
        { id: 2, status: 'ok' },
        { id: 3, status: 'error', errorMessage: 'Вентилятор конденсатора #3 не работает', repairHint: 'Проверьте питание и контакты вентилятора. Замените вентилятор при необходимости.' }
      ] : [
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
      
      // Component diagnostics (zmk/obr)
      zmk_V_isp1: false,
      obr_V_isp1: false,
      zmk_V_knd1: false,
      obr_V_knd1: true,   // Condenser fan 2 has break
      zmk_COMP: false,
      obr_COMP: false,
      
      // Working modes
      work_rej_cnd: 2,    // Working
      work_rej_isp: 2,    // Working
      work_rej_cmp: 2,    // Working
      
      // Fuses
      fuseEtalon: true,
      fuseCondenser: true,
      fuseEvaporator: false, // One fuse failed for demo
      fuseCompressor: true,
      
      // Soft start signals (УПП) - simulating compressor startup sequence
      signal_SVD: true,           // Photodiode signal (1st signal)
      signal_ContactNorm: true,   // Contact normal (2nd signal after SVD)
      
      systemType: systemType.toUpperCase() as 'SKA' | 'SKE',
      mode: 'cooling',
      sSTATUS: 0x42,      // System status byte
      
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
