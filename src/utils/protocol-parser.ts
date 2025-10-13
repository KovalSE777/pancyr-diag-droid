import { verifyChecksum, toHex } from './checksum';
import { logService } from './log-service';

/**
 * Базовый парсер протокола Android ↔ МК
 * Согласно документу "Главное.docx" §3-5
 */

export interface Frame0x88 {
  type: 0x88;
  screen: number;
  payload: Uint8Array;
}

export interface Frame0x66 {
  type: 0x66;
  screen: number;
}

export interface Frame0x77 {
  type: 0x77;
  packageNum: number;
  payload: Uint8Array;
}

export interface UDSFrame {
  type: 'UDS';
  dst: number;
  src: number;
  sid: number;  // Service ID (SID)
  data: number[];  // Raw data bytes
}

export type ParsedFrame = Frame0x88 | Frame0x66 | Frame0x77 | UDSFrame | null;

/**
 * Класс для буферизации и парсинга входящих данных
 */
export class ProtocolParser {
  private buffer: number[] = [];

  /**
   * Добавляет новые данные в буфер
   */
  addData(chunk: Uint8Array): void {
    this.buffer.push(...Array.from(chunk));
  }

  /**
   * Пытается извлечь следующий кадр из буфера
   * Возвращает null если недостаточно данных
   */
  parseNextFrame(): ParsedFrame {
    if (this.buffer.length === 0) return null;

    const firstByte = this.buffer[0];

    // Кадр 0x88 - Телеметрия экрана
    if (firstByte === 0x88) {
      return this.parse0x88();
    }

    // Кадр 0x66 - Запрос экрана
    if (firstByte === 0x66) {
      return this.parse0x66();
    }

    // Кадр 0x77 - Конфигурация
    if (firstByte === 0x77) {
      return this.parse0x77();
    }

    // UDS кадры (0x80-0x9F)
    if ((firstByte & 0x80) !== 0) {
      return this.parseUDS();
    }

    // Неизвестный байт - выбросить
    const dropped = this.buffer.shift()!;
    logService.warn('PROTO', `Unknown byte dropped: 0x${dropped.toString(16).toUpperCase()}`);
    return null;
  }

  /**
   * Парсит кадр 0x88 (телеметрия)
   * Формат: [0x88] [n_scr] [len] [payload...] [CHK]
   */
  private parse0x88(): Frame0x88 | null {
    if (this.buffer.length < 3) return null;

    const screen = this.buffer[1];
    const len = this.buffer[2];
    const totalLen = 3 + len + 1; // header(3) + payload + checksum

    if (this.buffer.length < totalLen) {
      // Недостаточно данных
      return null;
    }

    const packet = this.buffer.slice(0, totalLen);
    this.buffer = this.buffer.slice(totalLen);

    // Проверка checksum
    if (!verifyChecksum(packet)) {
      logService.error('PROTO', `0x88 checksum mismatch: ${toHex(packet)}`);
      return null;
    }

    const payload = new Uint8Array(packet.slice(3, 3 + len));
    
    logService.success('PROTO', `0x88 frame parsed: screen=${screen}, len=${len}`);
    
    return {
      type: 0x88,
      screen,
      payload
    };
  }

  /**
   * Парсит кадр 0x66 (запрос экрана)
   * Формат: [0x66] ['S'] ['C'] ['R'] ['_'] [n_scr]
   */
  private parse0x66(): Frame0x66 | null {
    if (this.buffer.length < 6) return null;

    // Проверка формата: 0x66, 'S', 'C', 'R', '_', n_scr
    if (this.buffer[1] !== 0x53 || // 'S'
        this.buffer[2] !== 0x43 || // 'C'
        this.buffer[3] !== 0x52 || // 'R'
        this.buffer[4] !== 0x5F) { // '_'
      logService.error('PROTO', `0x66 invalid format: ${toHex(this.buffer.slice(0, 6))}`);
      this.buffer.shift(); // Выбросить неправильный байт
      return null;
    }

    const screen = this.buffer[5];
    this.buffer = this.buffer.slice(6);

    logService.success('PROTO', `0x66 frame parsed: screen=${screen}`);

    return {
      type: 0x66,
      screen
    };
  }

  /**
   * Парсит кадр 0x77 (конфигурация)
   * Формат: [0x77] [n_pak] [n_byte+1] [payload...] [CHK]
   */
  private parse0x77(): Frame0x77 | null {
    if (this.buffer.length < 3) return null;

    const packageNum = this.buffer[1];
    const nByteField = this.buffer[2];
    const payloadLen = nByteField - 1; // n_byte = n_byte_field - 1
    const totalLen = 3 + payloadLen + 1; // header(3) + payload + checksum

    if (this.buffer.length < totalLen) {
      return null;
    }

    const packet = this.buffer.slice(0, totalLen);
    this.buffer = this.buffer.slice(totalLen);

    // Проверка checksum
    if (!verifyChecksum(packet)) {
      logService.error('PROTO', `0x77 checksum mismatch: ${toHex(packet)}`);
      return null;
    }

    const payload = new Uint8Array(packet.slice(3, 3 + payloadLen));

    logService.success('PROTO', `0x77 frame parsed: pkg=${packageNum}, len=${payloadLen}`);

    return {
      type: 0x77,
      packageNum,
      payload
    };
  }

  /**
   * Парсит UDS кадр
   * Формат: [HDR] [DST] [SRC] [SID] [DATA...] [CHK]
   * HDR = 0x80 | (N-2), где N = количество байт от DST до последнего байта данных
   * 
   * ВАЖНО: Ответы от блока приходят с DST=0xF1, SRC=0x28 (согласно "изменения.docx")
   * Отправляем: DST=0x28, SRC=0xF0
   * Получаем: DST=0xF1, SRC=0x28
   */
  private parseUDS(): UDSFrame | null {
    if (this.buffer.length < 4) return null;

    const hdr = this.buffer[0];
    const dataLen = (hdr & 0x3F) + 2; // N = (HDR & 0x3F) + 2
    const totalLen = 1 + dataLen + 1; // HDR + DST...DATA + CHK

    if (this.buffer.length < totalLen) {
      return null;
    }

    const packet = this.buffer.slice(0, totalLen);
    this.buffer = this.buffer.slice(totalLen);

    // Проверка checksum
    if (!verifyChecksum(packet)) {
      logService.error('PROTO', `UDS checksum mismatch: ${toHex(packet)}`);
      return null;
    }

    const dst = packet[1];
    const src = packet[2];
    const sid = packet[3];
    const data = Array.from(packet.slice(4, totalLen - 1));

    logService.success('PROTO', `UDS frame: DST=0x${dst.toString(16).toUpperCase()} SRC=0x${src.toString(16).toUpperCase()} SID=0x${sid.toString(16).toUpperCase()}, CHK OK`);

    return {
      type: 'UDS',
      dst,
      src,
      sid,
      data
    };
  }

  /**
   * Возвращает текущий размер буфера
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Очищает буфер
   */
  clearBuffer(): void {
    this.buffer = [];
  }
}
