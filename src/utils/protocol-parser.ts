/* Панцирь — протокол парсера для Android (BT-SPP).
 * НОВЫЙ ПРОТОКОЛ на основе анализа оригинального приложения DB_BluetoothMonitorS
 * 
 * Формат команд:
 * - UCONF: ASCII "UCONF" (5 байт) - запрос конфигурации
 * - UOKS: ASCII "UOKS" + screenId (5 байт) - подтверждение экрана
 * - UOKP: ASCII "UOKP" + pktId (5 байт) - подтверждение конфигурации
 * - Циклический опрос: 38 байт с контрольной суммой
 * 
 * Формат ответов от БСКУ:
 * - Заголовок: 0xFF × 7 (синхронизация)
 * - Тип/ScreenId: 1 байт
 * - Данные: переменная длина
 */

export type FrameType = "SCR_66" | "CFG_77" | "UDS_80P" | "UNKNOWN";

export interface ParsedFrame {
  type: FrameType;
  raw: Uint8Array;
  ok: boolean;
  info?: Record<string, any>;
}

/**
 * Тип пакета от БСКУ (новый протокол)
 */
export enum BskuPacketType {
  TELEMETRY = 0x01,      // Телеметрия
  SCREEN_CHANGE = 0x66,  // Смена экрана "SCR_" + id
  CONFIGURATION = 0x77,  // Конфигурационный пакет
  UNKNOWN = 0xFF
}

/**
 * Результат парсинга пакета от БСКУ
 */
export interface BskuPacket {
  type: BskuPacketType;
  screenId?: number;     // Для TELEMETRY и SCREEN_CHANGE
  pktId?: number;        // Для CONFIGURATION
  data: Uint8Array;      // Сырые данные (без заголовка)
}

const enc = new TextEncoder();

export function sum8(a: Uint8Array, n?: number): number {
  const m = n ?? a.length;
  let s = 0;
  for (let i = 0; i < m; i++) s = (s + (a[i] & 0xFF)) & 0xFF;
  return s;
}

// ========== НОВЫЕ ASCII КОМАНДЫ (ОРИГИНАЛЬНЫЙ ПРОТОКОЛ) ==========

/**
 * UCONF - Запрос конфигурации экранов
 * Отправляется один раз после подключения
 * Формат: ASCII "UCONF" (5 байт)
 */
export function buildUCONF(): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode('UCONF');
}

/**
 * UOKS - Подтверждение экрана
 * Отправляется в ответ на фрейм 0x66 от БСКУ
 * @param screenId - номер экрана (0x01-0xFF)
 * 
 * ВАЖНО: screenId это БАЙТ (0x04), а не ASCII-символ '4' (0x34)
 * Формат: ASCII "UOKS" (4 байта) + screenId (1 байт) = 5 байт
 */
export function buildUOKS(screenId: number): Uint8Array {
  const encoder = new TextEncoder();
  const command = encoder.encode('UOKS');
  
  const packet = new Uint8Array(7);  // ✅ 7 байт!
  packet.set(command, 0);            // "UOKS" (4 байта)
  packet[4] = screenId & 0xFF;       // screenId
  packet[5] = 0x00;                  // padding
  packet[6] = 0x00;                  // padding
  
  return packet;
}

/**
 * UOKP - Подтверждение пакета конфигурации
 * Отправляется в ответ на фрейм 0x77 от БСКУ
 * @param pktId - номер пакета конфигурации (0x01-0xFF)
 * 
 * Формат: ASCII "UOKP" (4 байта) + pktId (1 байт) = 5 байт
 */
export function buildUOKP(pktId: number): Uint8Array {
  const encoder = new TextEncoder();
  const command = encoder.encode('UOKP');
  
  const packet = new Uint8Array(5);
  packet.set(command, 0);  // 'U','O','K','P'
  packet[4] = pktId & 0xFF;  // Сырой байт
  
  return packet;
}

/**
 * Циклический опрос телеметрии
 * Отправляется периодически (~200-1000ms)
 * Формат: 38 байт из декомпилированного APK
 * 
 * Структура из анализа оригинального приложения:
 * [0]    = 0x44 (68 decimal) - Header/Command ID
 * [1]    = 0x04 (4)          - Sub-command или длина
 * [2]    = 0x07 (7)          - Параметр
 * [3-9]  = 0x00              - Данные опроса (нули)
 * [10]   = 0x4F (79 decimal) - Маркер
 * [11-36]= 0x00              - Резерв
 * [37]   = Checksum (sum8)   - Контрольная сумма
 */
export function buildCyclicPoll(): Uint8Array {
  const packet = new Uint8Array(38);
  
  // Заполнить известные байты из логов оригинального приложения
  packet[0] = 0x44;  // 68 decimal - Command ID
  packet[1] = 0x04;  // 4 - Sub-command
  packet[2] = 0x07;  // 7 - Parameter
  // [3-9] = 0x00 (уже инициализированы нулями)
  packet[10] = 0x4F; // 79 decimal - Marker
  // [11-36] = 0x00 (резерв, уже нули)
  
  // Вычислить контрольную сумму (сумма первых 37 байт по модулю 256)
  let checksum = 0;
  for (let i = 0; i < 37; i++) {
    checksum = (checksum + packet[i]) & 0xFF;
  }
  packet[37] = checksum;
  
  return packet;
}

