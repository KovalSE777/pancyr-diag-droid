import { DiagnosticData, SystemType } from '@/types/bluetooth';
import {
  buildUCONF,
  buildUOKS,
  buildUOKP,
  buildCyclicPoll,
  parseBskuPacket,
  BskuPacketType,
  DirectControl_Poll,
  ProtocolParser,
  type ParsedFrame,
  type BskuPacket
} from './protocol-parser';
import { Screen4Parser } from './screen4-parser';
import { logService } from './log-service';
import { HexFrame } from '@/components/diagnostics/LiveHexMonitor';
import { NativeBluetoothWrapper } from './native-bluetooth';
import { bytesToHex, hexToBytes, formatBytes } from './hex';
import { BT_TIMING, UDS_ADDRESSES, DATA_LIMITS } from './bluetooth-constants';

export class CapacitorBluetoothService {
  private deviceAddress: string | null = null;
  private latestData: DiagnosticData | null = null;
  private systemType: SystemType = 'SKA';
  private parser: ProtocolParser = new ProtocolParser();
  private testerPresentInterval: number | null = null;
  private connectionEstablished: boolean = false;
  private hexFrames: HexFrame[] = [];
  private onFramesUpdate?: (frames: HexFrame[]) => void;
  private bt: NativeBluetoothWrapper = new NativeBluetoothWrapper();
  private cyclicPollInterval: NodeJS.Timeout | null = null;
  private useNewProtocol = true; // Новый протокол (ASCII команды) по умолчанию
  
  async initialize(): Promise<void> {
    // Инициализация не требуется для нативного плагина
    logService.success('BT Serial', 'Native Bluetooth ready');
  }

  async connect(systemType: 'SKA' | 'SKE' = 'SKA'): Promise<boolean> {
    // Для нативного плагина требуется MAC адрес
    logService.error('BT Serial', 'Use connectToDeviceId with MAC address');
    return false;
  }

  async connectToDeviceId(deviceAddress: string, systemType: SystemType = 'SKA'): Promise<boolean> {
    try {
      // Валидация systemType
      if (systemType !== 'SKA' && systemType !== 'SKE') {
        logService.error('BT Serial', `Invalid systemType: "${systemType}"`);
        throw new Error(`Invalid systemType: "${systemType}". Expected SKA or SKE`);
      }
      
      this.systemType = systemType;
      await this.initialize();
      
      // Проверяем, что MAC-адрес передан корректно
      const mac = deviceAddress ?? '';
      if (!/^[0-9A-Fa-f:]{17}$/.test(mac)) {
        logService.error('BT Serial', `MAC not set or invalid: "${mac}"`);
        throw new Error(`MAC not set or invalid: "${mac}"`);
      }
      
      this.deviceAddress = mac;
      
      // 1) КРИТИЧНО: подписываемся на данные ДО connect()
      this.bt.onBytes((chunk) => {
        // Оптимизированное логирование - только в logService
        logService.info('BT-RX raw', `${formatBytes(chunk)} (len=${chunk.length})`);
        
        const hex = bytesToHex(chunk);
        this.addHexFrame('RX', hex);
        
        // Парсим фреймы
        this.parser.feed(chunk, (frame) => this.handleParsedFrame(frame));
      });
      
      // Обработка потери соединения
      this.bt.onConnectionLost(() => {
        logService.error('BT Serial', 'Connection lost - device disconnected');
        this.connectionEstablished = false;
        this.stopPeriodicRead();
      });
      
      // 2) Подключаемся к устройству
      await this.bt.connect(mac);
      logService.success('BT Serial', 'Socket connected');
      
      // 3) Пауза для стабилизации соединения
      await new Promise(resolve => setTimeout(resolve, BT_TIMING.CONNECTION_STABILIZATION_DELAY));
      
      this.connectionEstablished = true;
      
      // 4) Запускаем инициализацию с новым протоколом
      await this.startCommunication();
      
      logService.success('BT Serial', 'Ready');
      return true;
    } catch (error) {
      logService.error('BT Serial', `Connection failed: ${error}`);
      return false;
    }
  }

  // Больше не нужен - данные приходят через listener нативного плагина

  async disconnect(): Promise<void> {
    this.stopPeriodicRead();
    this.stopCyclicPolling();
    
    if (this.deviceAddress) {
      try {
        // Защита от быстрого переподключения - даем время на очистку
        const wasConnected = this.connectionEstablished;
        
        await this.bt.disconnect();
        this.deviceAddress = null;
        this.connectionEstablished = false;
        this.parser.clearBuffer();
        this.hexFrames = [];
        this.latestData = null;
        
        // Небольшая задержка перед следующим подключением
        if (wasConnected) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        logService.error('BT Serial', `Disconnect error: ${error}`);
      }
    }
  }
  
  isConnected(): boolean {
    return this.deviceAddress !== null && this.connectionEstablished;
  }
  // Удалены дублированные методы hexToBytes/bytesToHex - используем из utils/hex.ts

