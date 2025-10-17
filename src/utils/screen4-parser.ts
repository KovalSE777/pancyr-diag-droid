import { DiagnosticData, ComponentStatus } from '@/types/bluetooth';
import { logService } from './log-service';

/**
 * ADC to Temperature conversion tables
 * Based on firmware calibration tables
 */

// Температура, вариант A (для воздуха/испарителя): ADC -> temp_x10 (°C * 10)
const TEMP_TABLE_A: [number, number][] = [
  [0x00, 29], [0x01, 29], [0x02, 30], [0x10, 38], [0x17, 40],
  [0x49, 66], [0x6A, 80], [0x85, 95], [0xF0, 155], [0xFF, 165],
];

// Температура, вариант B (для компрессора)
const TEMP_TABLE_B: [number, number][] = [
  [0x01, 165], [0x10, 175], [0x20, 185], [0x30, 195], [0x40, 205],
  [0x50, 215], [0x60, 225], [0x70, 235], [0xFF, 250],
];

// Давление: ADC -> P_x10 (бар * 10)
const PRESS_TABLE: [number, number][] = [
  [0, 0], [19, 1], [30, 3], [107, 15], [224, 34], [250, 38],
];

/**
 * Linear interpolation helper
 */
function interp8(x: number, table: [number, number][]): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x2, y2] = table[i];
    const [x1, y1] = table[i - 1];
    if (x <= x2) {
      const dy = y2 - y1, dx = x2 - x1;
      return Math.round(y1 + (dx ? (x - x1) * dy / dx : 0));
    }
  }
  return table[table.length - 1][1];
}

/**
 * ADC conversion functions
 */
const adc8ToTempA = (adc: number): number => interp8(adc & 0xFF, TEMP_TABLE_A) / 10;
const adc8ToTempB = (adc: number): number => interp8(adc & 0xFF, TEMP_TABLE_B) / 10;
const adc8ToPressureBar = (adc: number): number => interp8(adc & 0xFF, PRESS_TABLE) / 10;

/**
 * Парсер данных экрана 4 (22 байта payload - НОВЫЙ ФОРМАТ v1.0)
 * Согласно ТЗ от 17.10.2025
 */