/**
 * Парсер пакетов от БСКУ (новый протокол)
 * 
 * Формат пакета:
 * - Заголовок: 0xFF × N (обычно 4-7 байт)
 * - Тип/ScreenId: 1 байт
 *   - 0x66 = SCREEN_CHANGE (фрейм смены экрана)
 *   - 0x77 = CONFIGURATION (конфигурационный пакет)
 *   - Другие = TELEMETRY (номер экрана телеметрии)
 * - Данные: остальные байты
 * 
 * @param rawData - сырые данные от устройства
 * @returns распарсенный пакет или null если не удалось распарсить
 */
export function parseBskuPacket(rawData: Uint8Array): BskuPacket | null {
  // Минимальная длина: заголовок (минимум 4 байта 0xFF) + тип (1 байт) = 5 байт
  if (rawData.length < 5) {
    console.warn('[parseBskuPacket] Packet too short:', rawData.length);
    return null;
  }
  
  // Найти начало заголовка синхронизации (последовательность 0xFF)
  let headerPos = -1;
  for (let i = 0; i <= rawData.length - 4; i++) {
    if (rawData[i] === 0xFF && 
        rawData[i + 1] === 0xFF && 
        rawData[i + 2] === 0xFF && 
        rawData[i + 3] === 0xFF) {
      headerPos = i;
      break;
    }
  }
  
  if (headerPos === -1) {
    console.warn('[parseBskuPacket] Header 0xFF not found');
    return null;
  }
  
  // Определить длину заголовка (сколько 0xFF подряд)
  let headerLength = 0;
  for (let i = headerPos; i < rawData.length && rawData[i] === 0xFF; i++) {
    headerLength++;
  }
  
  // Проверить что есть байт типа после заголовка
  if (headerPos + headerLength >= rawData.length) {
    console.warn('[parseBskuPacket] No type byte after header');
    return null;
  }
  
  // Байт после заголовка - тип или screenId
  const typeOrScreenId = rawData[headerPos + headerLength];
  
  // Данные (всё что после типа)
  const data = rawData.slice(headerPos + headerLength + 1);
  
  // Определить тип пакета
  let type: BskuPacketType;
  let screenId: number | undefined;
  let pktId: number | undefined;
  
  if (typeOrScreenId === 0x66) {
    // Фрейм смены экрана: 0xFF...0xFF 0x66 "SCR_" + screenId
    type = BskuPacketType.SCREEN_CHANGE;
    
    // Парсить "SCR_" и извлечь screenId
    // Ожидаем: data[0-3] = "SCR_" (ASCII), data[4] = screenId (байт)
    if (data.length >= 5 && 
        data[0] === 0x53 && // 'S'
        data[1] === 0x43 && // 'C'
        data[2] === 0x52 && // 'R'
        data[3] === 0x5F) { // '_'
      screenId = data[4];
    } else {
      console.warn('[parseBskuPacket] Invalid SCR_ format in 0x66 frame');
    }
    
  } else if (typeOrScreenId === 0x77) {
    // Конфигурационный пакет: 0xFF...0xFF 0x77 pktId + конфигурация
    type = BskuPacketType.CONFIGURATION;
    
    // Первый байт данных - pktId
    if (data.length >= 1) {
      pktId = data[0];
    }
    
  } else {
    // Телеметрия: 0xFF...0xFF screenId + данные
    type = BskuPacketType.TELEMETRY;
    screenId = typeOrScreenId;
  }
  
  return {
    type,
    screenId,
    pktId,
    data
  };
}


export class ProtocolParser {
  private acc = new Uint8Array(0);

  feed(chunk: Uint8Array, emit: (f: ParsedFrame) => void) {
    const acc = new Uint8Array(this.acc.length + chunk.length);
    acc.set(this.acc, 0);
    acc.set(chunk, this.acc.length);
    this.acc = acc;

    for (;;) {
      if (this.acc.length === 0) break;
      const b0 = this.acc[0];
      let need = 0;

      if (b0 === 0x66) {
        if (this.acc.length < 6) break;
        need = 6;
      } else if (b0 === 0x77) {
        if (this.acc.length < 3) break;
        need = 3 + (this.acc[2] & 0xFF) + 1;
      } else if (b0 >= 0x80) {
        const B = ((b0 & 0x3F) + 2) & 0xFF;
        need = 1 + B;
      } else {
        this.acc = this.acc.slice(1);
        continue;
      }

      if (this.acc.length < need) break;

      const frame = this.acc.slice(0, need);
      this.acc = this.acc.slice(need);

      let ok = true;
      if (frame[0] !== 0x66) {
        const want = frame[frame.length - 1] & 0xFF;
        const got = sum8(frame.slice(0, frame.length - 1));
        ok = want === got;
        if (!ok) {
          emit({ type: "UNKNOWN", raw: frame, ok: false });
          continue;
        }
      }

      if (frame[0] === 0x66) {
        const n = frame[5] & 0xFF;
        emit({ type: "SCR_66", raw: frame, ok: true, info: { nScr: n } });
      } else if (frame[0] === 0x77) {
        const nPak = frame[1] & 0xFF;
        const nBytes = (frame[2] & 0xFF) - 1;
        emit({ type: "CFG_77", raw: frame, ok, info: { nPak, nBytes } });
      } else if (frame[0] >= 0x80) {
        const dst = frame[1] & 0xFF;
        const src = frame[2] & 0xFF;
        const sid = frame[3] & 0xFF;
        emit({ type: "UDS_80P", raw: frame, ok, info: { dst, src, sid } });
      } else {
        emit({ type: "UNKNOWN", raw: frame, ok });
      }
    }
  }

  clearBuffer(): void {
    this.acc = new Uint8Array(0);
  }
}
