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
  
  // UART Service UUID (Nordic UART Service)
  private readonly UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  
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
      
      // Request Bluetooth device
      // Запрос устройства - покажет ВСЕ доступные Bluetooth устройства
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
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
  }
  
  isConnected(): boolean {
    return this.device !== null && this.device.gatt !== undefined && this.device.gatt.connected;
  }
  
  private handleDataReceived(event: Event): void {
    const target = event.target as any;
    const value = target.value;
    
    if (!value) return;
    
    const data = new Uint8Array(value.buffer);
    const hexData = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    logService.info('BLE', `Raw data received (${data.length} bytes): ${hexData}`);
    console.log('📥 [BLE] Raw data received (' + data.length + ' bytes):', hexData);
    
    const packet = this.parsePacket(data);
    
    if (packet && packet.screen === 0xF1) {
      logService.success('BLE', 'Valid diagnostic packet parsed');
      console.log('📦 [BLE] Valid diagnostic packet parsed');
      // Парсим диагностические данные
      const diagnosticData = BluetoothDataParser.parseData(packet.data, this.systemType);
      if (diagnosticData) {
        this.latestData = diagnosticData;
        logService.success('BLE', 'Diagnostic data parsed successfully');
        console.log('✅ [BLE] Diagnostic data parsed successfully:', diagnosticData);
      } else {
        logService.warn('BLE', 'Failed to parse diagnostic data');
        console.warn('⚠️ [BLE] Failed to parse diagnostic data');
      }
    } else if (!packet) {
      logService.warn('BLE', 'Failed to parse packet');
      console.warn('⚠️ [BLE] Failed to parse packet');
    } else {
      logService.info('BLE', `Packet received for screen: 0x${packet.screen.toString(16).toUpperCase()}`);
      console.log('📦 [BLE] Packet received for screen:', '0x' + packet.screen.toString(16).toUpperCase());
    }
  }
  
  private parsePacket(data: Uint8Array): BluetoothPacket | null {
    // Check header
    if (data[0] !== 0x88) {
      logService.warn('BLE', `Invalid packet header: 0x${data[0].toString(16).toUpperCase()} (expected 0x88)`);
      console.warn('⚠️ [BLE] Invalid packet header: 0x' + data[0].toString(16).toUpperCase() + ' (expected 0x88)');
      return null;
    }
    
    const screen = data[1];
    const length = data[2];
    
    console.log('📦 [BLE] Parsing packet: Header=0x' + data[0].toString(16).toUpperCase() + 
                ', Screen=0x' + screen.toString(16).toUpperCase() + 
                ', Length=' + length);
    
    // Extract data
    const packetData = data.slice(3, 3 + length);
    const hexPacketData = Array.from(packetData).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    console.log('📦 [BLE] Packet data (' + length + ' bytes):', hexPacketData);
    
    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 3 + length; i++) {
      checksum += data[i];
    }
    checksum = checksum & 0xFF;
    
    const receivedChecksum = data[3 + length];
    
    console.log('🔐 [BLE] Checksum: calculated=0x' + checksum.toString(16).toUpperCase() + 
                ', received=0x' + receivedChecksum.toString(16).toUpperCase());
    
    if (checksum !== receivedChecksum) {
      console.warn('❌ [BLE] Checksum mismatch! Packet corrupted.');
      return null;
    }
    
    console.log('✅ [BLE] Packet valid');
    
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
    
    const hexPacket = Array.from(packet).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    const hexCommand = Array.from(commandData).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    
    logService.info('BLE', `Sending command to screen 0x${screen.toString(16).toUpperCase()}: [${hexCommand}]`);
    console.log('📤 [BLE] Sending command:');
    console.log('  Screen: 0x' + screen.toString(16).toUpperCase());
    console.log('  Command data: [' + hexCommand + ']');
    console.log('  Full packet (' + packet.length + ' bytes): [' + hexPacket + ']');
    console.log('  Checksum: 0x' + (checksum & 0xFF).toString(16).toUpperCase());
    
    await txCharacteristic.writeValue(packet);
    logService.success('BLE', 'Command sent successfully');
    console.log('✅ [BLE] Command sent successfully');
  }
  
  /**
   * Получает последние полученные диагностические данные
   */
  getLatestData(): DiagnosticData | null {
    return this.latestData;
  }
  
  /**
   * Запрашивает диагностические данные от БСКУ
   */
  async requestDiagnosticData(): Promise<void> {
    // Отправка команды запроса диагностики (экран 0xF1)
    const commandData = new Uint8Array([0x61, 0x01]);
    await this.sendCommand(0xF1, commandData);
  }

  /**
   * Переключает тестовый режим (флаг fTEST через бит 0x10 в iDAT_BIT)
   * @param enabled - включить/выключить тестовый режим
   */
  async setTestMode(enabled: boolean): Promise<void> {
    // Команда управления тестовым режимом
    const commandData = new Uint8Array([0x62, enabled ? 0x10 : 0x00]);
    await this.sendCommand(0xF1, commandData);
  }

  /**
   * Управление реле в тестовом режиме
   * @param switches - состояния переключателей (b_switch1 и b_switch2)
   * 
   * b_switch1 биты:
   * - bit 0: test flag
   * - bit 5: M1 (condenser fan 1)
   * - bit 6: M2 (condenser fan 2)
   * - bit 7: M3 (condenser fan 3)
   * 
   * b_switch2 биты:
   * - bit 0: M4 (evaporator fan 1)
   * - bit 1: M5 (evaporator fan 2)
   * - bit 2: Compressor
   */
  async controlRelays(relays: {
    M1?: boolean;
    M2?: boolean;
    M3?: boolean;
    M4?: boolean;
    M5?: boolean;
    CMP?: boolean;
  }): Promise<void> {
    let b_switch1 = 0x01; // Set test bit
    let b_switch2 = 0x00;

    // Set b_switch1 bits (M1, M2, M3)
    if (relays.M1) b_switch1 |= 0x20; // bit 5
    if (relays.M2) b_switch1 |= 0x40; // bit 6
    if (relays.M3) b_switch1 |= 0x80; // bit 7

    // Set b_switch2 bits (M4, M5, CMP)
    if (relays.M4) b_switch2 |= 0x01; // bit 0
    if (relays.M5) b_switch2 |= 0x02; // bit 1
    if (relays.CMP) b_switch2 |= 0x04; // bit 2

    const commandData = new Uint8Array([0x63, b_switch1, b_switch2]);
    await this.sendCommand(0xF1, commandData);
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
