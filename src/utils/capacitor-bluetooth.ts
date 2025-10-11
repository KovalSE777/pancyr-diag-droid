import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { DiagnosticData } from '@/types/bluetooth';

export class CapacitorBluetoothService {
  private deviceId: string | null = null;
  
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
  
  async connect(): Promise<boolean> {
    try {
      // Initialize BLE
      await this.initialize();
      
      // Request device with filter
      const device = await BleClient.requestDevice({
        namePrefix: 'Pantsir',
        optionalServices: [this.UART_SERVICE_UUID]
      });
      
      if (!device.deviceId) {
        throw new Error('No device selected');
      }
      
      this.deviceId = device.deviceId;
      
      // Connect to device
      await BleClient.connect(this.deviceId, () => {
        console.log('Device disconnected');
        this.deviceId = null;
      });
      
      // Start notifications
      await BleClient.startNotifications(
        this.deviceId,
        this.UART_SERVICE_UUID,
        this.UART_RX_CHAR_UUID,
        (value) => {
          this.handleDataReceived(value);
        }
      );
      
      return true;
    } catch (error) {
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
    // Convert DataView to Uint8Array
    const data = new Uint8Array(value.buffer);
    this.parsePacket(data);
  }
  
  private parsePacket(data: Uint8Array): void {
    // Check header (0x88)
    if (data[0] !== 0x88) {
      console.warn('Invalid packet header');
      return;
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
      return;
    }
    
    // Process packet based on screen number
    console.log('Received packet from screen:', screen, 'data:', packetData);
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
    
    // Convert to DataView
    const dataView = new DataView(packet.buffer);
    
    // Write to TX characteristic
    await BleClient.write(
      this.deviceId,
      this.UART_SERVICE_UUID,
      this.UART_TX_CHAR_UUID,
      dataView
    );
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
      
      // Fan counts - CRITICAL FIX: SKA has 3 condenser fans, SKE has 2
      // From C code: bBL_2=0 (SKA/Аппарат) => 3 fans (M1,M2,M3)
      //              bBL_2=1 (SKE/Экипаж) => 2 fans (M1,M2)
      kUM1_cnd: isSKE ? 2 : 3,
      kUM2_isp: 1,
      kUM3_cmp: 1,
      
      // Active fans
      n_V_cnd: isSKE ? 1 : 2,     // SKA: 2 of 3, SKE: 1 of 2
      n_V_isp: 1,
      n_V_cmp: 1,
      
      // PWM Speed
      PWM_spd: 2,
      
      // Detailed fan status - SKA has 3 fans, SKE has 2
      condenserFans: isSKE ? [
        { id: 1, status: 'ok' },
        { id: 2, status: 'error', errorMessage: 'Вентилятор конденсатора #2 не работает', repairHint: 'Проверьте питание и контакты вентилятора' }
      ] : [
        { id: 1, status: 'ok' },
        { id: 2, status: 'ok' },
        { id: 3, status: 'error', errorMessage: 'Вентилятор конденсатора #3 не работает', repairHint: 'Проверьте питание и контакты вентилятора' }
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
      
      systemType: 'SKA',
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