  /**
   * Инициализация соединения (новый протокол)
   */
  private async startCommunication(): Promise<void> {
    if (this.useNewProtocol) {
      logService.info('BT Serial', '🚀 Starting NEW protocol (ASCII commands)');
      
      // 1. Отправить UCONF
      logService.info('BT Serial', '📤 Sending UCONF...');
      const uconfPacket = buildUCONF();
      await this.sendRaw(uconfPacket);
      
      // 2. Подождать ответа (обрабатывается в onBytes)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 3. Запустить циклический опрос
      this.startCyclicPolling();
      
      logService.success('BT Serial', '✅ NEW protocol started');
    } else {
      // Альтернативный режим - прямое управление
      logService.info('BT Serial', '🔄 Using ALTERNATIVE protocol (Direct Control)');
      await this.sendDirectControlPoll();
      this.startPeriodicRead();
    }
  }

  /**
   * Циклический опрос (новый протокол)
   */
  private startCyclicPolling(): void {
    this.stopCyclicPolling();
    
    this.cyclicPollInterval = setInterval(async () => {
      if (!this.isConnected()) return;
      
      try {
        const pollPacket = buildCyclicPoll();
        await this.sendRaw(pollPacket);
        logService.info('BT Serial', '🔄 Cyclic poll sent');
      } catch (error) {
        logService.error('BT Serial', `Cyclic poll error: ${error}`);
      }
    }, 500);
    
    logService.info('BT Serial', '⏰ Cyclic polling started (500ms)');
  }

  private stopCyclicPolling(): void {
    if (this.cyclicPollInterval) {
      clearInterval(this.cyclicPollInterval);
      this.cyclicPollInterval = null;
      logService.info('BT Serial', '⏸️  Cyclic polling stopped');
    }
  }

  private handleParsedFrame(frame: ParsedFrame): void {
    const hex = [...frame.raw].map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    
    // Попытка парсинга нового протокола
    if (this.useNewProtocol) {
      const packet = parseBskuPacket(frame.raw);
      
      if (packet) {
        this.handleBskuPacket(packet);
        return;
      }
      
      logService.warn('BT-RX', 'New protocol parse failed, trying legacy...');
    }
    
    // Fallback на старый парсер
    logService.info('BT-RX frame', `Type=${frame.type}, CHK=${frame.ok ? 'OK' : 'FAIL'}, Info=${JSON.stringify(frame.info ?? {})}, Hex=${hex}`);
    
    if (frame.type === 'UDS_80P') {
      const dst = frame.info?.dst ?? 0;
      const src = frame.info?.src ?? 0;
      const sid = frame.info?.sid ?? 0;
      
      logService.success('BT-RX frame', `✓ UDS 0x${dst.toString(16).toUpperCase()}←0x${src.toString(16).toUpperCase()} SID=0x${sid.toString(16).toUpperCase()}, CHK=${frame.ok ? 'OK' : 'FAIL'}, ${hex}`);
      
      if (sid === 0x61 && frame.ok && frame.raw.length >= 28) {
        const payload = frame.raw.slice(5, frame.raw.length - 1);
        
        if (payload.length >= 22) {
          const diagnosticData = Screen4Parser.parse(payload, this.systemType);
          if (diagnosticData) {
            this.latestData = diagnosticData;
            logService.success('BT-RX', 'Telemetry parsed (legacy mode)');
          } else {
            logService.error('BT-RX', `Parse failed - payload length=${payload.length}`);
          }
        } else {
          logService.error('BT-RX', `Payload too short: ${payload.length} bytes`);
        }
      }
    }
    else if (frame.type === 'SCR_66') {
      const nScr = frame.info?.nScr ?? 0;
      logService.success('BT-RX frame', `✓ 0x66 SCR_${nScr}, ${hex}`);
    }
    else if (frame.type === 'CFG_77') {
      const nPak = frame.info?.nPak ?? 0;
      logService.success('BT-RX frame', `✓ 0x77 Package=${nPak}, CHK=${frame.ok ? 'OK' : 'FAIL'}, ${hex}`);
    }
    else if (!frame.ok) {
      logService.error('BT-RX frame', `✗ Checksum FAIL: ${hex}`);
    }
  }

  /**
   * Обработка пакета нового протокола
   */
  private async handleBskuPacket(packet: BskuPacket): Promise<void> {
    logService.info('BT-RX BSKU', `Type=${packet.type}, ScreenId=${packet.screenId}, PktId=${packet.pktId}`);
    
    switch (packet.type) {
      case BskuPacketType.SCREEN_CHANGE:
        await this.handleScreenChange(packet);
        break;
        
      case BskuPacketType.CONFIGURATION:
        await this.handleConfiguration(packet);
        break;
        
      case BskuPacketType.TELEMETRY:
        this.handleTelemetry(packet);
        break;
        
      default:
        logService.warn('BT-RX BSKU', `Unknown packet type: ${packet.type}`);
    }
  }

