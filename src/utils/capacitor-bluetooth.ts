import { BleClient } from '@capacitor-community/bluetooth-le';
import { DiagnosticData } from '@/types/bluetooth';
import { BluetoothDataParser } from './bluetooth-parser';
import { logService } from './log-service';

export class CapacitorBluetoothService {
  private deviceId: string | null = null;
  private latestData: DiagnosticData | null = null;
  private systemType: 'SKA' | 'SKE' = 'SKA';
  
  // UART Service UUID (Nordic UART Service)
  private readonly UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private readonly UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  
  async initialize(): Promise<void> {
    try {
      await BleClient.initialize();
    } catch (error) {
      console.error('BLE initialization failed:', error);
      throw error;
    }
  }
  
  async connect(systemType: 'SKA' | 'SKE' = 'SKA'): Promise<boolean> {
    try {
      this.systemType = systemType;
      logService.info('BLE Native', `Starting connection for system type: ${systemType}`);
      console.log('🔵 [BLE Native] Starting connection for system type:', systemType);
      
      // Initialize BLE
      await this.initialize();
      console.log('🔵 [BLE Native] BLE initialized');
      
      console.log('🔵 [BLE Native] Requesting device with UART service UUID:', this.UART_SERVICE_UUID);
      
      // Request device with filter
      // Запрос устройства - покажет ВСЕ доступные Bluetooth устройства
      const device = await BleClient.requestDevice({
        optionalServices: [this.UART_SERVICE_UUID]
      });
      
      if (!device.deviceId) {
        throw new Error('No device selected');
      }
      
      logService.success('BLE Native', `Device selected: ${device.name || device.deviceId}`);
      console.log('🔵 [BLE Native] Device selected:', device.name || device.deviceId);
      
      this.deviceId = device.deviceId;
      
      // Connect to device
      console.log('🔵 [BLE Native] Connecting to device...');
      await BleClient.connect(this.deviceId, () => {
        console.log('❌ [BLE Native] Device disconnected');
        this.deviceId = null;
      });
      console.log('🔵 [BLE Native] Device connected');
      
      // Start notifications
      console.log('🔵 [BLE Native] Starting notifications on RX characteristic:', this.UART_RX_CHAR_UUID);
      await BleClient.startNotifications(
        this.deviceId,
        this.UART_SERVICE_UUID,
        this.UART_RX_CHAR_UUID,
        (value) => {
          this.handleDataReceived(value);
        }
      );
      
      logService.success('BLE Native', 'Bluetooth connected successfully');
      logService.info('BLE Native', `TX UUID: ${this.UART_TX_CHAR_UUID}`);
      logService.info('BLE Native', `RX UUID: ${this.UART_RX_CHAR_UUID}`);
      console.log('✅ [BLE Native] Bluetooth connected successfully');
      console.log('🔵 [BLE Native] TX UUID:', this.UART_TX_CHAR_UUID);
      console.log('🔵 [BLE Native] RX UUID:', this.UART_RX_CHAR_UUID);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE Native', `Connection failed: ${errorMsg}`);
      console.error('Bluetooth connection failed:', error);
      return false;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.deviceId) {
      try {
        await BleClient.disconnect(this.deviceId);
        this.deviceId = null;
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
    }
  }
  
  isConnected(): boolean {
    return this.deviceId !== null;
  }
  
  private handleDataReceived(value: DataView): void {
    const data = new Uint8Array(value.buffer);
    const hexData = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    logService.info('BLE Native', `Raw data received (${data.length} bytes): ${hexData}`);
    console.log('📥 [BLE Native] Raw data received (' + data.length + ' bytes):', hexData);
    
    // Проверяем заголовок пакета
    if (data[0] !== 0x88) {
      console.warn('⚠️ [BLE Native] Invalid packet header: 0x' + data[0].toString(16).toUpperCase() + ' (expected 0x88)');
      return;
    }
    
    const screen = data[1];
    const length = data[2];
    const packetData = data.slice(3, 3 + length);
    
    console.log('📦 [BLE Native] Parsing packet: Header=0x' + data[0].toString(16).toUpperCase() + 
                ', Screen=0x' + screen.toString(16).toUpperCase() + 
                ', Length=' + length);
    
    const hexPacketData = Array.from(packetData).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    console.log('📦 [BLE Native] Packet data (' + length + ' bytes):', hexPacketData);
    
    // Проверяем контрольную сумму
    let checksum = 0;
    for (let i = 0; i < 3 + length; i++) {
      checksum += data[i];
    }
    checksum = checksum & 0xFF;
    
    const receivedChecksum = data[3 + length];
    
    console.log('🔐 [BLE Native] Checksum: calculated=0x' + checksum.toString(16).toUpperCase() + 
                ', received=0x' + receivedChecksum.toString(16).toUpperCase());
    
    if (checksum !== receivedChecksum) {
      console.warn('❌ [BLE Native] Checksum mismatch! Packet corrupted.');
      return;
    }
    
    console.log('✅ [BLE Native] Packet valid');
    
    // Парсим данные диагностики
    if (screen === 0xF1) {
      logService.success('BLE Native', 'Valid diagnostic packet parsed');
      console.log('📦 [BLE Native] Valid diagnostic packet parsed');
      const diagnosticData = BluetoothDataParser.parseData(packetData, this.systemType);
      if (diagnosticData) {
        this.latestData = diagnosticData;
        logService.success('BLE Native', 'Diagnostic data parsed successfully');
        console.log('✅ [BLE Native] Diagnostic data parsed successfully:', diagnosticData);
      } else {
        logService.warn('BLE Native', 'Failed to parse diagnostic data');
        console.warn('⚠️ [BLE Native] Failed to parse diagnostic data');
      }
    } else {
      logService.info('BLE Native', `Packet received for screen: 0x${screen.toString(16).toUpperCase()}`);
      console.log('📦 [BLE Native] Packet received for screen:', '0x' + screen.toString(16).toUpperCase());
    }
  }
  
  async sendCommand(screen: number, commandData: Uint8Array): Promise<void> {
    if (!this.deviceId) {
      throw new Error('Not connected');
    }
    
    // Build packet: [header, screen, length, ...data, checksum]
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
    
    logService.info('BLE Native', `Sending command to screen 0x${screen.toString(16).toUpperCase()}: [${hexCommand}]`);
    console.log('📤 [BLE Native] Sending command:');
    console.log('  Screen: 0x' + screen.toString(16).toUpperCase());
    console.log('  Command data: [' + hexCommand + ']');
    console.log('  Full packet (' + packet.length + ' bytes): [' + hexPacket + ']');
    console.log('  Checksum: 0x' + (checksum & 0xFF).toString(16).toUpperCase());
    
    // Convert to DataView
    const dataView = new DataView(packet.buffer);
    
    try {
      // Write to TX characteristic
      await BleClient.write(
        this.deviceId,
        this.UART_SERVICE_UUID,
        this.UART_TX_CHAR_UUID,
        dataView
      );
      logService.success('BLE Native', 'Command sent successfully');
      console.log('✅ [BLE Native] Command sent successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE Native', `Failed to send command: ${errorMsg}`);
      console.error('❌ [BLE Native] Failed to send command:', error);
      throw error;
    }
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
