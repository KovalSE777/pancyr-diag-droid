import { BleClient } from '@capacitor-community/bluetooth-le';
import { DiagnosticData } from '@/types/bluetooth';
import { BluetoothDataParser } from './bluetooth-parser';
import { logService } from './log-service';

export class CapacitorBluetoothService {
  private deviceId: string | null = null;
  private latestData: DiagnosticData | null = null;
  private systemType: 'SKA' | 'SKE' = 'SKA';
  private keepAliveInterval: any = null;
  
  // UART profiles (defaults to Nordic NUS; will auto-detect HM-10 too)
  private UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  // HM-10 (FFE0/FFE1)
  private readonly HM10_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  private readonly HM10_DATA_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  // UDS protocol addresses
  private readonly BSKU_ADDRESS = 0x2A;
  private readonly TESTER_ADDRESS = 0xF1;

  // RX packet assembly buffer and helpers
  private rxBuffer: number[] = [];
  private toHex(bytes: ArrayLike<number>): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }
  
  async initialize(): Promise<void> {
    try {
      await BleClient.initialize();
    } catch (error) {
      console.error('BLE initialization failed:', error);
      throw error;
    }
  }

  // Helpers
  private to128(uuid: string): string {
    if (!uuid) return uuid as string;
    const u = uuid.toLowerCase();
    if (u.includes('-')) return u;
    const short = u.replace(/^0x/, '').padStart(4, '0');
    return `0000${short}-0000-1000-8000-00805f9b34fb`;
  }

  private isUuid(a: string, b: string): boolean {
    return this.to128(a) === this.to128(b);
  }
  
  async connect(systemType: 'SKA' | 'SKE' = 'SKA'): Promise<boolean> {
    try {
      this.systemType = systemType;
      logService.info('BLE Native', `Starting connection for system type: ${systemType}`);
      console.log('🔵 [BLE Native] Starting connection for system type:', systemType);
      
      // Initialize BLE
      await this.initialize();
      console.log('🔵 [BLE Native] BLE initialized');
      
      console.log('🔵 [BLE Native] Starting BLE scan (all devices)...');
      
      // Scan for all BLE devices (no filter)
      const devices: Array<{deviceId: string, name?: string, rssi?: number}> = [];
      
      await BleClient.requestLEScan({}, (result) => {
        const exists = devices.find(d => d.deviceId === result.device.deviceId);
        if (!exists) {
          devices.push({
            deviceId: result.device.deviceId,
            name: result.device.name,
            rssi: result.rssi
          });
          console.log('🔵 [BLE Native] Found device:', result.device.name || result.device.deviceId, 'RSSI:', result.rssi);
        }
      });
      
      // Scan for 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      await BleClient.stopLEScan();
      
      console.log(`🔵 [BLE Native] Scan complete. Found ${devices.length} devices`);
      // removed verbose scan log
      
      if (devices.length === 0) {
        throw new Error('Устройства не найдены. Убедитесь, что Bluetooth включен на БСКУ.');
      }
      
      // Prepare candidate list (prefer stronger RSSI)
      const bleDevices = [...devices].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
      
      // Log top candidate
      const top = bleDevices[0];
      const selectedName = top ? (top.name || top.deviceId) : 'unknown';
      // removed verbose scan log
      console.log('🔵 [BLE Native] Top candidate:', selectedName, 'RSSI:', top?.rssi);
      
      // Try to connect to candidates and detect UART profile (Nordic NUS or HM-10 FFE0/FFE1)
      for (const candidate of bleDevices) {
        try {
          console.log('🔵 [BLE Native] Trying device:', candidate.name || candidate.deviceId);
          await BleClient.connect(candidate.deviceId, () => {
            console.log('❌ [BLE Native] Device disconnected');
            if (this.deviceId === candidate.deviceId) this.deviceId = null;
          });

          const services = await BleClient.getServices(candidate.deviceId);
          const serviceUuids = services.map(s => s.uuid.toLowerCase());
          console.log('🔵 [BLE Native] Services:', serviceUuids);

          // Detect profile
          let profile: 'NUS' | 'HM10' | null = null;
          let rxChar: string | null = null;
          let txChar: string | null = null;
          let svcUuid: string | null = null;

          for (const s of services) {
            const su = s.uuid.toLowerCase();
            // Nordic NUS
            if (this.isUuid(su, '6e400001-b5a3-f393-e0a9-e50e24dcca9e')) {
              const rx = s.characteristics?.find(c => this.isUuid(c.uuid, '6e400003-b5a3-f393-e0a9-e50e24dcca9e'));
              const tx = s.characteristics?.find(c => this.isUuid(c.uuid, '6e400002-b5a3-f393-e0a9-e50e24dcca9e'));
              if (rx && tx) {
                profile = 'NUS';
                rxChar = this.to128('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
                txChar = this.to128('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
                svcUuid = this.to128('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
                break;
              }
            }
            // HM-10 (FFE0/FFE1/FFE2) — detect by properties, not fixed roles
            if (this.isUuid(su, 'ffe0')) {
              const chars = s.characteristics || [];
              const ffe1 = chars.find((c: any) => this.isUuid(c.uuid, 'ffe1')) as any;
              const ffe2 = chars.find((c: any) => this.isUuid(c.uuid, 'ffe2')) as any;

              const describe = (c: any) => c ? `r=${!!c.properties?.read} w=${!!c.properties?.write} wn=${!!c.properties?.writeWithoutResponse} n=${!!c.properties?.notify}` : 'absent';
              logService.info('BLE Native', `HM10 props ffe1[${describe(ffe1)}] ffe2[${describe(ffe2)}]`);

              // RX = characteristic with NOTIFY
              let rx = [ffe1, ffe2].find((c: any) => c && c.properties?.notify) || null;
              // TX = characteristic with WRITE/WRITE_NO_RESP not equal to RX; fallback to RX if only one char
              let tx = [ffe1, ffe2].find((c: any) => c && (c.properties?.write || c.properties?.writeWithoutResponse) && c !== rx) || rx;

              if (rx) {
                profile = 'HM10';
                rxChar = this.to128((rx as any).uuid);
                txChar = this.to128(((tx as any)?.uuid) || (rx as any).uuid);
                svcUuid = this.to128('ffe0');
                break;
              }

              // Fallbacks (very old clones): only ffe1 exists
              if (ffe1) {
                profile = 'HM10';
                rxChar = this.to128('ffe1');
                txChar = this.to128('ffe1');
                svcUuid = this.to128('ffe0');
                break;
              }
            }
          }

          if (profile) {
            // Save selected device and profile
            this.deviceId = candidate.deviceId;
            this.UART_SERVICE_UUID = svcUuid!;
            this.UART_RX_CHAR_UUID = rxChar!;
            this.UART_TX_CHAR_UUID = txChar!;
            logService.success('BLE Native', `Profile detected: ${profile}. Service=${this.UART_SERVICE_UUID}, RX=${this.UART_RX_CHAR_UUID}, TX=${this.UART_TX_CHAR_UUID}`);
            console.log('✅ [BLE Native] Profile detected:', profile);

            // Start notifications
            await BleClient.startNotifications(
              this.deviceId,
              this.UART_SERVICE_UUID,
              this.UART_RX_CHAR_UUID,
              (value) => this.handleDataReceived(value)
            );
            logService.success('BLE Native', `notifications started: svc=${this.UART_SERVICE_UUID} rx=${this.UART_RX_CHAR_UUID}`);

            // Send StartCommunication command
            await this.sendStartCommunication();
            
            // Start keep-alive TesterPresent
            this.startKeepAlive();

            logService.success('BLE Native', 'Bluetooth connected successfully');
            return true;
          }

          // No profile -> disconnect and try next
          await BleClient.disconnect(candidate.deviceId).catch(() => {});
          console.warn('⚠️ [BLE Native] UART profile not found on device; trying next');
        } catch (e) {
          console.warn('⚠️ [BLE Native] Failed to connect candidate, trying next:', e);
          try { await BleClient.disconnect(candidate.deviceId); } catch {}
        }
      }

      throw new Error('Подходящий BLE UART сервис не найден. Проверьте, что модуль поддерживает Nordic NUS или HM-10 (FFE0/FFE1).');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE Native', `Connection failed: ${errorMsg}`);
      console.error('Bluetooth connection failed:', error);
      return false;
    }
  }

  async connectToDeviceId(deviceId: string, systemType: 'SKA' | 'SKE' = 'SKA'): Promise<boolean> {
    try {
      this.systemType = systemType;
      logService.info('BLE Native', `Connecting to chosen device: ${deviceId}`);
      await this.initialize();

      await BleClient.connect(deviceId, () => {
        console.log('❌ [BLE Native] Device disconnected');
        if (this.deviceId === deviceId) this.deviceId = null;
      });

      const services = await BleClient.getServices(deviceId);
      const serviceUuids = services.map(s => s.uuid.toLowerCase());
      console.log('🔵 [BLE Native] Services (selected):', serviceUuids);

      let profile: 'NUS' | 'HM10' | null = null;
      let rxChar: string | null = null;
      let txChar: string | null = null;
      let svcUuid: string | null = null;

      for (const s of services) {
        const su = s.uuid.toLowerCase();
        // Nordic NUS
        if (this.isUuid(su, '6e400001-b5a3-f393-e0a9-e50e24dcca9e')) {
          const rx = s.characteristics?.find(c => this.isUuid(c.uuid, '6e400003-b5a3-f393-e0a9-e50e24dcca9e'));
          const tx = s.characteristics?.find(c => this.isUuid(c.uuid, '6e400002-b5a3-f393-e0a9-e50e24dcca9e'));
          if (rx && tx) {
            profile = 'NUS';
            rxChar = this.to128('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
            txChar = this.to128('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
            svcUuid = this.to128('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
            break;
          }
        }
        // HM-10 (FFE0/FFE1/FFE2) — detect by properties
        if (this.isUuid(su, 'ffe0')) {
          const chars = s.characteristics || [];
          const ffe1 = chars.find((c: any) => this.isUuid(c.uuid, 'ffe1')) as any;
          const ffe2 = chars.find((c: any) => this.isUuid(c.uuid, 'ffe2')) as any;

          const describe = (c: any) => c ? `r=${!!c.properties?.read} w=${!!c.properties?.write} wn=${!!c.properties?.writeWithoutResponse} n=${!!c.properties?.notify}` : 'absent';
          logService.info('BLE Native', `HM10 props ffe1[${describe(ffe1)}] ffe2[${describe(ffe2)}]`);

          let rx = [ffe1, ffe2].find((c: any) => c && c.properties?.notify) || null;
          let tx = [ffe1, ffe2].find((c: any) => c && (c.properties?.write || c.properties?.writeWithoutResponse) && c !== rx) || rx;

          if (rx) {
            profile = 'HM10';
            rxChar = this.to128((rx as any).uuid);
            txChar = this.to128(((tx as any)?.uuid) || (rx as any).uuid);
            svcUuid = this.to128('ffe0');
            break;
          }

          if (ffe1) {
            profile = 'HM10';
            rxChar = this.to128('ffe1');
            txChar = this.to128('ffe1');
            svcUuid = this.to128('ffe0');
            break;
          }
        }
      }

      if (profile) {
        this.deviceId = deviceId;
        this.UART_SERVICE_UUID = svcUuid!;
        this.UART_RX_CHAR_UUID = rxChar!;
        this.UART_TX_CHAR_UUID = txChar!;
        logService.success('BLE Native', `Profile detected: ${profile}. Service=${this.UART_SERVICE_UUID}, RX=${this.UART_RX_CHAR_UUID}, TX=${this.UART_TX_CHAR_UUID}`);

        await BleClient.startNotifications(
          this.deviceId,
          this.UART_SERVICE_UUID,
          this.UART_RX_CHAR_UUID,
            (value) => this.handleDataReceived(value)
          );
          logService.success('BLE Native', `notifications started: svc=${this.UART_SERVICE_UUID} rx=${this.UART_RX_CHAR_UUID}`);

          // Send StartCommunication command
          await this.sendStartCommunication();
          
          // Start keep-alive TesterPresent
          this.startKeepAlive();

          logService.success('BLE Native', 'Bluetooth connected successfully');
          return true;
      }

      await BleClient.disconnect(deviceId).catch(() => {});
      logService.error('BLE Native', 'UART profile not found on selected device');
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE Native', `Connection failed: ${errorMsg}`);
      try { await BleClient.disconnect(deviceId); } catch {}
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Stop keep-alive
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.deviceId) {
      try {
        await BleClient.disconnect(this.deviceId);
        this.deviceId = null;
        logService.info('BLE Native', 'Disconnected');
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
    }
  }
  
  isConnected(): boolean {
    return this.deviceId !== null;
  }
  
  private handleDataReceived(value: DataView): void {
    const chunk = new Uint8Array(value.buffer);
    logService.info('BLE-RX', `chunk ${chunk.length}b: ${this.toHex(chunk)}`);

    // Append chunk to buffer and try to assemble full UDS packets
    this.rxBuffer.push(...Array.from(chunk));

    while (this.rxBuffer.length >= 4) {
      // UDS packet: [LEN] [DST] [SRC] [service+data...] [checksum]
      // LEN byte: 0x80 | (N-2), where N = number of bytes from DST to last data byte before checksum
      
      const lenByte = this.rxBuffer[0];
      
      // Check if valid UDS length byte (bit 7 must be set)
      if ((lenByte & 0x80) === 0) {
        const dropped = this.rxBuffer.shift()!;
        logService.warn('BLE-RX', `desync: drop 0x${dropped.toString(16).toUpperCase()} (not UDS len)`);
        continue;
      }

      const dataLen = (lenByte & 0x3F) + 2; // N = (LEN & 0x3F) + 2
      const totalLen = dataLen + 2; // LEN byte + DST...data bytes + checksum

      if (this.rxBuffer.length < totalLen) {
        // Wait for more data
        break;
      }

      const packet = this.rxBuffer.slice(0, totalLen);
      this.rxBuffer = this.rxBuffer.slice(totalLen);

      // Verify checksum: sum of all bytes except last one
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

      // Parse ReadDataByLocalIdentifier response (0x21 0x01)
      if (service === 0x21 && packet[4] === 0x01) {
        const body = new Uint8Array(packet.slice(5, totalLen - 1));
        const diagnosticData = BluetoothDataParser.parseData(body, this.systemType);
        if (diagnosticData) {
          this.latestData = diagnosticData;
          logService.success('BLE-RX', 'diagnostic parsed from UDS');
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
   * Format: [LEN] [DST=0x2A] [SRC=0xF1] [service+data...] [checksum]
   * LEN = 0x80 | (N-2), where N = number of bytes from DST to last data byte
   */
  private async sendUDSCommand(serviceData: number[]): Promise<void> {
    if (!this.deviceId) {
      throw new Error('Not connected');
    }
    
    const N = serviceData.length + 2; // DST + SRC + service+data
    const lenByte = 0x80 | ((N - 2) & 0x3F);
    
    const packet = [lenByte, this.BSKU_ADDRESS, this.TESTER_ADDRESS, ...serviceData];
    
    // Calculate checksum: sum of all bytes
    const checksum = packet.reduce((sum, b) => (sum + b) & 0xff, 0);
    packet.push(checksum);
    
    const data = new Uint8Array(packet);
    const hexPacket = this.toHex(data);
    
    logService.info('BLE-TX', `UDS packet ${data.length}b: ${hexPacket}`);
    
    const dataView = new DataView(data.buffer);
    
    try {
      try {
        await BleClient.write(
          this.deviceId,
          this.UART_SERVICE_UUID,
          this.UART_TX_CHAR_UUID,
          dataView
        );
      } catch (primaryError) {
        await BleClient.writeWithoutResponse(
          this.deviceId!,
          this.UART_SERVICE_UUID,
          this.UART_TX_CHAR_UUID,
          dataView
        );
      }
      logService.success('BLE-TX', 'sent');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE-TX', `send failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Send StartCommunication (0x81)
   * Packet: 83 2A F1 81 1F
   */
  private async sendStartCommunication(): Promise<void> {
    logService.info('BLE-TX', 'Sending StartCommunication (0x81)');
    await this.sendUDSCommand([0x81]);
  }

  /**
   * Start keep-alive timer (TesterPresent every 1.5 seconds)
   * Packet: 83 2A F1 3E 01 DD
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
    // Legacy method - now unused, kept for compatibility
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
   * Packet: 83 2A F1 21 01 C0
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
    // TODO: implement test mode control via UDS if supported
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
    // TODO: implement relay control via UDS if supported
  }
  
  // Mock data for testing
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
      
      // Fan counts - Updated mapping: SKE (Экипаж) has 3 condenser fans, SKA (Аппарат) has 2
      // From C code variant: bBL_2 mapping refined per latest files
      kUM1_cnd: isSKE ? 3 : 2,
      kUM2_isp: 1,
      kUM3_cmp: 1,
      
      // Active fans (mock)
      n_V_cnd: isSKE ? 2 : 1,     // SKE: 2 of 3, SKA: 1 of 2
      n_V_isp: 1,
      n_V_cmp: 1,
      
      // PWM Speed
      PWM_spd: 2,
      
      // Detailed fan status - SKE has 3 fans, SKA has 2
      condenserFans: isSKE ? [
        { id: 1, status: 'ok' },
        { id: 2, status: 'ok' },
        { id: 3, status: 'error', errorMessage: 'Вентилятор конденсатора #3 не работает', repairHint: 'Проверьте питание и контакты вентилятора' }
      ] : [
        { id: 1, status: 'ok' },
        { id: 2, status: 'error', errorMessage: 'Вентилятор конденсатора #2 не работает', repairHint: 'Проверьте питание и контакты вентилятора' }
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
      
      // Soft start signals (УПП)
      signal_SVD: true,
      signal_ContactNorm: true,
      
      systemType: systemType.toUpperCase() as 'SKA' | 'SKE',
      mode: 'cooling',
      sSTATUS: 0x42,
      
      errors: [
        {
          code: 'F03',
          severity: 'warning',
          component: 'Предохранитель испарителя (Pr3)',
          description: 'Предохранитель испарителя перегорел',
          suggestedFix: 'Замените предохранитель Pr3'
        }
      ]
    };
  }
}

export const capacitorBluetoothService = new CapacitorBluetoothService();
