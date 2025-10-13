/* Панцирь — протокол парсера для Android (BT-SPP).
 * Поддерживает кадры: 0x88 (телеметрия), 0x66 (SCR_… -> UOKS),
 * 0x77 (config chunk -> UOKP), и >=0x80 (UDS-подобные).
 */

export type FrameType = "TEL_88" | "SCR_66" | "CFG_77" | "UDS_80P" | "UNKNOWN";

export interface ParsedFrame {
  type: FrameType;
  raw: Uint8Array;
  ok: boolean;             // проверка суммы (для 0x66 всегда true)
  info?: Record<string, any>;
}

const enc = new TextEncoder();

export function sum8(a: Uint8Array, n?: number): number {
  const m = n ?? a.length;
  let s = 0;
  for (let i = 0; i < m; i++) s = (s + (a[i] & 0xFF)) & 0xFF;
  return s;
}

export function buildUDS(dst = 0x28, src = 0xF0, sid: number, data: number[] = []): Uint8Array {
  const body = Uint8Array.from([dst, src, sid, ...data]);
  const B = body.length + 1;              // +CHK
  const hdr = 0x80 | ((B - 2) & 0x3F);
  const noChk = Uint8Array.from([hdr, ...body]);
  const chk = sum8(noChk);
  return Uint8Array.from([...noChk, chk]);
}

// Быстрые запросы (как в логах)
export const UDS_StartComm = buildUDS(0x28, 0xF0, 0x81);
export const UDS_TesterPres = buildUDS(0x28, 0xF0, 0x3E, [0x01]); // 83 28 F0 3E 01 DA
export const UDS_Read21_01 = buildUDS(0x28, 0xF0, 0x21, [0x01]); // 83 28 F0 21 01 BD

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

      if (b0 === 0x88) {
        if (this.acc.length < 3) break;
        need = 3 + (this.acc[2] & 0xFF) + 1;
      } else if (b0 === 0x66) {
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

      if (frame[0] === 0x88) {
        emit({ type: "TEL_88", raw: frame, ok, info: parseTelemetry88(frame) });
      } else if (frame[0] === 0x66) {
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

// ===== TEL 0x88 (экран 4) =====
function u16le(a: Uint8Array, i: number) {
  return (a[i] & 0xFF) | ((a[i + 1] & 0xFF) << 8);
}

export function parseTelemetry88(f: Uint8Array) {
  const nScr = f[1] & 0xFF;
  const len = f[2] & 0xFF;
  const p = f.slice(3, 3 + len);

  const sim2 = p[10] & 0xFF;  // битовые статусы
  const sim3 = p[11] & 0xFF;

  const U_U_FU = u16le(p, 12) - 100;
  const U_U_UM1 = u16le(p, 14) - 100;
  const U_U_UM2 = u16le(p, 16) - 100;
  const U_U_UM3 = u16le(p, 18) - 100;

  const cikl_COM = p[26] & 0xFF;
  const cikl_Kline = p[27] & 0xFF;
  const PWM_spd = p[30] & 0xFF;

  return {
    nScr,
    len,
    sim2,
    sim3,
    U_U_FU,
    U_U_UM1,
    U_U_UM2,
    U_U_UM3,
    cikl_COM,
    cikl_Kline,
    PWM_spd
  };
}