export class Screen4Parser {
  /**
   * Парсит payload UDS ответа 0x21 0x01 (22 байта базовый формат)
   * Поддерживает расширенный формат до 33 байт (опционально)
   */
  static parse(payload: Uint8Array, systemType: 'SKA' | 'SKE' = 'SKA'): DiagnosticData | null {
    // Валидация systemType
    if (systemType !== 'SKA' && systemType !== 'SKE') {
      logService.error('Screen4Parser', `Invalid systemType: ${systemType}, expected SKA or SKE`);
      return null;
    }
    
    // Минимум 22 байта обязательных данных
    if (payload.length < 22) {
      logService.error('Screen4Parser', `Payload too short: ${payload.length} bytes, expected minimum 22`);
      return null;
    }

    // ========== ОБЯЗАТЕЛЬНЫЕ 22 БАЙТА (согласно ТЗ v1.0) ==========
    
    // [0] U_U_UM1 - ADC напряжения вентилятора М1
    const U_U_UM1 = payload[0] & 0xFF;
    
    // [1] U_U_UM2 - ADC напряжения вентилятора М2
    const U_U_UM2 = payload[1] & 0xFF;
    
    // [2] U_U_UM3 - ADC напряжения вентилятора М3
    const U_U_UM3 = payload[2] & 0xFF;
    
    // [3] U_U_FU - ADC напряжения питания
    const U_U_FU = payload[3] & 0xFF;
    
    // [4] uUPR_BT - битовая маска управления
    const uUPR_BT = payload[4] & 0xFF;
    
    // [5] uUPR_IND - битовая маска индикации (предохранители)
    const uUPR_IND = payload[5] & 0xFF;
    
    // [6] sDAT_BIT - битовая маска состояний
    const sDAT_BIT = payload[6] & 0xFF;
    
    // [7] work_rej_cmp - режим работы компрессора
    const work_rej_cmp = payload[7] & 0xFF;
    
    // [8] vdlt_cnd_i - падение напряжения конденсатор
    const vdlt_cnd_i = payload[8] & 0xFF;
    
    // [9] vdlt_isp_i - падение напряжения испаритель
    const vdlt_isp_i = payload[9] & 0xFF;
    
    // [10] vdlt_cmp_i - падение напряжения компрессор
    const vdlt_cmp_i = payload[10] & 0xFF;
    
    // [11] timer_off - таймер отключения
    const timer_off = payload[11] & 0xFF;
    
    // [12] rej_cnd - режим работы конденсатор
    const rej_cnd = payload[12] & 0xFF;
    
    // [13] rej_isp - режим работы испаритель
    const rej_isp = payload[13] & 0xFF;
    
    // [14] edlt_cnd - заданное падение конденсатор
    const edlt_cnd = payload[14] & 0xFF;
    
    // [15] edlt_isp - заданное падение испаритель
    const edlt_isp = payload[15] & 0xFF;
    
    // [16] edlt_cmp - заданное падение компрессор
    const edlt_cmp = payload[16] & 0xFF;
    
    // [17] n_V_cnd - количество активных вентиляторов конденсатора
    const n_V_cnd = payload[17] & 0xFF;
    
    // [18] PWM_spd - скорость PWM (1=медленно, 2=быстро)
    const PWM_spd = payload[18] & 0xFF;
    
    // [19] s1_TMR2 - HIGH период PWM
    const s1_TMR2 = payload[19] & 0xFF;
    
    // [20] s0_TMR2 - LOW период PWM
    const s0_TMR2 = payload[20] & 0xFF;
    
    // [21] t_v_razg_cnd - время разгона конденсатора
    const t_v_razg_cnd = payload[21] & 0xFF;

    // ========== РАСШИРЕННЫЕ ПОЛЯ (опционально, байты 22+) ==========
    
    let T_air_adc = 0x6A;  // Дефолтные значения
    let T_isp_adc = 0x30;
    let T_kmp_adc = 0x40;
    let U_davl_adc = 107;
    
    // Если есть расширенные данные (температуры и давление)
    if (payload.length >= 25) {
      T_air_adc = payload[22] & 0xFF;   // [22] T_air
      T_isp_adc = payload[23] & 0xFF;   // [23] T_isp
      U_davl_adc = payload[24] & 0xFF;  // [24] U_davl
      T_kmp_adc = payload.length >= 27 ? payload[26] & 0xFF : 0x40; // [26] T_kmp (если есть)
    }

    // ========== КОНВЕРТАЦИЯ ДАННЫХ ==========
    
    // Напряжения (формула из ТЗ: V = ADC * 30 / 255)
    const UP_M1 = (U_U_UM1 * 30) / 255;
    const UP_M2 = (U_U_UM2 * 30) / 255;
    const UP_M3 = (U_U_UM3 * 30) / 255;
    const U_nap = (U_U_FU * 30) / 255;
    
    // Падения напряжения (аналогичная формула)
    const dUP_M1 = (vdlt_cnd_i * 30) / 255;
    const dUP_M2 = (vdlt_isp_i * 30) / 255;
    const dUP_M3 = (vdlt_cmp_i * 30) / 255;

    // Температуры (калибровочные таблицы)
    const T_air = adc8ToTempA(T_air_adc);
    const T_isp = adc8ToTempA(T_isp_adc);
    const T_kmp = adc8ToTempB(T_kmp_adc);
    
    // Давление
    const U_davl = adc8ToPressureBar(U_davl_adc);

    // ========== БИТОВЫЕ ПОЛЯ ==========
    
    // uUPR_BT (байт 4) - управление реле
    const uUP_M1 = !!(uUPR_BT & 0x01);   // bit 0
    const uUP_M2 = !!(uUPR_BT & 0x02);   // bit 1
    const uUP_M3 = !!(uUPR_BT & 0x04);   // bit 2
    const uUP_M4 = !!(uUPR_BT & 0x08);   // bit 3
    const uUP_M5 = !!(uUPR_BT & 0x10);   // bit 4
    const uUP_CMP = !!(uUPR_BT & 0x20);  // bit 5

    // uUPR_IND (байт 5) - предохранители
    const fuseEtalon = !!(uUPR_IND & 0x01);     // bit 0
    const fuseCondenser = !!(uUPR_IND & 0x02);  // bit 1
    const fuseEvaporator = !!(uUPR_IND & 0x04); // bit 2
    const fuseCompressor = !!(uUPR_IND & 0x08); // bit 3

    // sDAT_BIT (байт 6) - состояния
    const bD_DAVL = !!(sDAT_BIT & 0x01);     // bit 0 - датчик давления
    const bVKL_CMP = !!(sDAT_BIT & 0x02);    // bit 1 - компрессор включен
    const bBL_2 = !!(sDAT_BIT & 0x04);       // bit 2 - тип системы (0=СКА, 1=СКЭ)
    const bK_NORM = !!(sDAT_BIT & 0x08);     // bit 3 - контактор норма
    const bFTD_NORM = !!(sDAT_BIT & 0x10);   // bit 4 - ФТД норма
    const bBL2_1vnt = !!(sDAT_BIT & 0x20);   // bit 5 - один вентилятор
    const bNO_V_CMP = !!(sDAT_BIT & 0x40);   // bit 6 - нет вращения компрессора

    // ========== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ==========
    
    // Количество вентиляторов по типу системы
    const kUM1_cnd = systemType === 'SKE' ? 3 : 2;
    const kUM2_isp = 1;
    const kUM3_cmp = 1;

    // Создание массивов статусов вентиляторов
    const condenserFans = [];
    for (let i = 1; i <= kUM1_cnd; i++) {
      condenserFans.push({
        id: i,
        status: (i <= n_V_cnd ? 'ok' : 'error') as ComponentStatus,
        errorMessage: i > n_V_cnd ? `Вентилятор конденсатора #${i} не работает` : undefined,
        repairHint: i > n_V_cnd ? 'Проверьте питание и контакты вентилятора.' : undefined
      });
    }

    const evaporatorFans = [{
      id: 1,
      status: 'ok' as ComponentStatus
    }];

    const compressorFans = [{
      id: 1,
      status: bNO_V_CMP ? 'error' as ComponentStatus : 'ok' as ComponentStatus,
      errorMessage: bNO_V_CMP ? 'Компрессор не вращается' : undefined,
      repairHint: bNO_V_CMP ? 'Проверьте компрессор и его подключение.' : undefined
    }];

    // Статусы компонентов
    const compressorStatus: ComponentStatus = work_rej_cmp === 0 ? 'off' : 
                                              work_rej_cmp === 10 ? 'error' : 'ok';
    const condenserStatus: ComponentStatus = rej_cnd === 0 ? 'off' :
                                             rej_cnd === 10 ? 'error' : 'ok';
    const evaporatorStatus: ComponentStatus = rej_isp === 0 ? 'off' :
                                              rej_isp === 10 ? 'error' : 'ok';
    const pressureSensorStatus: ComponentStatus = bD_DAVL ? 'ok' : 'error';

    // Режим работы
    let mode: 'cooling' | 'ventilation' | 'standby' | 'error' = 'standby';
    if (work_rej_cmp === 2 && rej_cnd === 2) {
      mode = 'cooling';
    } else if (work_rej_cmp === 0 && rej_cnd > 0) {
      mode = 'ventilation';
    } else if (work_rej_cmp === 10 || rej_cnd === 10) {
      mode = 'error';
    }

    // Формирование ошибок
    const errors = [];
    if (!fuseEtalon) {
      errors.push({
        code: 'F01',
        severity: 'critical' as const,
        component: 'Предохранитель эталон (Pr1)',
        description: 'Предохранитель эталона перегорел',
        suggestedFix: 'Замените предохранитель Pr1.'
      });
    }
    if (!fuseCondenser) {
      errors.push({
        code: 'F02',
        severity: 'critical' as const,
        component: 'Предохранитель конденсатора (Pr2)',
        description: 'Предохранитель конденсатора перегорел',
        suggestedFix: 'Замените предохранитель Pr2.'
      });
    }
    if (!fuseEvaporator) {
      errors.push({
        code: 'F03',
        severity: 'warning' as const,
        component: 'Предохранитель испарителя (Pr3)',
        description: 'Предохранитель испарителя перегорел',
        suggestedFix: 'Замените предохранитель Pr3.'
      });
    }
    if (!fuseCompressor) {
      errors.push({
        code: 'F04',
        severity: 'critical' as const,
        component: 'Предохранитель компрессора (Pr4)',
        description: 'Предохранитель компрессора перегорел',
        suggestedFix: 'Замените предохранитель Pr4.'
      });
    }
    if (bNO_V_CMP) {
      errors.push({
        code: 'E01',
        severity: 'critical' as const,
        component: 'Компрессор',
        description: 'Компрессор не вращается',
        suggestedFix: 'Проверьте компрессор и его питание.'
      });
    }

    logService.success('Screen4Parser', `Parsed 22-byte format: U=${U_nap.toFixed(1)}V, T_air=${T_air.toFixed(1)}°C, mode=${mode}`);

    return {
      // Напряжения
      UP_M1,
      UP_M2,
      UP_M3,
      UP_M4: U_nap,
      UP_M5: U_nap,

      // Падения напряжения
      dUP_M1,
      dUP_M2,
      dUP_M3,

      // Температуры
      T_air,
      T_isp,
      T_kmp,

      // Напряжение и давление
      U_nap,
      U_davl,

      // Количество вентиляторов
      kUM1_cnd,
      kUM2_isp,
      kUM3_cmp,

      // Активные вентиляторы
      n_V_cnd,
      n_V_isp: 1,
      n_V_cmp: 1,

      // PWM
      PWM_spd: PWM_spd as 1 | 2,

      // Детальные статусы вентиляторов
      condenserFans,
      evaporatorFans,
      compressorFans,

      // Статусы компонентов
      compressorStatus,
      condenserStatus,
      evaporatorStatus,
      pressureSensorStatus,
      
      // Power system
      powerStatus: U_nap >= 22 && U_nap <= 30 ? 'ok' : 'error',
      batteryVoltage: U_nap,
      powerSupplyOk: U_nap >= 22 && U_nap <= 30,
      
      softStartStatus: bK_NORM && bFTD_NORM ? 'ok' : 'error',

      // Диагностика soft-start
      zmk_V_isp1: false,
      obr_V_isp1: false,
      zmk_V_knd1: false,
      obr_V_knd1: n_V_cnd < kUM1_cnd,
      zmk_COMP: false,
      obr_COMP: bNO_V_CMP,

      // Режимы работы
      work_rej_cnd: rej_cnd,
      work_rej_isp: rej_isp,
      work_rej_cmp,

      // Предохранители
      fuseEtalon,
      fuseCondenser,
      fuseEvaporator,
      fuseCompressor,

      // Soft start signals
      signal_SVD: bFTD_NORM,
      signal_ContactNorm: bK_NORM,

      // Дополнительные данные
      cikl_COM: 0,  // Не передается в новом формате
      cikl_K_line: 0,  // Не передается в новом формате
      timer_off,
      s1_TMR2,
      s0_TMR2,
      edlt_cnd_i: edlt_cnd,
      edlt_isp_i: edlt_isp,
      edlt_cmp_i: edlt_cmp,

      // Тип системы и режим
      systemType,
      mode,
      sSTATUS: sDAT_BIT,

      // Ошибки
      errors
    };
  }
}
