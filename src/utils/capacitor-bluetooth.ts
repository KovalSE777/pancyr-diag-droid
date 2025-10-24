import { DiagnosticData, SystemType } from '@/types/bluetooth';
import {
  buildUCONF,
  buildUOKS,
  buildUOKP,
  buildCyclicPoll,
  parseBskuPacket,
  BskuPacketType,
  type BskuPacket
} from './protocol-parser';
import { Screen4Parser } from './screen4-parser';
import { logService } from './log-service';
import { HexFrame } from '@/components/diagnostics/LiveHexMonitor';
import { NativeBluetoothWrapper } from './native-bluetooth';
import { bytesToHex, hexToBytes, formatBytes } from './hex';
import { BT_TIMING, DATA_LIMITS } from './bluetooth-constants';

export class CapacitorBluetoothService {
  private deviceAddress: string | null = null;
  private latestData: DiagnosticData | null = null;
  private systemType: SystemType = 'SKA';
  private hexFrames: HexFrame[] = [];
  private onFramesUpdate?: (frames: HexFrame[]) => void;
  private bt: NativeBluetoothWrapper = new NativeBluetoothWrapper();
  private cyclicPollInterval: NodeJS.Timeout | null = null;
  private receiveBuffer = new Uint8Array(0); // Буфер для накопления данных
  
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
        logService.info('BT-RX raw', `${formatBytes(chunk)} (len=${chunk.length})`);
        
        const hex = bytesToHex(chunk);
        this.addHexFrame('RX', hex);
        
