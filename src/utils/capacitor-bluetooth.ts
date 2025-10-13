import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { DiagnosticData } from '@/types/bluetooth';
import { ProtocolParser, Frame0x88, Frame0x66, Frame0x77 } from './protocol-parser';
import { Screen4Parser } from './screen4-parser';
import { appendChecksum, toHex } from './checksum';
import { logService } from './log-service';

export class CapacitorBluetoothService {
  private deviceAddress: string | null = null;
  private latestData: DiagnosticData | null = null;
  private systemType: 'SKA' | 'SKE' = 'SKA';
  private parser: ProtocolParser = new ProtocolParser();
  private testerPresentInterval: number | null = null;
  private connectionEstablished: boolean = false;
  private readInterval: number | null = null;
  
  private readonly BSKU_ADDRESS = 0x28;
  private readonly TESTER_ADDRESS = 0xF0;
  private readonly EXPECTED_DST = 0xF1;
  private readonly EXPECTED_SRC = 0x28;
  
  async initialize(): Promise<void> {
    try {
      const result = await BluetoothSerial.isEnabled();
      if (!result.enabled) {
        await BluetoothSerial.enable();
      }
      logService.success('BT Serial', 'Bluetooth enabled');
    } catch (error) {
      console.error('BT Serial initialization failed:', error);
      throw error;
    }
  }

  async connect(systemType: 'SKA' | 'SKE' = 'SKA'): Promise<boolean> {
    try {
      this.systemType = systemType;
      await this.initialize();
      
      const result = await BluetoothSerial.scan();
      const devices = result.devices || [];
      
      if (devices.length === 0) {
        throw new Error('Нет доступных Bluetooth устройств');
      }
      
      for (const device of devices) {
        try {
          const success = await this.connectToDeviceId(device.address, systemType);
          if (success) return true;
        } catch (err) {
          continue;
        }
      }
      
      throw new Error('Не удалось подключиться');
    } catch (error) {
      logService.error('BT Serial', `Connection failed: ${error}`);
      return false;
    }
  }

  async connectToDeviceId(deviceAddress: string, systemType: 'SKA' | 'SKE' = 'SKA'): Promise<boolean> {
    try {
      this.systemType = systemType;
      await this.initialize();
      await BluetoothSerial.connect({ address: deviceAddress });
      
      this.deviceAddress = deviceAddress;
      this.startReading();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      await this.sendStartCommunication();
      
      this.connectionEstablished = true;
      this.startTesterPresent();
      
      logService.success('BT Serial', 'Connected');
      return true;
    } catch (error) {
      logService.error('BT Serial', `Connection failed: ${error}`);
      return false;
    }
  }

  private startReading(): void {
    this.readInterval = window.setInterval(async () => {
      if (!this.deviceAddress) return;
      
      try {
        const result = await BluetoothSerial.read();
        if (result.data) {
          const bytes = this.hexToBytes(result.data);
          logService.info('BT-RX', `${bytes.length}b: ${toHex(bytes)}`);
          this.parser.addData(bytes);
          
          let frame;
          while ((frame = this.parser.parseNextFrame()) !== null) {
            this.handleParsedFrame(frame);
          }
        }
      } catch (err) {
        // Нет данных
      }
    }, 100);
  }

