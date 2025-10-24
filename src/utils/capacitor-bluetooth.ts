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
   * Начать обмен данными по новому протоколу
   * БСКУ САМ ИНИЦИИРУЕТ ПЕРЕДАЧУ ДАННЫХ!
   * Не нужно отправлять циклический опрос - БСКУ шлет данные каждые ~200ms
   */
  private async startCommunication(): Promise<void> {
    logService.info('BT Serial', '🚀 Starting communication - waiting for data from BSKU...');
    logService.info('BT Serial', '📡 BSKU will send data automatically (no polling needed)');
    
    // БСКУ сам начинает отправлять данные после подключения!
    // Приложение только слушает и обрабатывает входящие пакеты:
    // - 0x88 = телеметрия (каждые ~200ms)
    // - 0x66 = команда смены экрана (на которую отвечаем UOKS)
    
    logService.info('BT Serial', '✅ Ready to receive data from BSKU');
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
   * Попытка распарсить пакеты из буфера
   * Формат БСКУ:
   * - 0x88 = телеметрия (38 байт)
   * - 0x66 = команда смены экрана (7 байт: 66 53 43 52 5F <screenId> <checksum>)
   */
  private async tryParseNewProtocolPackets(): Promise<void> {
    // Ищем заголовки пакетов в буфере
    while (this.receiveBuffer.length > 0) {
      const firstByte = this.receiveBuffer[0];
      
      // Проверяем тип пакета по первому байту
      if (firstByte === 0x88) {
        // Телеметрия (38 байт)
        if (this.receiveBuffer.length >= 38) {
          const telemetryPacket = this.receiveBuffer.slice(0, 38);
          logService.info('BT-RX', `📊 Telemetry packet (0x88) - 38 bytes`);
          
          // Парсить через Screen4Parser
          const diagnosticData = Screen4Parser.parse(telemetryPacket, this.systemType);
          
          if (diagnosticData) {
            this.latestData = diagnosticData;
            logService.success('BT-RX', '✅ Telemetry parsed successfully');
            
            // Добавить в историю HEX фреймов
            const hex = bytesToHex(telemetryPacket);
            this.addHexFrame('RX', hex, true, 'TELEMETRY');
          } else {
            logService.error('BT-RX', 'Failed to parse telemetry');
          }
          
          // Удалить обработанный пакет из буфера
          this.receiveBuffer = this.receiveBuffer.slice(38);
        } else {
          // Недостаточно данных, ждем еще
          break;
        }
      } else if (firstByte === 0x66) {
        // Команда смены экрана (7 байт: 66 53 43 52 5F <screenId> <checksum>)
        if (this.receiveBuffer.length >= 7) {
          const screenChangePacket = this.receiveBuffer.slice(0, 7);
          
          // Проверить сигнатуру "SCR_"
          if (screenChangePacket[1] === 0x53 && 
              screenChangePacket[2] === 0x43 && 
              screenChangePacket[3] === 0x52 && 
              screenChangePacket[4] === 0x5F) {
            
            const screenId = screenChangePacket[5];
            logService.info('BT-RX', `🖥️  Screen change command: Screen ${screenId}`);
            
            // Отправить UOKS в ответ
            const uoksPacket = buildUOKS(screenId);
            await this.sendRaw(uoksPacket);
            logService.success('BT-TX', `✅ Sent UOKS for screen ${screenId}`);
            
            // Добавить в историю
            const hex = bytesToHex(screenChangePacket);
            this.addHexFrame('RX', hex, true, 'SCREEN_CHANGE');
          } else {
            logService.warn('BT-RX', 'Invalid screen change packet signature');
          }
          
          // Удалить обработанный пакет
          this.receiveBuffer = this.receiveBuffer.slice(7);
        } else {
          // Недостаточно данных
          break;
        }
      } else {
        // Неизвестный заголовок - пропускаем 1 байт
        logService.warn('BT-RX', `Unknown packet header: 0x${firstByte.toString(16)}`);
        this.receiveBuffer = this.receiveBuffer.slice(1);
      }
      
      // Защита от бесконечного цикла
      if (this.receiveBuffer.length > 500) {
        logService.warn('BT-RX', 'Buffer overflow, clearing...');
        this.receiveBuffer = new Uint8Array(0);
        break;
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