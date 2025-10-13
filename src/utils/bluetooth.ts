/// <reference path="../types/web-bluetooth.d.ts" />
import { DiagnosticData } from '@/types/bluetooth';
import { ProtocolParser, ParsedFrame } from './protocol-parser';
import { Screen4Parser } from './screen4-parser';
import { appendChecksum, toHex } from './checksum';
import { logService } from './log-service';

export class PantsirBluetoothService {
  private device: any = null;
  private characteristic: any = null;
  private server: any = null;
  private latestData: DiagnosticData | null = null;
  private systemType: 'SKA' | 'SKE' = 'SKA';
  private parser: ProtocolParser = new ProtocolParser();
  
  // UART Service UUID (Nordic UART Service)
  private readonly UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  
  // UDS protocol addresses (опциональные, если нужно инициировать опрос ЭБУ)
  // Согласно документу "Главное.docx" §4
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
      
      // Get RX characteristic
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
      
      logService.info('BLE', 'Waiting for 0x88 telemetry frames from BSKU...');
      console.log('🔵 [BLE] Waiting for 0x88 telemetry frames from BSKU...');
      
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE', `Connection failed: ${errorMsg}`);
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
    this.parser.clearBuffer();
  }
  
  isConnected(): boolean {
    return this.device !== null && this.device.gatt !== undefined && this.device.gatt.connected;
  }
  
  private handleDataReceived(event: Event): void {
    const target = event.target as any;
    const value = target.value;
    
    if (!value) return;
    
    const chunk = new Uint8Array(value.buffer);
    logService.info('BLE-RX', `chunk ${chunk.length}b: ${toHex(chunk)}`);

    // Передаем данные в парсер с callback
    this.parser.feed(chunk, (frame) => this.handleParsedFrame(frame));
  }

  private handleParsedFrame(frame: ParsedFrame): void {
    // Кадр 0x88 - телеметрия экрана
    if (frame.type === 'TEL_88') {
      const nScr = frame.info?.nScr;
      logService.success('PROTO', `✓ 0x88 Screen=${nScr}, CHK=${frame.ok ? 'OK' : 'FAIL'}`);
      
      if (nScr === 4 && frame.ok) {
        // Парсим экран 4
        const diagnosticData = Screen4Parser.parse(frame.raw.slice(3, 3 + (frame.raw[2] & 0xFF)), this.systemType);
        if (diagnosticData) {
          this.latestData = diagnosticData;
          logService.success('BLE-RX', 'Screen 4 data parsed successfully');
          console.log('✅ [BLE-RX] Diagnostic data updated:', diagnosticData);
        } else {
          logService.warn('BLE-RX', 'Screen 4 parse failed');
        }
      }
    }

    // Кадр 0x66 - запрос экрана
    else if (frame.type === 'SCR_66') {
      const nScr = frame.info?.nScr ?? 0;
      logService.success('PROTO', `✓ 0x66 SCR_${nScr}`);
      
      // Отправляем ответ UOKS
      this.sendASCII(`UOKS${String.fromCharCode(nScr)}`).catch(e => 
        logService.error('BLE-TX', `UOKS send failed: ${e}`)
      );
    }

    // Кадр 0x77 - конфигурация
    else if (frame.type === 'CFG_77') {
      const nPak = frame.info?.nPak ?? 0;
      logService.success('PROTO', `✓ 0x77 Package=${nPak}, CHK=${frame.ok ? 'OK' : 'FAIL'}`);
      
      // Отправляем ответ UOKP
      this.sendASCII(`UOKP${String.fromCharCode(nPak)}`).catch(e =>
        logService.error('BLE-TX', `UOKP send failed: ${e}`)
      );
    }

    // UDS кадры
    else if (frame.type === 'UDS_80P') {
      const dst = frame.info?.dst ?? 0;
      const src = frame.info?.src ?? 0;
      const sid = frame.info?.sid ?? 0;
      
      if (dst === 0xF1 && src === 0x28) {
        logService.success('BLE-RX', `✓ UDS Response: DST=0x${dst.toString(16).toUpperCase()} SRC=0x${src.toString(16).toUpperCase()} SID=0x${sid.toString(16).toUpperCase()}, CHK=${frame.ok ? 'OK' : 'FAIL'}`);
      } else {
        logService.info('BLE-RX', `UDS: DST=0x${dst.toString(16).toUpperCase()} SRC=0x${src.toString(16).toUpperCase()} SID=0x${sid.toString(16).toUpperCase()}, CHK=${frame.ok ? 'OK' : 'FAIL'}`);
      }
    }
    
    else if (!frame.ok) {
      logService.error('PROTO', `✗ Checksum FAIL`);
    }
  }

  /**
   * Отправка ASCII команды (для UOKS/UOKP)
   */
  private async sendASCII(text: string): Promise<void> {
    if (!this.server || !this.characteristic) {
      throw new Error('Not connected');
    }
    
    const service = await this.server.getPrimaryService(this.UART_SERVICE_UUID);
    const txCharacteristic = await service.getCharacteristic(this.UART_TX_CHAR_UUID);
    
    const bytes = new TextEncoder().encode(text);
    logService.info('BLE-TX', `ASCII: "${text}" (${toHex(bytes)})`);
    
    await txCharacteristic.writeValue(bytes);
    logService.success('BLE-TX', 'ASCII sent');
  }

  /**
   * Send UDS-format command (опционально)
   * Format: [HDR] [DST=0x28] [SRC=0xF0] [service+data...] [checksum]
   * Согласно документу "Главное.docx" §4
   */
  private async sendUDSCommand(serviceData: number[]): Promise<void> {
    if (!this.server || !this.characteristic) {
      throw new Error('Not connected');
    }
    
    const service = await this.server.getPrimaryService(this.UART_SERVICE_UUID);
    const txCharacteristic = await service.getCharacteristic(this.UART_TX_CHAR_UUID);
    
    const N = serviceData.length + 2; // DST + SRC + serviceData
    const hdr = 0x80 | ((N - 2) & 0x3F);
    
    const packet = [hdr, this.BSKU_ADDRESS, this.TESTER_ADDRESS, ...serviceData];
    const fullPacket = appendChecksum(packet);
    
    const data = new Uint8Array(fullPacket);
    logService.info('BLE-TX', `UDS packet ${data.length}b: ${toHex(data)}`);
    
    await txCharacteristic.writeValue(data);
    logService.success('BLE-TX', 'UDS sent');
  }

  /**
   * Получает последние полученные диагностические данные
   */
  getLatestData(): DiagnosticData | null {
    return this.latestData;
  }

  /**
   * Request diagnostic data via UDS (опционально)
   */
  async requestDiagnosticData(): Promise<void> {
    logService.info('BLE-TX', 'Requesting diagnostic data via UDS (0x21 0x01)');
    await this.sendUDSCommand([0x21, 0x01]);
  }

  /**
   * Set test mode (legacy - needs implementation)
   */
  async setTestMode(enabled: boolean): Promise<void> {
    logService.warn('BLE-TX', 'setTestMode not yet implemented');
  }

  /**
   * Control relays in test mode (legacy - needs implementation)
   */
  async controlRelays(relays: {
    M1?: boolean;
    M2?: boolean;
    M3?: boolean;
    M4?: boolean;
    M5?: boolean;
    CMP?: boolean;
  }): Promise<void> {
    logService.warn('BLE-TX', 'controlRelays not yet implemented');
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
      T_air: 22.5,
      T_isp: -5.2,
      T_kmp: 45.8,
      
      // System voltages and pressure
      U_nap: 27.4,
      U_davl: 156,
      
      // Fan counts
      kUM1_cnd: isSKE ? 3 : 2,
      kUM2_isp: 1,
      kUM3_cmp: 1,
      
      // Active fans
      n_V_cnd: isSKE ? 2 : 1,
      n_V_isp: 1,
      n_V_cmp: 1,
      
      // PWM Speed
      PWM_spd: 2,
      
      // Detailed fan status
      condenserFans: isSKE ? [
        { id: 1, status: 'ok' },
        { id: 2, status: 'ok' },
        { id: 3, status: 'error', errorMessage: 'Вентилятор конденсатора #3 не работает', repairHint: 'Проверьте питание и контакты вентилятора.' }
      ] : [
        { id: 1, status: 'ok' },
        { id: 2, status: 'error', errorMessage: 'Вентилятор конденсатора #2 не работает', repairHint: 'Проверьте питание и контакты вентилятора.' }
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
      
      // Component diagnostics
      zmk_V_isp1: false,
      obr_V_isp1: false,
      zmk_V_knd1: false,
      obr_V_knd1: true,
      zmk_COMP: false,
      obr_COMP: false,
      
      // Working modes
      work_rej_cnd: 2,
      work_rej_isp: 2,
      work_rej_cmp: 2,
      
      // Fuses
      fuseEtalon: true,
      fuseCondenser: true,
      fuseEvaporator: false,
      fuseCompressor: true,
      
      // Soft start signals
      signal_SVD: true,
      signal_ContactNorm: true,
      
      // New protocol fields
      cikl_COM: 42,
      cikl_K_line: 38,
      s1_TMR2: 120,
      s0_TMR2: 80,
      edlt_cnd_i: 25,
      edlt_isp_i: 20,
      edlt_cmp_i: 30,
      timer_off: 0,
      
      systemType: systemType.toUpperCase() as 'SKA' | 'SKE',
      mode: 'cooling',
      sSTATUS: 0x42,
      
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