  private async handleScreenChange(packet: BskuPacket): Promise<void> {
    logService.info('BT-RX BSKU', `🖥️  Screen change: ${packet.screenId}`);
    
    if (packet.screenId !== undefined) {
      const uoksPacket = buildUOKS(packet.screenId);
      await this.sendRaw(uoksPacket);
      logService.success('BT-TX', `✅ Sent UOKS for screen ${packet.screenId}`);
    }
  }

  private async handleConfiguration(packet: BskuPacket): Promise<void> {
    logService.info('BT-RX BSKU', `⚙️  Configuration packet: ${packet.pktId}`);
    
    if (packet.pktId !== undefined) {
      const uokpPacket = buildUOKP(packet.pktId);
      await this.sendRaw(uokpPacket);
      logService.success('BT-TX', `✅ Sent UOKP for packet ${packet.pktId}`);
    }
  }

  private handleTelemetry(packet: BskuPacket): void {
    logService.info('BT-RX BSKU', `📊 Telemetry data (screen ${packet.screenId})`);
    
    const diagnosticData = Screen4Parser.parse(packet.data, this.systemType);
    
    if (diagnosticData) {
      this.latestData = diagnosticData;
      logService.success('BT-RX', '✅ Telemetry parsed (NEW protocol)');
    } else {
      logService.error('BT-RX', 'Failed to parse telemetry');
    }
  }

  private async sendRaw(bytes: Uint8Array): Promise<void> {
    if (!this.deviceAddress) throw new Error('Not connected');
    const hex = bytesToHex(bytes);
    this.addHexFrame('TX', hex);
    await this.bt.write(bytes);
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
      hex: hex.toUpperCase(), // Сохраняем без пробелов - форматирование в UI
      checksumOk,
      description
    };
    
    this.hexFrames.push(frame);
    
    // Храним только последние кадры (из константы)
    if (this.hexFrames.length > DATA_LIMITS.MAX_HEX_FRAMES) {
      this.hexFrames = this.hexFrames.slice(-DATA_LIMITS.MAX_HEX_FRAMES);
    }
    
    this.onFramesUpdate?.(this.hexFrames);
  }

  setOnFramesUpdate(callback: (frames: HexFrame[]) => void): void {
    this.onFramesUpdate = callback;
  }

  getHexFrames(): HexFrame[] {
    return this.hexFrames;
  }

  /**
   * ПРЯМОЕ УПРАВЛЕНИЕ (НЕ UDS!)
   * Отправляем пакет опроса состояния с нулевыми управляющими байтами.
   * Устройство СРАЗУ ответит телеметрией (22 байта).
   */
  private async sendDirectControlPoll(): Promise<void> {
    const hex = Array.from(DirectControl_Poll).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    logService.info('BT-TX', `DirectControl Poll → ${hex}`);
    await this.sendRaw(DirectControl_Poll);
  }

  private periodicReadInterval: number | null = null;

  private startPeriodicRead(): void {
    this.stopPeriodicRead();
    this.periodicReadInterval = window.setInterval(() => {
      if (this.isConnected()) {
        // Периодический опрос через DirectControl (НЕ UDS!)
        this.sendDirectControlPoll().catch(() => {});
      }
    }, BT_TIMING.PERIODIC_READ_INTERVAL);
  }

  private stopPeriodicRead(): void {
    if (this.periodicReadInterval) clearInterval(this.periodicReadInterval);
  }

  getLatestData(): DiagnosticData | null {
    return this.latestData;
  }

  async requestDiagnosticData(): Promise<void> {
    // Используем прямое управление вместо UDS
    await this.sendDirectControlPoll();
  }

  async setTestMode(enabled: boolean): Promise<void> {
    logService.warn('BT-TX', 'setTestMode not implemented yet');
  }

  async controlRelays(relays: any): Promise<void> {
    logService.warn('BT-TX', 'controlRelays not implemented yet');
  }

  getMockData(systemType: string = 'SKA'): DiagnosticData {
    const isSKE = systemType.toUpperCase() === 'SKE';
    
    // Mock данные с реальными физическими значениями (после ADC конвертации)
    return {
      // Напряжения вентиляторов (примерные значения из таблицы D_napr1)
      UP_M1: 27.5, UP_M2: 26.8, UP_M3: 27.1, UP_M4: 27.3, UP_M5: 27.0,
      
      // Падения напряжения (в вольтах)
      dUP_M1: 1.2, dUP_M2: 0.8, dUP_M3: 1.5,
      
      // Температуры (реальные значения в °C из калибровочных таблиц)
      T_air: 22.5,   // Воздух - таблица A (~ADC 0x6A)
      T_isp: -5.2,   // Испаритель - таблица A (~ADC 0x30)
      T_kmp: 45.8,   // Компрессор - таблица B (~ADC 0x40)
      
      // Напряжение питания и давление (реальные физические единицы)
      U_nap: 27.4,   // Вольты
      U_davl: 1.5,   // Бары (из таблицы давления ~ADC 107)
      
      // Количество вентиляторов
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
      pressureSensorStatus: 'ok', 
      
      // Power system mock
      powerStatus: 'ok',
      batteryVoltage: 27.4,
      powerSupplyOk: true,
      
      softStartStatus: 'ok',
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