        // Обработка входящих данных с учётом нового протокола
        this.handleIncomingData(chunk);
      });
      
      // Обработка потери соединения
      this.bt.onConnectionLost(() => {
        logService.error('BT Serial', 'Connection lost - device disconnected');
        this.stopCyclicPolling();
      });
      
      // 2) Подключаемся к устройству
      await this.bt.connect(mac);
      logService.success('BT Serial', 'Socket connected');
      
      // 3) Пауза для стабилизации соединения
      await new Promise(resolve => setTimeout(resolve, BT_TIMING.CONNECTION_STABILIZATION_DELAY));
      
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
    this.stopCyclicPolling();
    
    if (this.deviceAddress) {
      try {
        await this.bt.disconnect();
        this.deviceAddress = null;
        this.receiveBuffer = new Uint8Array(0); // Очистка буфера
        this.hexFrames = [];
        this.latestData = null;
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logService.error('BT Serial', `Disconnect error: ${error}`);
      }
    }
  }
  
  isConnected(): boolean {
    return this.deviceAddress !== null;
  }
  // Удалены дублированные методы hexToBytes/bytesToHex - используем из utils/hex.ts

  /**
   * Инициализация соединения (новый протокол)
   * Последовательность:
   * 1. Пауза 200ms для стабилизации
   * 2. Отправить UCONF (запрос конфигурации)
   * 3. Подождать ответа от БСКУ (0x66 или телеметрия)
   * 4. Через 500ms запустить циклический опрос
   */
  private async startCommunication(): Promise<void> {
    logService.info('BT Serial', '🚀 Starting communication');
    
    // 1. UCONF
    const uconfPacket = buildUCONF();
    await this.sendRaw(uconfPacket);
    logService.info('BT Serial', '📤 Sent UCONF');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 2. UOKS
    const uoksPacket = buildUOKS(4);
    await this.sendRaw(uoksPacket);
    logService.info('BT Serial', '📤 Sent UOKS(4)');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 3. Cyclic polling
    this.startCyclicPolling();
    
    logService.info('BT Serial', '✅ Communication started');
  }

  /**
   * Циклический опрос (новый протокол)
   * Отправляет 38-байтный пакет опроса телеметрии каждые 500ms
   * БСКУ отвечает пакетом телеметрии с заголовком 0xFF
   */
  private startCyclicPolling(): void {
    // Остановить предыдущий таймер если есть
    this.stopCyclicPolling();
    
    // Запустить новый таймер циклического опроса
    this.cyclicPollInterval = setInterval(async () => {
      if (!this.isConnected()) {
        logService.warn('BT Serial', 'Not connected, skipping cyclic poll');
        return;
      }
      
      try {
        const pollPacket = buildCyclicPoll();
        await this.sendRaw(pollPacket);
        logService.info('BT Serial', '🔄 Cyclic poll sent (38 bytes)');
      } catch (error) {
        logService.error('BT Serial', `Cyclic poll error: ${error}`);
      }
    }, BT_TIMING.PERIODIC_READ_INTERVAL); // 500ms
    
    logService.info('BT Serial', `⏰ Cyclic polling started (${BT_TIMING.PERIODIC_READ_INTERVAL}ms interval)`);
  }

  private stopCyclicPolling(): void {
    if (this.cyclicPollInterval) {
      clearInterval(this.cyclicPollInterval);
      this.cyclicPollInterval = null;
      logService.info('BT Serial', '⏸️  Cyclic polling stopped');
    }
  }

  /**
   * Обработка входящих данных (с буферизацией)
   */
  private handleIncomingData(chunk: Uint8Array): void {
    // Накапливаем в буфере
    const newBuffer = new Uint8Array(this.receiveBuffer.length + chunk.length);
    newBuffer.set(this.receiveBuffer, 0);
    newBuffer.set(chunk, this.receiveBuffer.length);
    this.receiveBuffer = newBuffer;
    
    // Пытаемся найти и распарсить пакеты с заголовком 0xFF
    this.tryParseNewProtocolPackets();
  }

  /**
   * Попытка распарсить пакеты нового протокола из буфера
   */
  private tryParseNewProtocolPackets(): void {
    // Ищем заголовок 0xFF в буфере
    let foundHeader = false;
    let headerStart = -1;
    
    for (let i = 0; i < this.receiveBuffer.length - 7; i++) {
      // Проверяем на наличие как минимум 4-х байт 0xFF подряд
      if (this.receiveBuffer[i] === 0xFF &&
          this.receiveBuffer[i + 1] === 0xFF &&
          this.receiveBuffer[i + 2] === 0xFF &&
          this.receiveBuffer[i + 3] === 0xFF) {
        foundHeader = true;
        headerStart = i;
        break;
      }
    }
    
    if (!foundHeader) {
      // Заголовок не найден, очищаем буфер если он слишком большой
      if (this.receiveBuffer.length > 200) {
        logService.warn('BT-RX', 'Buffer overflow, clearing...');
        this.receiveBuffer = new Uint8Array(0);
      }
      return;
    }
    
    // Нашли заголовок, пытаемся распарсить пакет
    const packet = parseBskuPacket(this.receiveBuffer.slice(headerStart));
    
    if (packet) {
      logService.success('BT-RX', `Parsed BSKU packet: type=${packet.type}`);
      this.handleBskuPacket(packet);
      
      // Удаляем распарсенную часть из буфера
      // Грубая оценка: заголовок (7) + тип (1) + данные (~30) = ~40 байт
      const estimatedPacketSize = 40;
      this.receiveBuffer = this.receiveBuffer.slice(headerStart + estimatedPacketSize);
    } else {
      // Не удалось распарсить, может данные ещё не полностью получены
      // Ждём больше данных, но сохраняем только с заголовка
      this.receiveBuffer = this.receiveBuffer.slice(headerStart);
      
      // Если буфер слишком большой, что-то не так
      if (this.receiveBuffer.length > 100) {
        logService.warn('BT-RX', 'Failed to parse packet, clearing buffer');
        this.receiveBuffer = new Uint8Array(0);
      }
    }
  }


  /**
   * Обработка пакета нового протокола
   * Вызывается когда parseBskuPacket успешно распарсил пакет
   */
  private async handleBskuPacket(packet: BskuPacket): Promise<void> {
    logService.info('BT-RX BSKU', `📦 Packet: Type=${packet.type}, ScreenId=${packet.screenId ?? 'N/A'}, PktId=${packet.pktId ?? 'N/A'}`);
    
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

  /**
   * Обработка фрейма смены экрана (0x66)
   * Формат: 0xFF...0xFF 0x66 "SCR_" + screenId
   * Ответ: UOKS + screenId
   */
  private async handleScreenChange(packet: BskuPacket): Promise<void> {
    logService.info('BT-RX BSKU', `🖥️  Screen change detected: Screen ${packet.screenId}`);
    
    if (packet.screenId !== undefined) {
      // Отправить подтверждение UOKS
      const uoksPacket = buildUOKS(packet.screenId);
      await this.sendRaw(uoksPacket);
      logService.success('BT-TX', `✅ Sent UOKS acknowledgment for screen ${packet.screenId}`);
    } else {
      logService.error('BT-RX BSKU', 'Screen change packet missing screenId');
    }
  }

  /**
   * Обработка конфигурационного пакета (0x77)
   * Формат: 0xFF...0xFF 0x77 pktId + конфигурация
   * Ответ: UOKP + pktId
   */
  private async handleConfiguration(packet: BskuPacket): Promise<void> {
    logService.info('BT-RX BSKU', `⚙️  Configuration packet received: Packet ${packet.pktId}`);
    
    if (packet.pktId !== undefined) {
      // Отправить подтверждение UOKP
      const uokpPacket = buildUOKP(packet.pktId);
      await this.sendRaw(uokpPacket);
      logService.success('BT-TX', `✅ Sent UOKP acknowledgment for packet ${packet.pktId}`);
      
      // TODO: Обработать конфигурационные данные если нужно
      // packet.data содержит конфигурацию после pktId
    } else {
      logService.error('BT-RX BSKU', 'Configuration packet missing pktId');
    }
  }

  /**
   * Обработка телеметрии
   * Формат: 0xFF...0xFF screenId + данные телеметрии
   * Парсится через Screen4Parser
   */
  private handleTelemetry(packet: BskuPacket): void {
    logService.info('BT-RX BSKU', `📊 Telemetry data received (screen ${packet.screenId ?? 'unknown'})`);
    
    // Парсить телеметрию через Screen4Parser
    const diagnosticData = Screen4Parser.parse(packet.data, this.systemType);
    
    if (diagnosticData) {
      this.latestData = diagnosticData;
      logService.success('BT-RX', '✅ Telemetry parsed successfully (NEW protocol)');
      
      // Уведомить UI об обновлении данных (если реализовано)
      // this.notifyDataListeners(diagnosticData);
    } else {
      logService.error('BT-RX', 'Failed to parse telemetry data');
      logService.info('BT-RX', `Raw data length: ${packet.data.length} bytes`);
    }
  }

  private async sendRaw(bytes: Uint8Array): Promise<void> {
    if (!this.deviceAddress) throw new Error('Not connected');
    const hex = bytesToHex(bytes);
    this.addHexFrame('TX', hex);
    await this.bt.write(bytes);
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

  getLatestData(): DiagnosticData | null {
    return this.latestData;
  }


  async requestDiagnosticData(): Promise<void> {
    // Данные приходят автоматически через циклический опрос
    logService.info('BT Serial', 'Diagnostic data is polled automatically via cyclic polling');
  }

  async setTestMode(enabled: boolean): Promise<void> {
    logService.warn('BT-TX', 'setTestMode not implemented for new protocol yet');
  }

  async controlRelays(relays: any): Promise<void> {
    logService.warn('BT-TX', 'controlRelays not implemented for new protocol yet');
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