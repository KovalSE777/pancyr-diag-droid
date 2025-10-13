import { BleClient } from '@capacitor-community/bluetooth-le';
import { DiagnosticData } from '@/types/bluetooth';
import { ProtocolParser, Frame0x88, Frame0x66, Frame0x77 } from './protocol-parser';
import { Screen4Parser } from './screen4-parser';
import { appendChecksum, toHex } from './checksum';
import { logService } from './log-service';

export class CapacitorBluetoothService {
  private deviceId: string | null = null;
  private latestData: DiagnosticData | null = null;
  private systemType: 'SKA' | 'SKE' = 'SKA';
  private parser: ProtocolParser = new ProtocolParser();
  
  // UART profiles
  private UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  private UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  private UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  
  private readonly HM10_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  private readonly HM10_DATA_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  // UDS protocol addresses (опциональные)
  private readonly BSKU_ADDRESS = 0x28;
  private readonly TESTER_ADDRESS = 0xF0;
  
  async initialize(): Promise<void> {
    try {
      await BleClient.initialize();
    } catch (error) {
      console.error('BLE initialization failed:', error);
      throw error;
    }
  }

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
      
      await this.initialize();
      
      const devices: Array<{deviceId: string, name?: string, rssi?: number}> = [];
      
      await BleClient.requestLEScan({}, (result) => {
        const exists = devices.find(d => d.deviceId === result.device.deviceId);
        if (!exists) {
          devices.push({
            deviceId: result.device.deviceId,
            name: result.device.name,
            rssi: result.rssi
          });
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      await BleClient.stopLEScan();
      
      if (devices.length === 0) {
        throw new Error('Устройства не найдены');
      }
      
      const bleDevices = [...devices].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
      
      for (const candidate of bleDevices) {
        try {
          await BleClient.connect(candidate.deviceId, () => {
            if (this.deviceId === candidate.deviceId) this.deviceId = null;
          });

          const services = await BleClient.getServices(candidate.deviceId);
          let profile: 'NUS' | 'HM10' | null = null;
          let rxChar: string | null = null;
          let txChar: string | null = null;
          let svcUuid: string | null = null;

          for (const s of services) {
            const su = s.uuid.toLowerCase();
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
            if (this.isUuid(su, 'ffe0')) {
              const chars = s.characteristics || [];
              const ffe1 = chars.find((c: any) => this.isUuid(c.uuid, 'ffe1')) as any;
              const ffe2 = chars.find((c: any) => this.isUuid(c.uuid, 'ffe2')) as any;
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
            this.deviceId = candidate.deviceId;
            this.UART_SERVICE_UUID = svcUuid!;
            this.UART_RX_CHAR_UUID = rxChar!;
            this.UART_TX_CHAR_UUID = txChar!;
            logService.success('BLE Native', `Profile: ${profile}`);

            await BleClient.startNotifications(
              this.deviceId,
              this.UART_SERVICE_UUID,
              this.UART_RX_CHAR_UUID,
              (value) => this.handleDataReceived(value)
            );

            logService.success('BLE Native', 'Connected, waiting for 0x88 frames...');
            return true;
          }

          await BleClient.disconnect(candidate.deviceId).catch(() => {});
        } catch (e) {
          try { await BleClient.disconnect(candidate.deviceId); } catch {}
        }
      }

      throw new Error('Подходящий BLE UART сервис не найден');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logService.error('BLE Native', `Connection failed: ${errorMsg}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.deviceId) {
      try {
        await BleClient.disconnect(this.deviceId);
        this.deviceId = null;
        this.parser.clearBuffer();
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
    logService.info('BLE-RX', `chunk ${chunk.length}b: ${toHex(chunk)}`);

    this.parser.addData(chunk);

    let frame;
    while ((frame = this.parser.parseNextFrame()) !== null) {
      this.handleParsedFrame(frame);
    }
  }

  private handleParsedFrame(frame: any): void {
    if (frame.type === 0x88) {
      const f = frame as Frame0x88;
      if (f.screen === 4) {
        const diagnosticData = Screen4Parser.parse(f.payload, this.systemType);
        if (diagnosticData) {
          this.latestData = diagnosticData;
          logService.success('BLE-RX', 'Screen 4 parsed');
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
      if (frame.dst === 0xF1 && frame.src === 0x28) {
        logService.success('BLE-RX', 'UDS response');
      }
    }
  }

  private async sendASCII(text: string): Promise<void> {
    if (!this.deviceId) throw new Error('Not connected');
    
    const bytes = new TextEncoder().encode(text);
    const dataView = new DataView(bytes.buffer);
    
    try {
      await BleClient.write(this.deviceId, this.UART_SERVICE_UUID, this.UART_TX_CHAR_UUID, dataView);
    } catch {
      await BleClient.writeWithoutResponse(this.deviceId, this.UART_SERVICE_UUID, this.UART_TX_CHAR_UUID, dataView);
    }
  }

  private async sendUDSCommand(serviceData: number[]): Promise<void> {
    if (!this.deviceId) throw new Error('Not connected');
    
    const N = serviceData.length + 2;
    const hdr = 0x80 | ((N - 2) & 0x3F);
    const packet = [hdr, this.BSKU_ADDRESS, this.TESTER_ADDRESS, ...serviceData];
    const fullPacket = appendChecksum(packet);
    const data = new Uint8Array(fullPacket);
    const dataView = new DataView(data.buffer);
    
    try {
      await BleClient.write(this.deviceId, this.UART_SERVICE_UUID, this.UART_TX_CHAR_UUID, dataView);
    } catch {
      await BleClient.writeWithoutResponse(this.deviceId, this.UART_SERVICE_UUID, this.UART_TX_CHAR_UUID, dataView);
    }
  }

  getLatestData(): DiagnosticData | null {
    return this.latestData;
  }

  async requestDiagnosticData(): Promise<void> {
    await this.sendUDSCommand([0x21, 0x01]);
  }

  async setTestMode(enabled: boolean): Promise<void> {
    logService.warn('BLE-TX', 'setTestMode not implemented');
  }

  async controlRelays(relays: any): Promise<void> {
    logService.warn('BLE-TX', 'controlRelays not implemented');
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
        { id: 1, status: 'ok' },
        { id: 2, status: 'ok' },
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