  async disconnect(): Promise<void> {
    this.stopTesterPresent();
    if (this.readInterval) clearInterval(this.readInterval);
    
    if (this.deviceAddress) {
      try {
        await BluetoothSerial.disconnect({ address: this.deviceAddress });
        this.deviceAddress = null;
        this.connectionEstablished = false;
        this.parser.clearBuffer();
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
    }
  }
  
  isConnected(): boolean {
    return this.deviceAddress !== null && this.connectionEstablished;
  }

  private hexToBytes(hex: string): Uint8Array {
    const cleaned = hex.replace(/\s/g, '');
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.substr(i, 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array | number[]): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private handleParsedFrame(frame: any): void {
    if (frame.type === 0x88) {
      const f = frame as Frame0x88;
      if (f.screen === 4) {
        const diagnosticData = Screen4Parser.parse(f.payload, this.systemType);
        if (diagnosticData) {
          this.latestData = diagnosticData;
          logService.success('BT-RX', 'Screen 4 parsed');
        }
      }
    }
    else if (frame.type === 0x66) {
      const f = frame as Frame0x66;
      this.sendASCII(`UOKS${String.fromCharCode(f.screen)}`).catch(() => {});
    }
    else if (frame.type === 0x77) {
      const f = frame as Frame0x77;
      this.sendASCII(`UOKP${String.fromCharCode(f.packageNum)}`).catch(() => {});
    }
    else if (frame.type === 'UDS') {
      if (frame.dst === this.EXPECTED_DST && frame.src === this.EXPECTED_SRC) {
        logService.success('BT-RX', `UDS: SID=0x${frame.sid.toString(16).toUpperCase()}`);
      }
    }
  }

  private async sendASCII(text: string): Promise<void> {
    if (!this.deviceAddress) throw new Error('Not connected');
    const bytes = new TextEncoder().encode(text);
    await BluetoothSerial.write({ value: this.bytesToHex(bytes) });
  }

  private async sendUDSCommand(serviceData: number[]): Promise<void> {
    if (!this.deviceAddress) throw new Error('Not connected');
    const N = serviceData.length + 2;
    const hdr = 0x80 | ((N - 2) & 0x3F);
    const packet = [hdr, this.BSKU_ADDRESS, this.TESTER_ADDRESS, ...serviceData];
    const fullPacket = appendChecksum(packet);
    logService.info('BT-TX', `UDS: ${toHex(fullPacket)}`);
    await BluetoothSerial.write({ value: this.bytesToHex(fullPacket) });
  }

  private async sendStartCommunication(): Promise<void> {
    await this.sendUDSCommand([0x81]);
  }

  private async sendTesterPresent(): Promise<void> {
    await this.sendUDSCommand([0x3E, 0x01]);
  }

  private startTesterPresent(): void {
    this.stopTesterPresent();
    this.testerPresentInterval = window.setInterval(() => {
      if (this.isConnected()) {
        this.sendTesterPresent().catch(() => {});
      }
    }, 1500);
  }

  private stopTesterPresent(): void {
    if (this.testerPresentInterval) clearInterval(this.testerPresentInterval);
  }

  getLatestData(): DiagnosticData | null {
    return this.latestData;
  }

  async requestDiagnosticData(): Promise<void> {
    await this.sendUDSCommand([0x21, 0x01]);
  }

  async setTestMode(enabled: boolean): Promise<void> {
    logService.warn('BT-TX', 'setTestMode not implemented yet');
  }

  async controlRelays(relays: any): Promise<void> {
    logService.warn('BT-TX', 'controlRelays not implemented yet');
  }

  getMockData(systemType: string = 'SKA'): DiagnosticData {
    const isSKE = systemType.toUpperCase() === 'SKE';
    return {
      UP_M1: 27.5, UP_M2: 26.8, UP_M3: 27.1, UP_M4: 27.3, UP_M5: 27.0,
      dUP_M1: 1.2, dUP_M2: 0.8, dUP_M3: 1.5,
      T_air: 22.5, T_isp: -5.2, T_kmp: 45.8,
      U_nap: 27.4, U_davl: 156,
      kUM1_cnd: isSKE ? 3 : 2, kUM2_isp: 1, kUM3_cmp: 1,
      n_V_cnd: isSKE ? 2 : 1, n_V_isp: 1, n_V_cmp: 1,
      PWM_spd: 2,
      condenserFans: isSKE ? [
        { id: 1, status: 'ok' }, { id: 2, status: 'ok' },
        { id: 3, status: 'error', errorMessage: 'Вентилятор конденсатора #3 не работает', repairHint: 'Проверьте питание' }
      ] : [
        { id: 1, status: 'ok' },
        { id: 2, status: 'error', errorMessage: 'Вентилятор конденсатора #2 не работает', repairHint: 'Проверьте питание' }
      ],
      evaporatorFans: [{ id: 1, status: 'ok' }],
      compressorFans: [{ id: 1, status: 'ok' }],
      compressorStatus: 'ok', condenserStatus: 'ok', evaporatorStatus: 'ok',
      pressureSensorStatus: 'ok', softStartStatus: 'ok',
      zmk_V_isp1: false, obr_V_isp1: false, zmk_V_knd1: false, obr_V_knd1: true,
      zmk_COMP: false, obr_COMP: false,
      work_rej_cnd: 2, work_rej_isp: 2, work_rej_cmp: 2,
      fuseEtalon: true, fuseCondenser: true, fuseEvaporator: false, fuseCompressor: true,
      signal_SVD: true, signal_ContactNorm: true,
      cikl_COM: 42, cikl_K_line: 38, s1_TMR2: 120, s0_TMR2: 80,
      edlt_cnd_i: 25, edlt_isp_i: 20, edlt_cmp_i: 30, timer_off: 0,
      systemType: systemType.toUpperCase() as 'SKA' | 'SKE',
      mode: 'cooling', sSTATUS: 0x42,
      errors: [{ code: 'F03', severity: 'warning', component: 'Предохранитель испарителя (Pr3)',
        description: 'Предохранитель испарителя перегорел', suggestedFix: 'Замените предохранитель Pr3' }]
    };
  }
}

export const capacitorBluetoothService = new CapacitorBluetoothService();
