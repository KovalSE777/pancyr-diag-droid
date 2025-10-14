import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { DiagnosticData } from '@/types/bluetooth';
import { ProtocolParser, ParsedFrame, UDS_StartComm, UDS_TesterPres, UDS_Read21_01, ackUOKS, ackUOKP } from './protocol-parser';
import { Screen4Parser } from './screen4-parser';
import { logService } from './log-service';
import { HexFrame } from '@/components/diagnostics/LiveHexMonitor';

export class CapacitorBluetoothService {
  private deviceAddress: string | null = null;
  private latestData: DiagnosticData | null = null;
  private systemType: 'SKA' | 'SKE' = 'SKA';
  private parser: ProtocolParser = new ProtocolParser();
  private testerPresentInterval: number | null = null;
  private connectionEstablished: boolean = false;
  private readInterval: number | null = null;
  private hexFrames: HexFrame[] = [];
  private onFramesUpdate?: (frames: HexFrame[]) => void;
  
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
      
      // Сначала подписываемся на данные, потом connect
      this.deviceAddress = deviceAddress;
      this.startReading();
      
      // Подключаемся и ждём установления соединения
      await BluetoothSerial.connect({ address: deviceAddress });
      logService.success('BT Serial', 'Socket connected');
      
      // Пауза 200 мс для стабилизации соединения
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Только ПОСЛЕ паузы отправляем первую команду
      await this.sendStartCommunication();
      
      this.connectionEstablished = true;
      this.startTesterPresent();
      
      logService.success('BT Serial', 'Ready');
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
        const result = await BluetoothSerial.read({ address: this.deviceAddress });
        if (result.value) {
          const bytes = this.hexToBytes(result.value);
          const hex = this.bytesToHex(bytes);
          
          // Логируем сырые данные ДО парсинга
          const hexFormatted = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
          logService.info('BT-RX raw', hexFormatted);
          
          this.addHexFrame('RX', hex);
          
          this.parser.feed(bytes, (frame) => this.handleParsedFrame(frame));
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
        this.hexFrames = [];
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

  private handleParsedFrame(frame: ParsedFrame): void {
    const hex = [...frame.raw].map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    
    if (frame.type === 'TEL_88') {
      const nScr = frame.info?.nScr;
      logService.success('BT-RX frame', `✓ 0x88 Screen=${nScr}, CHK=${frame.ok ? 'OK' : 'FAIL'}, ${hex}`);
      
      if (nScr === 4 && frame.ok) {
        const diagnosticData = Screen4Parser.parse(frame.raw.slice(3, 3 + (frame.raw[2] & 0xFF)), this.systemType);
        if (diagnosticData) {
          this.latestData = diagnosticData;
          logService.success('BT-RX', 'Screen 4 parsed');
        }
      }
    }
    else if (frame.type === 'SCR_66') {
      const nScr = frame.info?.nScr ?? 0;
      logService.success('BT-RX frame', `✓ 0x66 SCR_${nScr}, ${hex}`);
      
      const ack = ackUOKS(nScr);
      this.sendRaw(ack).catch(() => {});
      const ackHex = [...ack].map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
      this.addHexFrame('TX', ackHex, true, `ACK UOKS${nScr}`);
      logService.info('BT-TX', `UOKS${nScr} → ${ackHex}`);
    }
    else if (frame.type === 'CFG_77') {
      const nPak = frame.info?.nPak ?? 0;
      logService.success('BT-RX frame', `✓ 0x77 Package=${nPak}, CHK=${frame.ok ? 'OK' : 'FAIL'}, ${hex}`);
      
      const ack = ackUOKP(nPak);
      this.sendRaw(ack).catch(() => {});
      const ackHex = [...ack].map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
      this.addHexFrame('TX', ackHex, true, `ACK UOKP${nPak}`);
      logService.info('BT-TX', `UOKP${nPak} → ${ackHex}`);
    }
    else if (frame.type === 'UDS_80P') {
      const dst = frame.info?.dst ?? 0;
      const src = frame.info?.src ?? 0;
      const sid = frame.info?.sid ?? 0;
      
      // Принимаем все UDS, но выделяем ответы от БСКУ (0xF1←0x28)
      if (dst === 0xF1 && src === 0x28) {
        logService.success('BT-RX frame', `✓ UDS Response 0x${dst.toString(16).toUpperCase()}←0x${src.toString(16).toUpperCase()} SID=0x${sid.toString(16).toUpperCase()}, CHK=${frame.ok ? 'OK' : 'FAIL'}, ${hex}`);
      } else {
        logService.info('BT-RX frame', `UDS 0x${dst.toString(16).toUpperCase()}←0x${src.toString(16).toUpperCase()} SID=0x${sid.toString(16).toUpperCase()}, CHK=${frame.ok ? 'OK' : 'FAIL'}, ${hex}`);
      }
    }
    else if (!frame.ok) {
      logService.error('BT-RX frame', `✗ Checksum FAIL: ${hex}`);
    }
  }

  private async sendRaw(bytes: Uint8Array): Promise<void> {
    if (!this.deviceAddress) throw new Error('Not connected');
    const hex = this.bytesToHex(bytes);
    this.addHexFrame('TX', hex);
    await BluetoothSerial.write({ address: this.deviceAddress, value: hex });
  }

  private async sendUDSCommand(packet: Uint8Array): Promise<void> {
    if (!this.deviceAddress) throw new Error('Not connected');
    const hex = Array.from(packet).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    logService.info('BT-TX', `UDS → ${hex}`);
    await this.sendRaw(packet);
  }

  private addHexFrame(direction: 'TX' | 'RX', hex: string, checksumOk?: boolean, description?: string): void {
    const frame: HexFrame = {
      direction,
      timestamp: Date.now(),
      hex: hex.toUpperCase().replace(/(.{2})/g, '$1 ').trim(), // Форматируем с пробелами
      checksumOk,
      description
    };
    
    this.hexFrames.push(frame);
    
    // Храним только последние 50 кадров
    if (this.hexFrames.length > 50) {
      this.hexFrames = this.hexFrames.slice(-50);
    }
    
    this.onFramesUpdate?.(this.hexFrames);
  }

  setOnFramesUpdate(callback: (frames: HexFrame[]) => void): void {
    this.onFramesUpdate = callback;
  }

  getHexFrames(): HexFrame[] {
    return this.hexFrames;
  }

  private async sendStartCommunication(): Promise<void> {
    await this.sendUDSCommand(UDS_StartComm);
  }

  private async sendTesterPresent(): Promise<void> {
    await this.sendUDSCommand(UDS_TesterPres);
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
    await this.sendUDSCommand(UDS_Read21_01);
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