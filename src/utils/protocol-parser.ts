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
 */
export function buildUOKS(screenId: number): Uint8Array {
  const encoder = new TextEncoder();
  const command = encoder.encode('UOKS');
  
  const packet = new Uint8Array(5);
  packet.set(command, 0);
  packet[4] = screenId & 0xFF;
  
  return packet;
}

/**
 * UOKP - Подтверждение пакета конфигурации
 * Отправляется в ответ на фрейм 0x77 от БСКУ
 * @param pktId - номер пакета конфигурации
 */
export function buildUOKP(pktId: number): Uint8Array {
  const encoder = new TextEncoder();
  const command = encoder.encode('UOKP');
  
  const packet = new Uint8Array(5);
  packet.set(command, 0);
  packet[4] = pktId & 0xFF;
  
  return packet;
}

/**
 * Циклический опрос телеметрии (38 байт)
 * Отправляется периодически (~200-1000ms)
 * 
 * Формат из логов оригинального приложения:
 * [0] = 0x44 (Header/Command ID)
 * [1] = 0x04
 * [2] = 0x07
 * [3-9] = 0x00
 * [10] = 0x4F (79 decimal)
 * [11-36] = данные (пока неизвестны точно)
 * [37] = контрольная сумма
 */
export function buildCyclicPoll(): Uint8Array {
  const packet = new Uint8Array(38);
  
  // Из логов оригинального приложения
  packet[0] = 0x44;  // 68 decimal - Header
  packet[1] = 0x04;  // 4
  packet[2] = 0x07;  // 7
  packet[3] = 0x00;
  packet[4] = 0x00;
  packet[5] = 0x00;
  packet[6] = 0x00;
  packet[7] = 0x00;
  packet[8] = 0x00;
  packet[9] = 0x00;
  packet[10] = 0x4F; // 79 decimal
  
  // Байты 11-36: пока оставляем нули
  // TODO: Может потребоваться уточнение из реальных логов
  for (let i = 11; i < 37; i++) {
    packet[i] = 0x00;
  }
  
  // Байт 37: Контрольная сумма
  let checksum = 0;
  for (let i = 0; i < 37; i++) {
    checksum = (checksum + packet[i]) & 0xFF;
  }
  packet[37] = checksum;
  
  return packet;
}

/**
 * Парсер пакетов от БСКУ (новый протокол с 0xFF заголовками)
 * Формат: 0xFF × N (заголовок) + тип/screenId + данные
 */
export function parseBskuPacket(rawData: Uint8Array): BskuPacket | null {
  if (rawData.length < 8) {
    console.warn('Packet too short:', rawData.length);
    return null;
  }
  
  // Найти заголовок синхронизации (байты 0xFF)
  let headerLength = 0;
  for (let i = 0; i < Math.min(7, rawData.length); i++) {
    if (rawData[i] === 0xFF) {
      headerLength++;
    } else {
      break;
    }
  }
  
  if (headerLength < 4) {
    console.warn('Invalid header, expected 0xFF bytes, got:', headerLength);
    // Попробуем всё равно распарсить
  }
  
  // Байт после заголовка - тип/screenId
  const typeOrScreenId = rawData[headerLength];
  
  // Данные (остальное после типа)
  const data = rawData.slice(headerLength + 1);
  
  // Определить тип пакета
  let type: BskuPacketType;
  let screenId: number | undefined;
  let pktId: number | undefined;
  
  if (typeOrScreenId === 0x66) {
    type = BskuPacketType.SCREEN_CHANGE;
    // Для 0x66 данные могут начинаться с "SCR_", затем screenId
    // Или screenId сразу в следующем байте
    screenId = data.length > 4 ? data[4] : data[0];
  } else if (typeOrScreenId === 0x77) {
    type = BskuPacketType.CONFIGURATION;
    // Для 0x77 первый байт данных - pktId
    pktId = data[0];
  } else {
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

// ========== УСТАРЕВШИЕ UDS ФУНКЦИИ (для обратной совместимости) ==========

export function buildUDS(dst = 0x2A, src = 0xF1, sid: number, data: number[] = []): Uint8Array {
  const body = Uint8Array.from([dst, src, sid, ...data]);
  const B = body.length + 1;
  const hdr = 0x80 | ((B - 2) & 0x3F);
  const noChk = Uint8Array.from([hdr, ...body]);
  const chk = sum8(noChk);
  return Uint8Array.from([...noChk, chk]);
}

/**
 * АЛЬТЕРНАТИВНЫЙ РЕЖИМ: ПРЯМОЕ УПРАВЛЕНИЕ
 * Этот режим может работать если основной протокол (ASCII команды) не работает
 * Формат: [HDR, DST=0x2A, SRC=0xF1, iUPR_BT, iUPR_IND, iDAT_BIT, dlt_paus, CHK]
 */
export function buildDirectControl(
  iUPR_BT: number,    // Управление реле (M1-M5, CMP)
  iUPR_IND: number,   // Управление индикаторами
  iDAT_BIT: number,   // Битовые флаги состояния
  dlt_paus: number    // Задержка паузы (0-255)
): Uint8Array {
  const body = Uint8Array.from([
    0x2A,      // DST (БСКУ)
    0xF1,      // SRC (приложение/тестер)
    iUPR_BT,   // Байт управления реле
    iUPR_IND,  // Байт управления индикаторами
    iDAT_BIT,  // Байт флагов
    dlt_paus   // Задержка
  ]);
  
  const B = body.length + 1; // +CHK
  const hdr = 0x80 | ((B - 2) & 0x3F);
  const noChk = Uint8Array.from([hdr, ...body]);
  const chk = sum8(noChk);
  
  return Uint8Array.from([...noChk, chk]);
}

// АЛЬТЕРНАТИВНЫЙ режим: Пакет опроса состояния
export const DirectControl_Poll = buildDirectControl(0x00, 0x00, 0x00, 0x00);

// ACK (ASCII, без CHK)
export const ackUOKS = (n: number) => enc.encode(`UOKS${String.fromCharCode(n & 0xFF)}`);
export const ackUOKP = (n: number) => enc.encode(`UOKP${String.fromCharCode(n & 0xFF)}`);

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
